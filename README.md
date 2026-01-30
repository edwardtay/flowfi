# StableRoute

AI-powered cross-chain stablecoin payment agent. Type natural language commands like "send 100 USDC to vitalik.eth on Arbitrum" and StableRoute finds the cheapest route, resolves ENS names, and executes the transaction.

Built for [ETHGlobal HackMoney 2026](https://ethglobal.com/events/hackmoney2026/).

## Architecture

```
FRONTEND (Next.js 16 + Tailwind v4 + shadcn/ui)
├── Chat interface (natural language input)
├── Route visualizer (chain path diagram)
└── Wallet connection (RainbowKit + wagmi)

BACKEND (Next.js API routes)
├── AI Intent Parser (Claude API → structured JSON)
├── Route Engine (LI.FI SDK for cross-chain routing)
├── ENS Resolver (viem — name resolution + payment preferences)
└── x402 Client (detect HTTP 402 paywalls, auto-pay)

ON-CHAIN (Foundry / Solidity)
└── StableRouteHook (Uniswap v4 beforeSwap intent resolver)
```

## Features

**AI Chat Interface** — Natural language → structured transaction intents via Claude API. Supports transfers, swaps, and autonomous payments.

**Cross-Chain Routing (LI.FI)** — Finds optimal routes across Ethereum, Arbitrum, Base, and Optimism for USDC, USDT, and DAI. Compares fees and execution time.

**ENS Resolution** — Resolves `.eth` names to addresses. Reads custom ENS text records (`com.stableroute.chain`, `com.stableroute.token`) for receiver payment preferences.

**x402 Autonomous Payments** — Detects HTTP 402 paywalled resources, extracts payment requirements, and handles payment automatically.

**Uniswap v4 Hook** — `StableRouteHook` with `beforeSwap`/`afterSwap` hooks. An off-chain AI oracle sets routing recommendations per pool. Tracks swap count and volume analytics.

## Demo Flows

1. **Cross-chain transfer**: "Send 100 USDC to alice.eth on Arbitrum" — resolves ENS, finds LI.FI routes, compares fees, executes
2. **Stablecoin swap**: "Swap 50 USDT to USDC" — shows both LI.FI and Uniswap v4 Hook routes side-by-side
3. **Autonomous payment**: "Access /api/x402-demo" — detects 402 paywall, shows payment details, handles payment

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Foundry (for contracts)

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.local.example .env.local
# Fill in: ANTHROPIC_API_KEY, NEXT_PUBLIC_WC_PROJECT_ID, ETH_RPC_URL

# Run development server
pnpm dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for intent parsing |
| `NEXT_PUBLIC_WC_PROJECT_ID` | No | WalletConnect project ID (defaults to "demo") |
| `ETH_RPC_URL` | No | Ethereum RPC URL for ENS resolution (defaults to llamarpc) |

### Contracts

```bash
cd contracts
forge build
forge test -vv
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| AI | Claude API (@anthropic-ai/sdk) |
| Cross-chain | LI.FI SDK (@lifi/sdk) |
| ENS | viem (getEnsAddress, getEnsText) |
| Wallets | RainbowKit + wagmi v2 + viem |
| x402 | HTTP 402 Payment Required protocol |
| Contracts | Foundry + Uniswap v4-core/v4-periphery |

## Prize Tracks

- **Arc (Circle)** — Crosschain financial apps + agentic commerce with stablecoins
- **Uniswap Foundation** — v4 hook for agentic finance
- **LI.FI** — AI-powered cross-chain routing
- **ENS** — Custom ENS resolution with payment preference records

## License

MIT
