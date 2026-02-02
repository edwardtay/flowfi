import type { ReceiptTextRecords } from '@/lib/types'

/**
 * Payment receipt subname utilities.
 *
 * These are pure data-structure helpers. Actual on-chain subname creation
 * would require a registrar / name-wrapper contract interaction.
 */

/** Default parent name under which receipt subnames live. */
const DEFAULT_PARENT = 'payments.payagent.eth'

/**
 * Generate a deterministic receipt subname from a transaction hash.
 *
 * @example
 *   generateReceiptSubname('0xabc123def456')
 *   // => "tx-0xabc123def456.payments.payagent.eth"
 *
 *   generateReceiptSubname('0xabc123def456', 'receipts.mydapp.eth')
 *   // => "tx-0xabc123def456.receipts.mydapp.eth"
 */
export function generateReceiptSubname(
  txHash: string,
  parentName: string = DEFAULT_PARENT,
): string {
  // Normalise the hash to lowercase for consistency
  const normalizedHash = txHash.toLowerCase()
  return `tx-${normalizedHash}.${parentName}`
}

/**
 * Build a set of ENS text records that encode the details of a payment
 * receipt. These records can be set on the subname produced by
 * `generateReceiptSubname`.
 *
 * @returns A plain object whose keys are ENS text-record keys.
 */
export function buildReceiptTextRecords(
  txHash: string,
  amount: string,
  token: string,
  chain: string,
  recipient: string,
): ReceiptTextRecords {
  return {
    'com.payagent.tx': txHash,
    'com.payagent.amount': amount,
    'com.payagent.token': token,
    'com.payagent.chain': chain,
    'com.payagent.recipient': recipient,
    'com.payagent.timestamp': new Date().toISOString(),
  }
}
