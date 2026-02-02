import { createPublicClient, http } from 'viem'
import { normalize } from 'viem/ens'
import { mainnet } from 'viem/chains'
import type { ENSResolution } from '@/lib/types'

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL || 'https://eth.llamarpc.com'),
})

/**
 * Resolve an ENS name to an address and read PayAgent-specific + standard text records.
 *
 * Custom records:
 *   com.payagent.chain     – receiver's preferred destination chain
 *   com.payagent.token     – receiver's preferred token
 *   com.payagent.slippage  – receiver's preferred max slippage (e.g. "0.5")
 *   com.payagent.maxFee    – max acceptable fee in USD   (e.g. "1.00")
 *
 * Standard records:
 *   avatar                 – ENS avatar URL
 *   description            – profile description
 */
export async function resolveENS(name: string): Promise<ENSResolution> {
  const normalized = normalize(name)
  const address = await client.getEnsAddress({ name: normalized })

  let preferredChain: string | undefined
  let preferredToken: string | undefined
  let preferredSlippage: string | undefined
  let maxFee: string | undefined
  let avatar: string | undefined
  let description: string | undefined

  try {
    const keys = [
      'com.payagent.chain',
      'com.payagent.token',
      'com.payagent.slippage',
      'com.payagent.maxFee',
      'avatar',
      'description',
    ] as const

    const results = await Promise.all(
      keys.map((key) =>
        client
          .getEnsText({ name: normalized, key })
          .then((v) => v || undefined)
          .catch(() => undefined),
      ),
    )

    preferredChain = results[0]
    preferredToken = results[1]
    preferredSlippage = results[2]
    maxFee = results[3]
    avatar = results[4]
    description = results[5]
  } catch {
    // Text records not set, that's fine
  }

  return {
    address,
    preferredChain,
    preferredToken,
    preferredSlippage,
    maxFee,
    avatar,
    description,
  }
}
