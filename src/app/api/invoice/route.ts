import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

// In-memory store for MVP (replace with DB in production)
const invoices = new Map<string, Invoice>()

export interface Invoice {
  id: string
  receiverAddress: string
  receiverEns?: string
  amount: string
  token: string
  memo?: string
  status: 'pending' | 'paid' | 'expired'
  createdAt: string
  paidAt?: string
  paidTxHash?: string
  expiresAt?: string
}

/**
 * GET /api/invoice?id=xxx - Get invoice by ID
 * POST /api/invoice - Create new invoice
 * PATCH /api/invoice - Update invoice status (mark as paid)
 */

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing invoice ID' }, { status: 400 })
  }

  const invoice = invoices.get(id)
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Check if expired
  if (invoice.expiresAt && new Date(invoice.expiresAt) < new Date() && invoice.status === 'pending') {
    invoice.status = 'expired'
    invoices.set(id, invoice)
  }

  return NextResponse.json(invoice)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { receiverAddress, receiverEns, amount, token, memo, expiresInHours } = body as {
      receiverAddress: string
      receiverEns?: string
      amount: string
      token?: string
      memo?: string
      expiresInHours?: number
    }

    if (!receiverAddress || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: receiverAddress, amount' },
        { status: 400 }
      )
    }

    const id = randomUUID().slice(0, 8) // Short ID for readability
    const now = new Date()
    const expiresAt = expiresInHours
      ? new Date(now.getTime() + expiresInHours * 60 * 60 * 1000).toISOString()
      : undefined

    const invoice: Invoice = {
      id,
      receiverAddress,
      receiverEns,
      amount,
      token: token || 'USDC',
      memo,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt,
    }

    invoices.set(id, invoice)

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Invoice creation error:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, txHash } = body as {
      id: string
      status: 'paid'
      txHash?: string
    }

    if (!id || status !== 'paid') {
      return NextResponse.json(
        { error: 'Missing id or invalid status (only "paid" supported)' },
        { status: 400 }
      )
    }

    const invoice = invoices.get(id)
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 })
    }

    invoice.status = 'paid'
    invoice.paidAt = new Date().toISOString()
    invoice.paidTxHash = txHash

    invoices.set(id, invoice)

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Invoice update error:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}
