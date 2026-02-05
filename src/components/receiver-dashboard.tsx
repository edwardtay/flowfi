'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSendTransaction, useSwitchChain } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

// Vault options with their underlying token
const VAULT_OPTIONS = [
  {
    id: 'aave-usdc',
    address: '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB',
    name: 'Aave USDC',
    token: 'USDC',
    protocol: 'Aave v3',
    chain: 'Base',
  },
  {
    id: 'morpho-usdc',
    address: '0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A',
    name: 'Morpho USDC',
    token: 'USDC',
    protocol: 'Morpho',
    chain: 'Base',
  },
  {
    id: 'none',
    address: '',
    name: 'No Yield',
    token: 'USDC',
    protocol: 'Direct to wallet',
    chain: 'Base',
  },
] as const

type VaultPosition = {
  shares: string
  assets: string
  apy: string
  earned: string
}

type Receipt = {
  txHash: string
  amount: string
  token: string
  chain: string
  from: string
  createdAt: string
}

function useEnsName(address?: string) {
  const [name, setName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address) {
      setName(null)
      return
    }

    setLoading(true)
    fetch(`/api/ens/primary-name?address=${address}&chainId=1`)
      .then((r) => r.json())
      .then((data) => setName(data.name ?? null))
      .catch(() => setName(null))
      .finally(() => setLoading(false))
  }, [address])

  return { name, loading }
}

function useEnsPreferences(ensName: string | null) {
  const [vault, setVault] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ensName) {
      setVault(null)
      setAvatar(null)
      setDescription(null)
      return
    }

    setLoading(true)
    fetch(`/api/ens/resolve?name=${encodeURIComponent(ensName)}`)
      .then((r) => r.json())
      .then((data) => {
        setVault(data.yieldVault ?? null)
        setDescription(data.description ?? null)
        // Convert IPFS URL to HTTP gateway
        if (data.avatar) {
          const avatarUrl = data.avatar.startsWith('ipfs://')
            ? `https://ipfs.io/ipfs/${data.avatar.slice(7)}`
            : data.avatar
          setAvatar(avatarUrl)
        }
      })
      .catch(() => {
        setVault(null)
        setAvatar(null)
        setDescription(null)
      })
      .finally(() => setLoading(false))
  }, [ensName])

  return { vault, avatar, description, loading }
}

function useReceipts(address?: string) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address) {
      setReceipts([])
      return
    }

    setLoading(true)
    fetch(`/api/ens/receipts?recipient=${address}`)
      .then((r) => r.json())
      .then((data) => setReceipts(data.receipts ?? []))
      .catch(() => setReceipts([]))
      .finally(() => setLoading(false))
  }, [address])

  return { receipts, loading }
}

function useVaultPosition(vaultAddress?: string, userAddress?: string) {
  const [position, setPosition] = useState<VaultPosition | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!vaultAddress || !userAddress) {
      setPosition(null)
      return
    }

    setLoading(true)
    fetch(`/api/vault/position?user=${userAddress}&vault=${vaultAddress}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setPosition(null)
        } else {
          setPosition(data)
        }
      })
      .catch(() => setPosition(null))
      .finally(() => setLoading(false))
  }, [vaultAddress, userAddress])

  return { position, loading }
}

// Fetch APY for all vaults on mount
function useVaultApys() {
  const [apys, setApys] = useState<Record<string, string>>({})

  useEffect(() => {
    // Fetch APY for each vault
    VAULT_OPTIONS.forEach(async (vault) => {
      if (vault.id === 'none' || !vault.address) return
      try {
        const res = await fetch(`/api/vault/position?user=0x0000000000000000000000000000000000000000&vault=${vault.address}`)
        const data = await res.json()
        if (data.apy) {
          setApys(prev => ({ ...prev, [vault.id]: data.apy }))
        }
      } catch {
        // Keep default
      }
    })
  }, [])

  return apys
}

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ReceiverDashboard() {
  const { address, isConnected, chainId } = useAccount()
  const { sendTransactionAsync } = useSendTransaction()
  const { switchChainAsync } = useSwitchChain()
  const { name: ensName, loading: ensLoading } = useEnsName(address)
  const { vault: currentVault, avatar: ensAvatar, description: ensDescription, loading: prefsLoading } = useEnsPreferences(ensName)
  const { receipts, loading: receiptsLoading } = useReceipts(address)
  const vaultApys = useVaultApys()
  const { position: vaultPosition, loading: positionLoading } = useVaultPosition(currentVault ?? undefined, address)

  const [selectedVaultId, setSelectedVaultId] = useState<string>('')
  const [customVault, setCustomVault] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveTxHash, setSaveTxHash] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [requestAmount, setRequestAmount] = useState('')

  // Sync selected vault with loaded preference
  useEffect(() => {
    if (currentVault && !selectedVaultId) {
      const found = VAULT_OPTIONS.find(v => v.address.toLowerCase() === currentVault.toLowerCase())
      if (found) {
        setSelectedVaultId(found.id)
      } else if (currentVault) {
        setSelectedVaultId('custom')
        setCustomVault(currentVault)
      }
    }
  }, [currentVault, selectedVaultId])

  const selectedVault = VAULT_OPTIONS.find(v => v.id === selectedVaultId)
  const vaultAddress = selectedVaultId === 'custom' ? customVault : selectedVault?.address || ''

  // Check if vault changed from current
  const vaultChanged = currentVault
    ? vaultAddress.toLowerCase() !== currentVault.toLowerCase()
    : vaultAddress !== ''

  const handleSaveVault = async () => {
    if (!vaultAddress || !ensName || selectedVaultId === 'none') return

    setSaving(true)
    setSaveSuccess(false)
    setSaveTxHash(null)
    setSaveError(null)

    try {
      // Switch to mainnet if needed (ENS is on mainnet)
      if (chainId !== 1) {
        await switchChainAsync({ chainId: 1 })
      }

      const res = await fetch('/api/ens/set-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ensName, vaultAddress }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to prepare transaction')
      }

      const txData = await res.json()

      const hash = await sendTransactionAsync({
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: BigInt(txData.value || 0),
      })

      setSaveTxHash(hash)
      setSaveSuccess(true)
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Transaction failed'
      if (/rejected|denied|user refused/i.test(errMessage)) {
        setSaveError('Transaction rejected')
      } else {
        setSaveError(errMessage)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = () => {
    const base = `${window.location.origin}/pay/${ensName}`
    const link = requestAmount ? `${base}?amount=${requestAmount}` : base
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Calculate totals from receipts
  const totalReceived = receipts.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0)

  // Not connected
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-[#1C1B18] to-[#3D3C38] flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-[#F8F7F4]">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-3xl font-semibold text-[#1C1B18] mb-3">Accept Any Token</h1>
        <p className="text-[#6B6960] mb-8 text-center max-w-md text-lg">
          Get paid in any token on any chain. Auto-convert to USDC and earn yield.
        </p>
        <ConnectButton />
      </div>
    )
  }

  // Loading
  if (ensLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-spin w-8 h-8 border-2 border-[#1C1B18] border-t-transparent rounded-full" />
      </div>
    )
  }

  // No ENS
  if (!ensName) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="w-20 h-20 mb-6 rounded-2xl bg-[#FFF3E0] flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-[#E65100]">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-[#1C1B18] mb-2">ENS Name Required</h1>
        <p className="text-[#6B6960] mb-6 text-center max-w-sm">
          Get an ENS name to create your payment link and configure yield settings.
        </p>
        <a
          href="https://app.ens.domains"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1C1B18] text-white font-medium hover:bg-[#2D2C28] transition-colors"
        >
          Get ENS Name
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>
    )
  }

  const basePaymentLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${ensName}`
  const paymentLink = requestAmount ? `${basePaymentLink}?amount=${requestAmount}` : basePaymentLink

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* ENS Info Card */}
      <Card className="border-[#E4E2DC] bg-white">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* ENS Avatar or Placeholder */}
            {ensAvatar ? (
              <img
                src={ensAvatar}
                alt={ensName || 'ENS Avatar'}
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#627EEA] to-[#C99FFF] flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-white">
                  {ensName?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-[#1C1B18]">{ensName}</h1>
                {currentVault ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#EDF5F0] border border-[#B7D4C7]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                    <span className="text-xs font-medium text-[#2D6A4F]">Configured</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#FFF3E0] border border-[#FFCC80]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F57C00]" />
                    <span className="text-xs font-medium text-[#E65100]">Not Set</span>
                  </div>
                )}
              </div>
              <p className="text-xs font-mono text-[#6B6960] mt-1">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
              {ensDescription && (
                <p className="text-sm text-[#6B6960] mt-1">{ensDescription}</p>
              )}

              {/* ENS Records */}
              <div className="mt-3 pt-3 border-t border-[#E4E2DC] space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#6B6960]">yieldroute.vault</span>
                  {currentVault ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#1C1B18]">
                        {currentVault.slice(0, 6)}...{currentVault.slice(-4)}
                      </span>
                      <a
                        href={`https://basescan.org/address/${currentVault}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#627EEA] hover:underline"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </a>
                    </div>
                  ) : (
                    <span className="text-[#9C9B93] italic">not set</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#6B6960]">Vault Chain</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-[#0052FF] flex items-center justify-center">
                      <span className="text-[8px] font-bold text-white">B</span>
                    </div>
                    <span className="text-[#1C1B18]">Base</span>
                    <span className="text-[#9C9B93] text-xs">(8453)</span>
                  </div>
                </div>
              </div>

              {/* View on ENS link */}
              <a
                href={`https://app.ens.domains/${ensName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#627EEA] hover:underline mt-3"
              >
                View on ENS
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Yield Vault Selection - First */}
      <Card className="border-[#E4E2DC] bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-[#1C1B18]">
                Yield Strategy
              </CardTitle>
              <p className="text-sm text-[#6B6960]">
                Saved to your ENS text record
              </p>
            </div>
            {currentVault && !vaultChanged && (
              <span className="text-xs text-[#22C55E] font-medium">On-chain</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {VAULT_OPTIONS.map((vault) => (
            <button
              key={vault.id}
              onClick={() => setSelectedVaultId(vault.id)}
              className={`w-full p-4 rounded-xl border-2 transition-all cursor-pointer text-left flex items-center justify-between ${
                selectedVaultId === vault.id
                  ? 'border-[#1C1B18] bg-[#FAFAF8]'
                  : 'border-[#E4E2DC] hover:border-[#C9C7BF]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  vault.id === 'none' ? 'bg-[#F8F7F4]' : 'bg-[#EDF5F0]'
                }`}>
                  {vault.id === 'none' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#6B6960]">
                      <path d="M21 12H3M21 12L15 6M21 12L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#22C55E]">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div>
                  <p className="font-medium text-[#1C1B18]">{vault.name}</p>
                  <p className="text-sm text-[#6B6960]">{vault.protocol}</p>
                </div>
              </div>
              {vault.id !== 'none' && (
                <div className="text-right">
                  <p className="font-semibold text-[#22C55E]">
                    {vaultApys[vault.id] ?? '—'}%
                  </p>
                  <p className="text-xs text-[#6B6960]">APY</p>
                </div>
              )}
            </button>
          ))}

          {/* Custom vault option */}
          <button
            onClick={() => setSelectedVaultId('custom')}
            className={`w-full p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
              selectedVaultId === 'custom'
                ? 'border-[#1C1B18] bg-[#FAFAF8]'
                : 'border-[#E4E2DC] hover:border-[#C9C7BF]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F8F7F4] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#6B6960]">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="font-medium text-[#1C1B18]">Custom Vault</p>
                <p className="text-sm text-[#6B6960]">Any ERC-4626 vault on Base</p>
              </div>
            </div>
          </button>

          {selectedVaultId === 'custom' && (
            <Input
              placeholder="0x... vault address"
              value={customVault}
              onChange={(e) => setCustomVault(e.target.value)}
              className="font-mono border-[#E4E2DC] mt-2"
            />
          )}

          {/* Save button - only show if changed */}
          {vaultChanged && selectedVaultId !== 'none' && vaultAddress && (
            <Button
              onClick={handleSaveVault}
              disabled={saving}
              className="w-full bg-[#1C1B18] hover:bg-[#2D2C28] text-white mt-4"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Confirm in wallet...
                </span>
              ) : (
                'Save to ENS'
              )}
            </Button>
          )}

          {saveSuccess && (
            <div className="rounded-lg bg-[#EDF5F0] border border-[#B7D4C7] p-4 mt-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#22C55E] flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#2D6A4F]">
                    Vault saved to ENS!
                  </p>
                  <p className="text-xs text-[#2D6A4F]/70 mt-1">
                    <span className="font-medium">Record:</span> yieldroute.vault → {selectedVault?.name || 'Custom Vault'} (Base)
                  </p>
                  <p className="text-xs text-[#2D6A4F]/70">
                    <span className="font-medium">Stored on:</span> Ethereum mainnet (ENS)
                  </p>
                  {saveTxHash && (
                    <a
                      href={`https://etherscan.io/tx/${saveTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#2D6A4F] hover:underline mt-2"
                    >
                      View on Etherscan
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {saveError && (
            <p className="text-sm text-red-600 mt-2">{saveError}</p>
          )}

        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-[#E4E2DC] bg-white">
          <CardContent className="p-5">
            <p className="text-sm text-[#6B6960] mb-1">Vault Balance</p>
            {positionLoading ? (
              <div className="h-8 w-24 bg-[#F8F7F4] rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-semibold text-[#1C1B18]">
                ${vaultPosition?.assets ?? '0.00'}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-[#E4E2DC] bg-white">
          <CardContent className="p-5">
            <p className="text-sm text-[#6B6960] mb-1">Yield Earned</p>
            {positionLoading ? (
              <div className="h-8 w-20 bg-[#F8F7F4] rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-semibold text-[#22C55E]">
                +${vaultPosition?.earned ?? '0.00'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Link */}
      <Card className="border-[#E4E2DC] bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col items-center">
            {/* QR Code */}
            <div className="p-3 bg-white rounded-xl border border-[#E4E2DC]">
              <QRCodeSVG
                value={paymentLink}
                size={140}
                level="M"
                includeMargin={false}
                bgColor="#FFFFFF"
                fgColor="#1C1B18"
              />
            </div>

            {/* Amount input - compact */}
            <div className="flex items-center gap-2 mt-4 w-full max-w-[200px]">
              <Input
                type="number"
                placeholder="Amount"
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                className="h-9 text-center border-[#E4E2DC] focus:border-[#1C1B18] focus:ring-[#1C1B18]"
              />
              <span className="text-sm text-[#6B6960] whitespace-nowrap">USDC</span>
            </div>

            {/* Share buttons - inline */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={handleCopy}
                className="p-2.5 rounded-lg border border-[#E4E2DC] hover:bg-[#F8F7F4] transition-colors"
                title="Copy link"
              >
                {copied ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#22C55E]">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#6B6960]">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                )}
              </button>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Pay me with any token\n${paymentLink}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-lg border border-[#E4E2DC] hover:bg-[#F8F7F4] transition-colors"
                title="Share on X"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#6B6960]">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor"/>
                </svg>
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(paymentLink)}&text=${encodeURIComponent('Pay me with any token')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-lg border border-[#E4E2DC] hover:bg-[#F8F7F4] transition-colors"
                title="Share on Telegram"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#6B6960]">
                  <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.64 8.8C16.49 10.38 15.84 14.22 15.51 15.99C15.37 16.74 15.09 16.99 14.83 17.02C14.25 17.07 13.81 16.64 13.25 16.27C12.37 15.69 11.87 15.33 11.02 14.77C10.03 14.12 10.67 13.76 11.24 13.18C11.39 13.03 13.95 10.7 14 10.49C14.0069 10.4582 14.006 10.4252 13.9973 10.3938C13.9886 10.3624 13.972 10.3337 13.96 10.31C13.89 10.26 13.78 10.28 13.71 10.3C13.61 10.32 12.17 11.26 9.37 13.13C8.97 13.41 8.62 13.55 8.31 13.54C7.96 13.53 7.3 13.35 6.8 13.2C6.19 13.02 5.71 12.92 5.75 12.59C5.77 12.41 6.02 12.24 6.49 12.06C9.51 10.75 11.53 9.89 12.54 9.47C15.41 8.27 15.97 8.07 16.35 8.07C16.43 8.07 16.61 8.09 16.72 8.18C16.81 8.25 16.84 8.35 16.85 8.42C16.84 8.48 16.86 8.68 16.64 8.8Z" fill="currentColor"/>
                </svg>
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Pay me with any token\n${paymentLink}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-lg border border-[#E4E2DC] hover:bg-[#F8F7F4] transition-colors"
                title="Share on WhatsApp"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#6B6960]">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="currentColor"/>
                </svg>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card className="border-[#E4E2DC] bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-[#1C1B18]">
            Recent Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {receiptsLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-[#F8F7F4] rounded-lg" />
              ))}
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#F8F7F4] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#9C9B93]">
                  <path d="M12 2V6M12 18V22M6 12H2M22 12H18M19.07 4.93L16.24 7.76M7.76 16.24L4.93 19.07M19.07 19.07L16.24 16.24M7.76 7.76L4.93 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-[#6B6960]">No payments yet</p>
              <p className="text-sm text-[#9C9B93] mt-1">Share your link to start receiving</p>
            </div>
          ) : (
            <div className="space-y-2">
              {receipts.slice(0, 5).map((receipt) => (
                <div
                  key={receipt.txHash}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#FAFAF8]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#EDF5F0] flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#22C55E]">
                        <path d="M12 5V19M5 12L12 5L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1C1B18]">
                        From {formatAddress(receipt.from)}
                      </p>
                      <p className="text-xs text-[#6B6960]">
                        {formatDate(receipt.createdAt)} · {receipt.chain}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-[#1C1B18]">
                      +{receipt.amount} {receipt.token}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
