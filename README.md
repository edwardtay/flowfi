# ENSIO

Accept crypto payments with just your ENS name. Any token, any chain. Payment preferences stored directly in your ENS records.

**Live:** https://ensio-pay.vercel.app

## How It Works

1. **Connect wallet** — Your ENS name becomes your payment link
2. **Set preferences** — Choose token, chain, and yield option (saved to ENS)
3. **Share link** — `ensio-pay.vercel.app/pay/yourname.eth`
4. **Get paid** — Anyone pays with any token, auto-converts per your ENS config

## Features

### Payment Links
Every ENS name is a payment link. Share `ensio-pay.vercel.app/pay/vitalik.eth` and receive payments instantly.

### Cross-Chain Support
Payers can send from 9+ chains (Ethereum, Base, Arbitrum, Optimism, Polygon...). LI.FI handles bridging and swapping automatically.

### Yield Option
Opt-in to auto-deposit payments to Morpho Spark USDC vault on Base (~5% APY). Your money grows while you sleep.

### ENS Records as Payment Config

Your payment preferences are stored directly in your ENS name's text records — no separate database needed.

**ENS Record:** `com.pay.config`

```json
{
  "version": "1.0",
  "receive": {
    "token": "USDC",
    "chain": 8453,
    "vault": "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A"
  }
}
```

| Field | Description |
|-------|-------------|
| `token` | Preferred token: USDC, USDT, or ETH |
| `chain` | Destination chain ID (8453 = Base) |
| `vault` | Optional ERC-4626 vault for yield |

When someone pays you, ENSIO reads your ENS records and routes payments accordingly.

## Payment Flow

```
Payer (any chain, any token)
         │
         ▼
┌─────────────────────────────────────┐
│  LI.FI Aggregator                   │
│  - Find best swap route             │
│  - Bridge to destination chain      │
│  - Execute contract call            │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Destination                        │
│  - Direct USDC transfer, or         │
│  - Vault deposit (yield option)     │
└─────────────────────────────────────┘
         │
         ▼
    Recipient's wallet/vault
```

## Receiver Dashboard

- **Payment link + QR code** — Easy to share
- **Balance tracking** — See your vault position and yield earned
- **Payment history** — Recent payments with chain/token/sender
- **Consolidate** — View scattered balances across chains
- **Settings** — Token, chain, yield toggle

## Contracts (Base Mainnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| VaultRouter | `0x949F88b804Fae2b09A1Be919998255587F7A15fB` | ERC-4626 vault deposits |
| PoolManager | `0x498581fF718922c3f8e6A244956aF099B2652b2b` | Uniswap v4 core |

## Verified Transactions

| Flow | TX |
|------|-----|
| ETH → USDC | [0xebac800d...](https://basescan.org/tx/0xebac800df7c6ea97b7b968c9ee0c740fb766dd6909613b2ae48bd5787deb4b25) |
| USDC → Morpho Vault | [0x1df03cc6...](https://basescan.org/tx/0x1df03cc666b9941e6da959753d3dc6af7d696d5d2705eeaa02ba4b0372c6eaf6) |
| VaultRouter deposit | [0x146d3813...](https://basescan.org/tx/0x146d3813036ecf7468c1d6bb6c422fae3d4774fd84bcde239f7489f5757594ae) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 |
| Cross-chain | LI.FI SDK |
| Identity | ENS |
| Wallets | RainbowKit + wagmi |
| Yield | Morpho (ERC-4626) |

## Getting Started

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000

## License

MIT
