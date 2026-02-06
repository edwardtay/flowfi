import { NextRequest, NextResponse } from 'next/server'
import { buildSetInvoiceTransaction, getInvoiceFromENS, type InvoiceData } from '@/lib/ens/write'

/**
 * POST /api/invoice/ens - Build transaction to store invoice in ENS
 * GET /api/invoice/ens?ensName=xxx&id=yyy - Read invoice from ENS
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { ensName, invoice } = body as {
      ensName: string
      invoice: InvoiceData
    }

    if (!ensName || !invoice?.id || !invoice?.amount) {
      return NextResponse.json(
        { error: 'Missing required fields: ensName, invoice.id, invoice.amount' },
        { status: 400 }
      )
    }

    const txData = await buildSetInvoiceTransaction(ensName, invoice)

    return NextResponse.json({
      ...txData,
      message: `Store invoice ${invoice.id} in ENS record: flowfi.invoice.${invoice.id}`,
    })
  } catch (error) {
    console.error('Invoice ENS write error:', error)
    const message = error instanceof Error ? error.message : 'Failed to build ENS transaction'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const ensName = req.nextUrl.searchParams.get('ensName')
    const id = req.nextUrl.searchParams.get('id')

    if (!ensName || !id) {
      return NextResponse.json(
        { error: 'Missing required params: ensName, id' },
        { status: 400 }
      )
    }

    const record = await getInvoiceFromENS(ensName, id)

    if (!record) {
      return NextResponse.json(
        { error: 'Invoice not found in ENS', verified: false },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...record,
      ensName,
      invoiceId: id,
      recordKey: `flowfi.invoice.${id}`,
      verified: true,
    })
  } catch (error) {
    console.error('Invoice ENS read error:', error)
    const message = error instanceof Error ? error.message : 'Failed to read from ENS'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
