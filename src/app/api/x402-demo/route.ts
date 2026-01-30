import { NextRequest, NextResponse } from 'next/server'

// Demo x402 paywall endpoint
// Returns 402 if no payment proof, content if payment provided
export async function GET(req: NextRequest) {
  const paymentProof = req.headers.get('X-Payment-Proof')

  if (!paymentProof) {
    return NextResponse.json(
      {
        message: 'Payment Required',
        payment: {
          amount: '0.50',
          token: 'USDC',
          chain: 'base',
          recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1e',
        },
      },
      {
        status: 402,
        headers: {
          'X-Payment': JSON.stringify({
            amount: '0.50',
            token: 'USDC',
            chain: 'base',
            recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1e',
          }),
        },
      }
    )
  }

  // Payment provided - return premium content
  return NextResponse.json({
    message: 'Access granted!',
    data: {
      title: 'Premium DeFi Analytics',
      content: 'Top yielding stablecoin pools: Aave USDC (4.2% APY), Morpho USDT (5.1% APY), Compound DAI (3.8% APY)',
      timestamp: new Date().toISOString(),
    },
  })
}
