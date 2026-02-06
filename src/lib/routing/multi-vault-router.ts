import { getContractCallsQuote, type ContractCallsQuoteRequest } from '@lifi/sdk'
import { encodeFunctionData } from 'viem'
import type { RouteOption } from '@/lib/types'
import { CHAIN_MAP, getTokenAddress, getTokenDecimals } from './tokens'
import { YIELD_ROUTER_ADDRESS } from './yield-router'
import { type StrategyAllocation, STRATEGIES, calculateStrategyAmounts } from '@/lib/strategies'

// YieldRouter ABI
const YIELD_ROUTER_ABI = [
  {
    name: 'depositToYield',
    type: 'function',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'vault', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

// RestakingRouter ABI
const RESTAKING_ROUTER_ABI = [
  {
    name: 'depositToRenzo',
    type: 'function',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'minEzEthOut', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

// RestakingRouter address on Base
const RESTAKING_ROUTER_ADDRESS: `0x${string}` = '0x31549dB00B180d528f77083b130C0A045D0CF117'

// Default vault addresses on Base
const DEFAULT_VAULTS = {
  yield: '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB', // Aave USDC
  restaking: RESTAKING_ROUTER_ADDRESS,
}

const BASE_CHAIN_ID = CHAIN_MAP.base

export interface MultiVaultRouteParams {
  fromAddress: string
  fromChain: string
  fromToken: string
  amount: string
  recipient: string
  allocations: StrategyAllocation[]
  vaults?: Record<string, string> // strategy -> vault address mapping
  slippage?: number
}

export interface MultiVaultRouteQuote {
  route: RouteOption
  quotes: Awaited<ReturnType<typeof getContractCallsQuote>>[]
  allocations: { strategy: string; amount: string; percentage: number }[]
}

function extractErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const resp = (error as { response?: { data?: { message?: string } } }).response
    if (resp?.data?.message) {
      return resp.data.message
    }
  }
  return 'Failed to build multi-vault route'
}

/**
 * Build a multi-vault split route for multiple strategy allocations.
 * Uses LI.FI Contract Calls to atomically route to multiple destinations.
 */
export async function getMultiVaultRouteQuote(
  params: MultiVaultRouteParams
): Promise<MultiVaultRouteQuote | { error: string }> {
  const fromChainId = CHAIN_MAP[params.fromChain] || CHAIN_MAP.ethereum
  const toChainId = BASE_CHAIN_ID
  const fromTokenAddr = getTokenAddress(params.fromToken, fromChainId)
  const toTokenAddr = getTokenAddress('USDC', toChainId)

  if (!fromTokenAddr) {
    return { error: `Source token not supported: ${params.fromToken}` }
  }

  if (!toTokenAddr) {
    return { error: 'USDC not supported on Base' }
  }

  // Calculate amounts for each strategy
  const strategyAmounts = calculateStrategyAmounts(params.amount, params.allocations)

  // Filter out liquid (no routing needed) and validate
  const routeableStrategies = strategyAmounts.filter(
    (sa) => sa.strategy !== 'liquid' && parseFloat(sa.amount) > 0
  )

  if (routeableStrategies.length === 0) {
    // All liquid - return simple transfer
    return {
      route: {
        id: 'multi-vault-liquid',
        path: `${params.fromToken} -> USDC (liquid)`,
        fee: '$0.00',
        estimatedTime: '~1 min',
        provider: 'Direct Transfer',
        routeType: 'standard',
      },
      quotes: [],
      allocations: strategyAmounts.map((sa) => ({
        strategy: sa.strategy,
        amount: sa.amount,
        percentage: params.allocations.find((a) => a.strategy === sa.strategy)?.percentage || 0,
      })),
    }
  }

  try {
    const quotes: Awaited<ReturnType<typeof getContractCallsQuote>>[] = []
    const contractCalls: ContractCallsQuoteRequest['contractCalls'] = []

    for (const sa of routeableStrategies) {
      const decimals = getTokenDecimals('USDC') // USDC on Base
      const amountWei = BigInt(Math.floor(parseFloat(sa.amount) * 10 ** decimals)).toString()

      if (sa.strategy === 'yield') {
        // Yield strategy - deposit to ERC-4626 vault
        const vaultAddress = params.vaults?.yield || DEFAULT_VAULTS.yield

        const callData = encodeFunctionData({
          abi: YIELD_ROUTER_ABI,
          functionName: 'depositToYield',
          args: [
            params.recipient as `0x${string}`,
            vaultAddress as `0x${string}`,
            toTokenAddr as `0x${string}`,
            BigInt(amountWei),
          ],
        })

        contractCalls.push({
          fromAmount: amountWei,
          fromTokenAddress: toTokenAddr,
          toContractAddress: YIELD_ROUTER_ADDRESS,
          toContractCallData: callData,
          toContractGasLimit: '300000',
        })
      } else if (sa.strategy === 'restaking') {
        // Restaking strategy - deposit to Renzo for ezETH
        // First need to convert USDC to WETH, then deposit
        const wethAddress = getTokenAddress('WETH', toChainId)
        if (!wethAddress) {
          return { error: 'WETH not supported on Base for restaking' }
        }

        // Minimum output with 5% slippage for restaking
        const minOut = BigInt(Math.floor(parseFloat(amountWei) * 0.95)).toString()

        const callData = encodeFunctionData({
          abi: RESTAKING_ROUTER_ABI,
          functionName: 'depositToRenzo',
          args: [
            params.recipient as `0x${string}`,
            BigInt(minOut),
          ],
        })

        contractCalls.push({
          fromAmount: amountWei,
          fromTokenAddress: wethAddress, // Will need WETH, LI.FI handles swap
          toContractAddress: RESTAKING_ROUTER_ADDRESS,
          toContractCallData: callData,
          toContractGasLimit: '350000',
        })
      }
    }

    // Get combined quote from LI.FI
    const totalAmount = strategyAmounts.reduce(
      (sum, sa) => sum + parseFloat(sa.amount),
      0
    )
    const fromDecimals = getTokenDecimals(params.fromToken)
    const totalAmountWei = BigInt(
      Math.floor(totalAmount * 10 ** fromDecimals)
    ).toString()

    const quoteRequest: ContractCallsQuoteRequest = {
      fromAddress: params.fromAddress as `0x${string}`,
      fromChain: fromChainId,
      fromToken: fromTokenAddr,
      toChain: toChainId,
      toToken: toTokenAddr,
      toAmount: totalAmountWei,
      contractCalls,
      slippage: params.slippage || 0.005,
    }

    const quote = await getContractCallsQuote(quoteRequest)
    quotes.push(quote)

    // Calculate total gas cost
    const estimatedGas =
      quote.estimate?.gasCosts?.reduce(
        (sum, g) => sum + Number(g.amountUSD || 0),
        0
      ) ?? 0

    const estimatedDuration = quote.estimate?.executionDuration
      ? `${Math.ceil(quote.estimate.executionDuration / 60)} min`
      : '~3 min'

    // Build path description
    const pathParts = strategyAmounts.map((sa) => {
      const strat = STRATEGIES[sa.strategy]
      const pct = params.allocations.find((a) => a.strategy === sa.strategy)?.percentage || 0
      return `${pct}% ${strat.name}`
    })

    return {
      route: {
        id: 'multi-vault-route',
        path: `MultiVault: ${pathParts.join(' + ')}`,
        fee: `$${estimatedGas.toFixed(2)}`,
        estimatedTime: estimatedDuration,
        provider: 'LI.FI + MultiVault',
        routeType: 'contract-call',
      },
      quotes,
      allocations: strategyAmounts.map((sa) => ({
        strategy: sa.strategy,
        amount: sa.amount,
        percentage: params.allocations.find((a) => a.strategy === sa.strategy)?.percentage || 0,
      })),
    }
  } catch (error: unknown) {
    console.error('MultiVault quote error:', error)
    return { error: extractErrorDetail(error) }
  }
}

/**
 * Check if allocations require multi-vault routing
 */
export function isMultiVaultRoute(allocations: StrategyAllocation[]): boolean {
  // Multi-vault if more than one strategy with non-zero allocation
  const activeStrategies = allocations.filter((a) => a.percentage > 0)
  return activeStrategies.length > 1
}
