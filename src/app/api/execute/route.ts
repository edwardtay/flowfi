import { NextRequest, NextResponse } from 'next/server'
import { getTransactionData } from '@/lib/routing/execute-route'
import { buildSetPreferenceTransaction } from '@/lib/ens/write'
import type { ParsedIntent } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { routeId, fromAddress, intent, slippage, ensName } = body as {
      routeId: string
      fromAddress: string
      intent: ParsedIntent
      slippage?: number
      ensName?: string
    }

    // ENS preference write — returns resolver multicall tx directly
    if (routeId === 'ens-preference') {
      if (!ensName) {
        return NextResponse.json(
          { error: 'Missing ensName for ENS preference write' },
          { status: 400 },
        )
      }
      const txData = await buildSetPreferenceTransaction(
        ensName,
        intent?.toToken || 'USDC',
        intent?.toChain || 'base',
      )
      return NextResponse.json(txData)
    }

    // Detect v4 route and pass provider hint
    const provider = routeId?.startsWith('v4-') ? 'Uniswap v4' : undefined

    if (!fromAddress || !intent) {
      return NextResponse.json(
        { error: 'Missing fromAddress or intent' },
        { status: 400 }
      )
    }

    // Deposit/yield intents resolve the vault token internally, so toToken
    // is not required for those actions.
    const isComposerAction =
      intent.action === 'deposit' || intent.action === 'yield'

    if (!intent.fromToken || !intent.amount) {
      return NextResponse.json(
        { error: 'Incomplete intent: fromToken and amount required' },
        { status: 400 }
      )
    }

    if (!isComposerAction && !intent.toToken) {
      return NextResponse.json(
        { error: 'Incomplete intent: toToken required for transfer/swap' },
        { status: 400 }
      )
    }

    const txData = await getTransactionData(intent, fromAddress, slippage, provider)

    return NextResponse.json(txData)
  } catch (error: unknown) {
    console.error('Execute API error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to prepare transaction'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
