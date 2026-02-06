import { createPublicClient, encodeFunctionData, http, namehash, keccak256, toHex } from 'viem'
import { normalize } from 'viem/ens'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL || 'https://eth.llamarpc.com'),
})

const resolverAbi = [
  {
    name: 'setText',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'multicall',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'data', type: 'bytes[]' }],
    outputs: [{ name: 'results', type: 'bytes[]' }],
  },
] as const

/**
 * Build transaction data that writes com.payagent.token and com.payagent.chain
 * text records on the user's ENS resolver via a single multicall.
 */
export async function buildSetPreferenceTransaction(
  ensName: string,
  token: string,
  chain: string,
): Promise<{ to: string; data: string; value: string; chainId: number }> {
  const normalized = normalize(ensName)
  const node = namehash(normalized)

  const resolverAddress = await client.getEnsResolver({ name: normalized })
  if (!resolverAddress) {
    throw new Error(`No resolver found for ${ensName}`)
  }

  const setTokenData = encodeFunctionData({
    abi: resolverAbi,
    functionName: 'setText',
    args: [node, 'com.payagent.token', token],
  })

  const setChainData = encodeFunctionData({
    abi: resolverAbi,
    functionName: 'setText',
    args: [node, 'com.payagent.chain', chain],
  })

  const data = encodeFunctionData({
    abi: resolverAbi,
    functionName: 'multicall',
    args: [[setTokenData, setChainData]],
  })

  return {
    to: resolverAddress,
    data,
    value: '0',
    chainId: 1,
  }
}

/**
 * Build transaction data that writes yieldroute.vault text record
 * on the user's ENS resolver.
 */
export async function buildSetYieldVaultTransaction(
  ensName: string,
  vaultAddress: string,
): Promise<{ to: string; data: string; value: string; chainId: number }> {
  const normalized = normalize(ensName)
  const node = namehash(normalized)

  const resolverAddress = await client.getEnsResolver({ name: normalized })
  if (!resolverAddress) {
    throw new Error(`No resolver found for ${ensName}`)
  }

  const data = encodeFunctionData({
    abi: resolverAbi,
    functionName: 'setText',
    args: [node, 'yieldroute.vault', vaultAddress],
  })

  return {
    to: resolverAddress,
    data,
    value: '0',
    chainId: 1,
  }
}

/**
 * Build transaction data that writes flowfi.strategy text record
 * on the user's ENS resolver.
 */
export async function buildSetStrategyTransaction(
  ensName: string,
  strategy: string,
): Promise<{ to: string; data: string; value: string; chainId: number }> {
  const normalized = normalize(ensName)
  const node = namehash(normalized)

  const resolverAddress = await client.getEnsResolver({ name: normalized })
  if (!resolverAddress) {
    throw new Error(`No resolver found for ${ensName}`)
  }

  const data = encodeFunctionData({
    abi: resolverAbi,
    functionName: 'setText',
    args: [node, 'flowfi.strategy', strategy],
  })

  return {
    to: resolverAddress,
    data,
    value: '0',
    chainId: 1,
  }
}

/**
 * Build transaction data that writes both flowfi.strategy and yieldroute.vault
 * text records on the user's ENS resolver via a single multicall.
 */
export async function buildSetStrategyAndVaultTransaction(
  ensName: string,
  strategy: string,
  vaultAddress?: string,
): Promise<{ to: string; data: string; value: string; chainId: number }> {
  const normalized = normalize(ensName)
  const node = namehash(normalized)

  const resolverAddress = await client.getEnsResolver({ name: normalized })
  if (!resolverAddress) {
    throw new Error(`No resolver found for ${ensName}`)
  }

  const calls: `0x${string}`[] = []

  // Always set strategy
  calls.push(
    encodeFunctionData({
      abi: resolverAbi,
      functionName: 'setText',
      args: [node, 'flowfi.strategy', strategy],
    })
  )

  // Optionally set vault (only for yield strategy)
  if (vaultAddress) {
    calls.push(
      encodeFunctionData({
        abi: resolverAbi,
        functionName: 'setText',
        args: [node, 'yieldroute.vault', vaultAddress],
      })
    )
  }

  const data = calls.length === 1
    ? calls[0]
    : encodeFunctionData({
        abi: resolverAbi,
        functionName: 'multicall',
        args: [calls],
      })

  return {
    to: resolverAddress,
    data,
    value: '0',
    chainId: 1,
  }
}

/**
 * Build transaction data that writes flowfi.strategies text record
 * for multi-strategy allocation (e.g., "yield:50,restaking:50").
 */
export async function buildSetStrategiesTransaction(
  ensName: string,
  strategies: string,
): Promise<{ to: string; data: string; value: string; chainId: number }> {
  const normalized = normalize(ensName)
  const node = namehash(normalized)

  const resolverAddress = await client.getEnsResolver({ name: normalized })
  if (!resolverAddress) {
    throw new Error(`No resolver found for ${ensName}`)
  }

  const data = encodeFunctionData({
    abi: resolverAbi,
    functionName: 'setText',
    args: [node, 'flowfi.strategies', strategies],
  })

  return {
    to: resolverAddress,
    data,
    value: '0',
    chainId: 1,
  }
}

/**
 * Build transaction data that writes multiple strategy-related records
 * via a single multicall: flowfi.strategies, flowfi.strategy, yieldroute.vault
 */
export async function buildSetMultiStrategyTransaction(
  ensName: string,
  options: {
    strategies?: string // Multi-strategy: "yield:50,restaking:50"
    strategy?: string // Single strategy fallback
    vaultAddress?: string
  },
): Promise<{ to: string; data: string; value: string; chainId: number }> {
  const normalized = normalize(ensName)
  const node = namehash(normalized)

  const resolverAddress = await client.getEnsResolver({ name: normalized })
  if (!resolverAddress) {
    throw new Error(`No resolver found for ${ensName}`)
  }

  const calls: `0x${string}`[] = []

  // Set multi-strategy allocation if provided
  if (options.strategies) {
    calls.push(
      encodeFunctionData({
        abi: resolverAbi,
        functionName: 'setText',
        args: [node, 'flowfi.strategies', options.strategies],
      })
    )
  }

  // Set single strategy if provided
  if (options.strategy) {
    calls.push(
      encodeFunctionData({
        abi: resolverAbi,
        functionName: 'setText',
        args: [node, 'flowfi.strategy', options.strategy],
      })
    )
  }

  // Set vault address if provided
  if (options.vaultAddress) {
    calls.push(
      encodeFunctionData({
        abi: resolverAbi,
        functionName: 'setText',
        args: [node, 'yieldroute.vault', options.vaultAddress],
      })
    )
  }

  if (calls.length === 0) {
    throw new Error('At least one option must be provided')
  }

  const data = calls.length === 1
    ? calls[0]
    : encodeFunctionData({
        abi: resolverAbi,
        functionName: 'multicall',
        args: [calls],
      })

  return {
    to: resolverAddress,
    data,
    value: '0',
    chainId: 1,
  }
}

/**
 * Invoice data structure for ENS storage
 */
export interface InvoiceData {
  id: string
  amount: string
  token: string
  memo?: string
  createdAt: string
  expiresAt?: string
}

/**
 * Compute a deterministic hash of invoice data for ENS storage.
 * This allows verification without storing full invoice on-chain.
 */
export function computeInvoiceHash(invoice: InvoiceData): string {
  const payload = JSON.stringify({
    id: invoice.id,
    amount: invoice.amount,
    token: invoice.token,
    memo: invoice.memo || '',
    createdAt: invoice.createdAt,
  })
  return keccak256(toHex(payload))
}

/**
 * Build transaction data that writes an invoice hash to ENS text record.
 * Record key: flowfi.invoice.{id}
 * Record value: {hash}:{amount}:{token} (compact format for verification)
 */
export async function buildSetInvoiceTransaction(
  ensName: string,
  invoice: InvoiceData,
): Promise<{ to: string; data: string; value: string; chainId: number; invoiceHash: string }> {
  const normalized = normalize(ensName)
  const node = namehash(normalized)

  const resolverAddress = await client.getEnsResolver({ name: normalized })
  if (!resolverAddress) {
    throw new Error(`No resolver found for ${ensName}`)
  }

  const invoiceHash = computeInvoiceHash(invoice)
  const recordKey = `flowfi.invoice.${invoice.id}`
  // Compact format: hash:amount:token (allows basic verification without full data)
  const recordValue = `${invoiceHash}:${invoice.amount}:${invoice.token}`

  const data = encodeFunctionData({
    abi: resolverAbi,
    functionName: 'setText',
    args: [node, recordKey, recordValue],
  })

  return {
    to: resolverAddress,
    data,
    value: '0',
    chainId: 1,
    invoiceHash,
  }
}

/**
 * Read an invoice hash from ENS text record.
 * Returns null if not found.
 */
export async function getInvoiceFromENS(
  ensName: string,
  invoiceId: string,
): Promise<{ hash: string; amount: string; token: string } | null> {
  try {
    const normalized = normalize(ensName)
    const recordKey = `flowfi.invoice.${invoiceId}`

    const value = await client.getEnsText({ name: normalized, key: recordKey })
    if (!value) return null

    // Parse compact format: hash:amount:token
    const [hash, amount, token] = value.split(':')
    if (!hash || !amount || !token) return null

    return { hash, amount, token }
  } catch {
    return null
  }
}

/**
 * Verify an invoice against its ENS record.
 * Returns true if the invoice data matches the stored hash.
 */
export function verifyInvoice(invoice: InvoiceData, storedHash: string): boolean {
  const computedHash = computeInvoiceHash(invoice)
  return computedHash === storedHash
}
