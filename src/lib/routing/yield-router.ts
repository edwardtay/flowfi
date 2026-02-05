import { getContractCallsQuote, type ContractCallsQuoteRequest } from '@lifi/sdk'
import { encodeFunctionData } from 'viem'
import type { RouteOption } from '@/lib/types'
import { CHAIN_MAP, getTokenAddress, getTokenDecimals } from './tokens'
import { getCached, setCache } from './route-cache'

// YieldRouter ABI (just the function we need)
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

// Deployed YieldRouter address on Base
// TODO: Update after deployment
export const YIELD_ROUTER_ADDRESS: `0x${string}` = '0x0000000000000000000000000000000000000000'

// Base chain ID for YieldRoute (always deposits to Base)
const BASE_CHAIN_ID = CHAIN_MAP.base

export interface YieldRouteParams {
  fromAddress: string
  fromChain: string
  fromToken: string
  amount: string
  recipient: string // ENS-resolved address
  vault: string // ERC-4626 vault address from ENS
  slippage?: number
}

export interface YieldRouteQuote {
  route: RouteOption
  quote: Awaited<ReturnType<typeof getContractCallsQuote>>
}

function extractErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const resp = (error as { response?: { data?: { message?: string } } })
      .response
    if (resp?.data?.message) {
      return resp.data.message
    }
  }
  return 'Failed to find yield route'
}

export async function getYieldRouteQuote(
  params: YieldRouteParams
): Promise<YieldRouteQuote | { error: string }> {
  const fromChainId = CHAIN_MAP[params.fromChain] || CHAIN_MAP.ethereum
  const toChainId = BASE_CHAIN_ID // Always Base
  const fromTokenAddr = getTokenAddress(params.fromToken, fromChainId)
  const toTokenAddr = getTokenAddress('USDC', toChainId) // Always USDC on Base

  if (!fromTokenAddr) {
    return { error: `Source token not supported: ${params.fromToken}` }
  }

  if (!toTokenAddr) {
    return { error: 'USDC not supported on Base' }
  }

  if (!params.vault || params.vault === '0x0000000000000000000000000000000000000000') {
    return { error: 'No vault configured for recipient' }
  }

  const decimals = getTokenDecimals(params.fromToken)
  const amountWei = BigInt(
    Math.floor(parseFloat(params.amount) * 10 ** decimals)
  ).toString()

  const cacheKey = `yield:${fromChainId}:${params.recipient}:${params.vault}:${amountWei}`
  const cached = getCached<YieldRouteQuote>(cacheKey)
  if (cached) return cached

  try {
    // Build the destination call data for YieldRouter.depositToYield
    const callData = encodeFunctionData({
      abi: YIELD_ROUTER_ABI,
      functionName: 'depositToYield',
      args: [
        params.recipient as `0x${string}`,
        params.vault as `0x${string}`,
        toTokenAddr as `0x${string}`,
        BigInt(amountWei),
      ],
    })

    // Get quote with contract call
    const quoteRequest: ContractCallsQuoteRequest = {
      fromAddress: params.fromAddress as `0x${string}`,
      fromChain: fromChainId,
      fromToken: fromTokenAddr,
      toChain: toChainId,
      toToken: toTokenAddr,
      toAmount: amountWei,
      contractCalls: [
        {
          fromAmount: amountWei,
          fromTokenAddress: toTokenAddr,
          toContractAddress: YIELD_ROUTER_ADDRESS,
          toContractCallData: callData,
          toContractGasLimit: '300000',
        },
      ],
      slippage: params.slippage || 0.005,
    }

    const quote = await getContractCallsQuote(quoteRequest)

    const steps = quote.includedSteps || []
    const bridgePath =
      steps.length > 0
        ? steps.map((s) => s.toolDetails?.name || s.type).join(' -> ')
        : `${params.fromToken} -> USDC`

    const estimatedGas =
      quote.estimate?.gasCosts?.reduce(
        (sum, g) => sum + Number(g.amountUSD || 0),
        0
      ) ?? 0

    const estimatedDuration = quote.estimate?.executionDuration
      ? `${Math.ceil(quote.estimate.executionDuration / 60)} min`
      : '~3 min'

    const result: YieldRouteQuote = {
      route: {
        id: 'yield-route-0',
        path: `YieldRoute: ${bridgePath} -> Vault`,
        fee: `$${estimatedGas.toFixed(2)}`,
        estimatedTime: estimatedDuration,
        provider: 'LI.FI + YieldRouter',
        routeType: 'contract-call',
      },
      quote,
    }

    setCache(cacheKey, result)
    return result
  } catch (error: unknown) {
    console.error('YieldRoute quote error:', error)
    return { error: extractErrorDetail(error) }
  }
}

/**
 * Check if a recipient has yield routing configured
 */
export function isYieldRouteEnabled(vault: string | undefined): boolean {
  return (
    !!vault &&
    vault !== '0x0000000000000000000000000000000000000000' &&
    vault.startsWith('0x') &&
    vault.length === 42
  )
}
