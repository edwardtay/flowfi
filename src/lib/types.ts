export type MessageRole = 'user' | 'agent'

export type RouteOption = {
  id: string
  path: string         // e.g. "Base USDC -> Arbitrum USDC"
  fee: string          // e.g. "$0.12"
  estimatedTime: string
  provider: string     // e.g. "LI.FI", "Circle CCTP", "Uniswap v4"
}

export type ParsedIntent = {
  action: 'transfer' | 'swap' | 'pay_x402'
  amount: string
  fromToken: string
  toToken: string
  toAddress?: string
  toChain?: string
  fromChain?: string
  url?: string         // for x402
}

export type Message = {
  id: string
  role: MessageRole
  content: string
  intent?: ParsedIntent
  routes?: RouteOption[]
  txHash?: string
  timestamp: number
}
