import { type Chain, createPublicClient, http } from 'viem'
import { mainnet, base, optimism, arbitrum } from 'viem/chains'
import { normalize } from 'viem/ens'

/**
 * Multichain ENS utilities following ERC-7828 and ENSIP-19.
 */

/** Map of chain IDs to human-readable short names used in ERC-7828 notation. */
const CHAIN_SHORT_NAMES: Record<number, string> = {
  1: 'eth',
  8453: 'base',
  10: 'optimism',
  42161: 'arbitrum',
}

/** viem chain objects keyed by chain ID, used to build per-chain clients. */
const CHAIN_OBJECTS: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  10: optimism,
  42161: arbitrum,
}

/** Mainnet client used as fallback for reverse resolution. */
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL || 'https://eth.llamarpc.com'),
})

/**
 * Format an ENS name using ERC-7828 cross-chain notation.
 *
 * @example
 *   formatChainAddress('vitalik.eth', 'base')   // => "vitalik.eth@base"
 *   formatChainAddress('nick.eth', 'arbitrum')   // => "nick.eth@arbitrum"
 */
export function formatChainAddress(name: string, chain: string): string {
  return `${name}@${chain}`
}

/**
 * Perform reverse resolution for an address on a specific chain, following
 * the ENSIP-19 pattern:
 *
 *   1. Try resolving on the L2 chain first (if a client can be built).
 *   2. Fall back to L1 mainnet reverse resolution.
 *
 * Returns the primary ENS name if found, or `null`.
 */
export async function getMultichainName(
  address: string,
  chainId: number,
): Promise<string | null> {
  const addr = address as `0x${string}`

  // 1. Try L2-specific reverse resolution when not on mainnet
  if (chainId !== 1) {
    const chainObj = CHAIN_OBJECTS[chainId]
    if (chainObj) {
      try {
        const l2Client = createPublicClient({
          chain: chainObj,
          transport: http(),
        })
        const l2Name = await l2Client.getEnsName({ address: addr })
        if (l2Name) return l2Name
      } catch {
        // L2 reverse record unavailable — fall through to mainnet
      }
    }
  }

  // 2. Fallback: mainnet reverse resolution
  try {
    const name = await mainnetClient.getEnsName({ address: addr })
    return name ?? null
  } catch {
    return null
  }
}

/**
 * Convenience helper: resolve a name to an address on a specific chain
 * using the ERC-7828 format, then return both the resolved address and
 * the formatted multichain name.
 */
export async function resolveMultichainName(
  name: string,
  chainId: number,
): Promise<{ address: string | null; multichainName: string | null }> {
  const normalized = normalize(name)
  const address = await mainnetClient.getEnsAddress({ name: normalized })
  const shortName = CHAIN_SHORT_NAMES[chainId]
  const multichainName = shortName
    ? formatChainAddress(name, shortName)
    : null
  return { address, multichainName }
}
