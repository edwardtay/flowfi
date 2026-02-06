'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Invoice {
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function InvoicePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ensVerified, setEnsVerified] = useState<boolean | null>(null)
  const [ensRecordKey, setEnsRecordKey] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    fetch(`/api/invoice?id=${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Invoice not found')
        return res.json()
      })
      .then(setInvoice)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  // Check ENS verification
  useEffect(() => {
    if (!invoice?.receiverEns || !id) return

    fetch(`/api/invoice/ens?ensName=${encodeURIComponent(invoice.receiverEns)}&id=${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.verified) {
          setEnsVerified(true)
          setEnsRecordKey(data.recordKey)
        } else {
          setEnsVerified(false)
        }
      })
      .catch(() => setEnsVerified(false))
  }, [invoice?.receiverEns, id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#1C1B18] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
        <Card className="border-[#E4E2DC] bg-white max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#FFF3E0] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#E65100]">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-[#1C1B18] mb-2">Invoice Not Found</h1>
            <p className="text-[#6B6960] mb-4">This invoice may have been deleted or never existed.</p>
            <Link href="/" className="text-[#1C1B18] underline">Go Home</Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isPaid = invoice.status === 'paid'
  const isExpired = invoice.status === 'expired'
  const displayName = invoice.receiverEns || formatAddress(invoice.receiverAddress)

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-sm text-[#6B6960] font-mono">INVOICE #{invoice.id.toUpperCase()}</p>
        </div>

        <Card className="border-[#E4E2DC] bg-white">
          <CardContent className="p-6 space-y-6">
            {/* Status Badge */}
            <div className="flex justify-center">
              {isPaid && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EDF5F0] text-[#22C55E] text-sm font-medium">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Paid
                </div>
              )}
              {isExpired && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFF3E0] text-[#E65100] text-sm font-medium">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Expired
                </div>
              )}
              {!isPaid && !isExpired && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F8F7F4] text-[#6B6960] text-sm font-medium">
                  <div className="w-2 h-2 rounded-full bg-[#FFC107] animate-pulse" />
                  Awaiting Payment
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="text-center">
              <p className="text-4xl font-bold text-[#1C1B18]">
                {parseFloat(invoice.amount).toLocaleString()} {invoice.token}
              </p>
              <p className="text-sm text-[#6B6960] mt-1">to {displayName}</p>
            </div>

            {/* Memo */}
            {invoice.memo && (
              <div className="rounded-lg bg-[#F8F7F4] p-4">
                <p className="text-xs text-[#9C9B93] mb-1">MEMO</p>
                <p className="text-[#1C1B18]">{invoice.memo}</p>
              </div>
            )}

            {/* ENS Verification Badge */}
            {ensVerified === true && (
              <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#5298FF]/10 text-[#5298FF] text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-medium">Verified on ENS</span>
                {ensRecordKey && (
                  <span className="text-xs opacity-70 font-mono">{ensRecordKey}</span>
                )}
              </div>
            )}

            {/* Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6B6960]">Created</span>
                <span className="text-[#1C1B18]">{formatDate(invoice.createdAt)}</span>
              </div>
              {invoice.expiresAt && !isPaid && (
                <div className="flex justify-between">
                  <span className="text-[#6B6960]">Expires</span>
                  <span className={isExpired ? 'text-[#E65100]' : 'text-[#1C1B18]'}>
                    {formatDate(invoice.expiresAt)}
                  </span>
                </div>
              )}
              {invoice.paidAt && (
                <div className="flex justify-between">
                  <span className="text-[#6B6960]">Paid</span>
                  <span className="text-[#22C55E]">{formatDate(invoice.paidAt)}</span>
                </div>
              )}
            </div>

            {/* Pay Button */}
            {!isPaid && !isExpired && (
              <Button
                onClick={() => {
                  const payUrl = invoice.receiverEns
                    ? `/pay/${invoice.receiverEns}?invoice=${invoice.id}&amount=${invoice.amount}`
                    : `/pay/${invoice.receiverAddress}?invoice=${invoice.id}&amount=${invoice.amount}`
                  router.push(payUrl)
                }}
                className="w-full h-12 bg-[#1C1B18] hover:bg-[#2D2C28] text-white font-medium"
              >
                Pay {parseFloat(invoice.amount).toLocaleString()} {invoice.token}
              </Button>
            )}

            {/* Paid Transaction */}
            {isPaid && invoice.paidTxHash && (
              <a
                href={`https://basescan.org/tx/${invoice.paidTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-sm text-[#6B6960] hover:text-[#1C1B18] underline"
              >
                View transaction
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
