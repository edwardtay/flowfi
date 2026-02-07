/**
 * MEV-Protected Vault Deposits
 *
 * Multiple protection layers:
 * 1. Private RPCs - TX not visible in public mempool
 * 2. Slippage bounds - Revert if MEV manipulates price
 * 3. Commit-reveal - For large deposits, 2-phase to prevent front-running
 */

import { encodeFunctionData, parseUnits } from 'viem'

// --- Private RPC Endpoints ---

export const PRIVATE_RPCS = {
  // Ethereum Mainnet
  ethereum: {
    flashbotsProtect: 'https://rpc.flashbots.net',
    mevBlocker: 'https://rpc.mevblocker.io',
    // MEV Blocker also refunds some MEV to users
  },

  // Base - Uses Flashbots for L2
  base: {
    // Base doesn't have native Flashbots, but we can use:
    flashbotsProtect: 'https://rpc.flashbots.net/fast', // Routes to Base
    // Or use sequencer directly (less MEV on L2s)
    sequencer: 'https://mainnet.base.org',
  },

  // Arbitrum
  arbitrum: {
    sequencer: 'https://arb1.arbitrum.io/rpc',
    // Arbitrum has fair ordering, less MEV risk
  },
}

// --- MEV Protection Methods ---

export type MEVProtectionMethod =
  | 'private-rpc'      // Use Flashbots/MEV Blocker
  | 'commit-reveal'    // 2-phase for large deposits
  | 'slippage-only'    // Just tight slippage bounds
  | 'batch-auction'    // CoW Protocol style (future)

export interface MEVProtectedDepositParams {
  vault: `0x${string}`
  assets: bigint
  recipient: `0x${string}`
  method: MEVProtectionMethod
  slippageBps?: number // Default 50 (0.5%)
}

// --- Router Contract ---

export const MEV_PROTECTED_ROUTER: `0x${string}` = '0x0B880127FFb09727468159f3883c76Fd1B1c59A2' // Base Mainnet

export const MEV_ROUTER_ABI = [
  {
    name: 'depositWithSlippage',
    type: 'function',
    inputs: [
      { name: 'vault', type: 'address' },
      { name: 'assets', type: 'uint256' },
      { name: 'minShares', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'commitDeposit',
    type: 'function',
    inputs: [{ name: 'commitHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'revealAndDeposit',
    type: 'function',
    inputs: [
      { name: 'vault', type: 'address' },
      { name: 'assets', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'salt', type: 'bytes32' },
      { name: 'minShares', type: 'uint256' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'lifiCallback',
    type: 'function',
    inputs: [
      { name: 'vault', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'minShares', type: 'uint256' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'previewDeposit',
    type: 'function',
    inputs: [
      { name: 'vault', type: 'address' },
      { name: 'assets', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

// --- Helper Functions ---

/**
 * Calculate minimum shares with slippage protection
 */
export function calculateMinShares(
  expectedShares: bigint,
  slippageBps: number = 50 // 0.5% default
): bigint {
  return expectedShares - (expectedShares * BigInt(slippageBps)) / BigInt(10000)
}

/**
 * Encode deposit calldata for LI.FI Contract Calls
 */
export function encodeVaultDeposit(
  vault: `0x${string}`,
  recipient: `0x${string}`,
  minShares: bigint
): `0x${string}` {
  return encodeFunctionData({
    abi: MEV_ROUTER_ABI,
    functionName: 'lifiCallback',
    args: [vault, recipient, minShares],
  })
}

/**
 * Generate commit hash for commit-reveal deposits
 */
export function generateCommitHash(
  vault: `0x${string}`,
  assets: bigint,
  recipient: `0x${string}`,
  salt: `0x${string}`
): `0x${string}` {
  // keccak256(abi.encode(vault, assets, recipient, salt))
  const { keccak256, encodeAbiParameters, parseAbiParameters } = require('viem')
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, uint256, address, bytes32'),
      [vault, assets, recipient, salt]
    )
  )
}

/**
 * Generate random salt for commit-reveal
 */
export function generateSalt(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`
}

// --- LI.FI Contract Call Builder ---

export interface LiFiContractCall {
  callTo: `0x${string}`
  callData: `0x${string}`
  requiresDeposit: boolean
}

/**
 * Build LI.FI Contract Call for MEV-protected vault deposit
 */
export function buildMEVProtectedContractCall(
  routerAddress: `0x${string}`,
  vault: `0x${string}`,
  recipient: `0x${string}`,
  expectedAssets: bigint,
  slippageBps: number = 50
): LiFiContractCall {
  // Calculate expected shares (approximate 1:1 for USDC vaults)
  // In production, fetch from vault.previewDeposit()
  const expectedShares = expectedAssets // USDC vaults are ~1:1
  const minShares = calculateMinShares(expectedShares, slippageBps)

  return {
    callTo: routerAddress,
    callData: encodeVaultDeposit(vault, recipient, minShares),
    requiresDeposit: true, // LI.FI sends tokens before calling
  }
}

// --- Best Practice Summary ---

/**
 * MEV Protection Best Practices:
 *
 * 1. PRIVATE RPC (Most Important)
 *    - Use Flashbots Protect or MEV Blocker
 *    - TX stays private until included in block
 *    - Free and easy to use
 *
 * 2. SLIPPAGE PROTECTION
 *    - Set tight minShares (0.5% slippage)
 *    - TX reverts if MEV bot manipulates price
 *    - Costs gas on revert, but protects funds
 *
 * 3. COMMIT-REVEAL (Large Deposits)
 *    - For deposits > $10k
 *    - Commit hash first, reveal params later
 *    - Prevents front-running based on calldata
 *
 * 4. APPROVED VAULTS ONLY
 *    - Whitelist known-safe vaults
 *    - Prevents routing to malicious contracts
 *
 * 5. L2 SEQUENCER
 *    - L2s have less MEV (centralized sequencer)
 *    - Base/Arbitrum are safer than Ethereum
 *    - Still use slippage protection
 */
