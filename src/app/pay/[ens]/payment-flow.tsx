'use client'

import { useState, useEffect } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ENSResolution } from '@/lib/types'

interface Props {
  ensName: string
}

export function PaymentFlow({ ensName }: Props) {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const [amount, setAmount] = useState('')
  const [recipientInfo, setRecipientInfo] = useState<ENSResolution | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch recipient ENS info
  useEffect(() => {
    async function fetchRecipient() {
      try {
        const res = await fetch(`/api/ens/resolve?name=${encodeURIComponent(ensName)}`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to resolve ENS')
        }
        const data = await res.json()
        setRecipientInfo(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load recipient')
      } finally {
        setLoading(false)
      }
    }
    fetchRecipient()
  }, [ensName])

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#1C1B18]">
          Resolving {ensName}...
        </h1>
        <Card className="border-[#E4E2DC] bg-white">
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-[#1C1B18] border-t-transparent rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !recipientInfo?.address) {
    return (
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#1C1B18]">
          Payment Error
        </h1>
        <Card className="border-[#E4E2DC] bg-white">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-red-600">
                <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-[#1C1B18] font-medium mb-2">
              Could not resolve {ensName}
            </p>
            <p className="text-sm text-[#6B6960]">
              {error || 'This ENS name may not exist or has no address set.'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasYieldVault = recipientInfo.yieldVault &&
    recipientInfo.yieldVault !== '0x0000000000000000000000000000000000000000'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#1C1B18] mb-2">
          Pay {ensName}
        </h1>
        <p className="text-sm text-[#6B6960] font-mono">
          {recipientInfo.address?.slice(0, 6)}...{recipientInfo.address?.slice(-4)}
        </p>
      </div>

      {/* Yield indicator */}
      {hasYieldVault && (
        <div className="rounded-xl bg-[#EDF5F0] border border-[#B7D4C7] p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2D6A4F] flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[#2D6A4F]">
                Yield-enabled recipient
              </p>
              <p className="text-xs text-[#2D6A4F]/70 mt-0.5">
                Funds will be automatically deposited into their yield vault
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Payment form */}
      <Card className="border-[#E4E2DC] bg-white">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-[#1C1B18]">
            Send Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Amount input */}
          <div>
            <label className="text-sm font-medium text-[#1C1B18] mb-1.5 block">
              Amount
            </label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-16 h-12 text-lg border-[#E4E2DC] focus:border-[#1C1B18] focus:ring-[#1C1B18]"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6B6960]">
                USDC
              </div>
            </div>
          </div>

          {/* Recipient preferences */}
          {(recipientInfo.preferredToken || recipientInfo.preferredChain) && (
            <div className="rounded-lg bg-[#F8F7F4] p-3 text-sm">
              <p className="text-[#6B6960]">
                Recipient prefers{' '}
                {recipientInfo.preferredToken && (
                  <span className="font-medium text-[#1C1B18]">
                    {recipientInfo.preferredToken}
                  </span>
                )}
                {recipientInfo.preferredToken && recipientInfo.preferredChain && ' on '}
                {recipientInfo.preferredChain && (
                  <span className="font-medium text-[#1C1B18]">
                    {recipientInfo.preferredChain}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Connect / Pay button */}
          {!isConnected ? (
            <div className="pt-2">
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <Button
                    onClick={openConnectModal}
                    className="w-full h-12 bg-[#1C1B18] hover:bg-[#2D2C28] text-white font-medium"
                  >
                    Connect Wallet
                  </Button>
                )}
              </ConnectButton.Custom>
            </div>
          ) : (
            <Button
              className="w-full h-12 bg-[#1C1B18] hover:bg-[#2D2C28] text-white font-medium"
              disabled={!amount || parseFloat(amount) <= 0}
            >
              {amount && parseFloat(amount) > 0
                ? `Pay $${parseFloat(amount).toFixed(2)} USDC`
                : 'Enter amount'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Info footer */}
      <p className="text-xs text-center text-[#6B6960]">
        Powered by LI.FI cross-chain routing
        {hasYieldVault && ' + YieldRoute auto-deposit'}
      </p>
    </div>
  )
}
