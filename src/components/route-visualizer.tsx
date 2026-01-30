'use client'

import { cn } from '@/lib/utils'
import type { RouteOption, ParsedIntent } from '@/lib/types'

type RouteVisualizerProps = {
  route: RouteOption
  intent?: ParsedIntent
}

/** Map chain names to their brand colors */
function getChainColor(chain: string): { bg: string; border: string; text: string; glow: string } {
  const lower = chain.toLowerCase()
  if (lower.includes('base'))
    return { bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-blue-300', glow: 'shadow-blue-500/30' }
  if (lower.includes('arbitrum'))
    return { bg: 'bg-orange-500', border: 'border-orange-400', text: 'text-orange-300', glow: 'shadow-orange-500/30' }
  if (lower.includes('optimism'))
    return { bg: 'bg-red-500', border: 'border-red-400', text: 'text-red-300', glow: 'shadow-red-500/30' }
  if (lower.includes('ethereum') || lower.includes('mainnet'))
    return { bg: 'bg-purple-500', border: 'border-purple-400', text: 'text-purple-300', glow: 'shadow-purple-500/30' }
  if (lower.includes('polygon'))
    return { bg: 'bg-violet-500', border: 'border-violet-400', text: 'text-violet-300', glow: 'shadow-violet-500/30' }
  return { bg: 'bg-gray-500', border: 'border-gray-400', text: 'text-gray-300', glow: 'shadow-gray-500/30' }
}

/** Parse route.path string like "Base USDC -> Arbitrum USDC" into steps */
function parseRoutePath(path: string, intent?: ParsedIntent) {
  // Attempt to split on common delimiters
  const segments = path.split(/\s*(?:->|-->|=>|>>)\s*/)

  if (segments.length >= 2) {
    return segments.map((seg) => {
      const trimmed = seg.trim()
      // Try to extract chain and token e.g. "Base USDC" or "USDC (Base)"
      const matchChainFirst = trimmed.match(/^(\w+)\s+(\w+)$/)
      const matchTokenParen = trimmed.match(/^(\w+)\s*\((\w+)\)$/)

      if (matchChainFirst) {
        return { chain: matchChainFirst[1], token: matchChainFirst[2] }
      }
      if (matchTokenParen) {
        return { chain: matchTokenParen[2], token: matchTokenParen[1] }
      }
      // Fallback: treat whole segment as a label
      return { chain: '', token: trimmed }
    })
  }

  // Fallback using intent data
  if (intent) {
    const from = { chain: intent.fromChain || '', token: intent.fromToken || '?' }
    const to = { chain: intent.toChain || intent.fromChain || '', token: intent.toToken || '?' }
    return [from, to]
  }

  return [{ chain: '', token: path }]
}

function ChainDot({ chain }: { chain: string }) {
  const colors = getChainColor(chain)
  return (
    <span
      className={cn(
        'inline-block w-2.5 h-2.5 rounded-full shadow-md shrink-0',
        colors.bg,
        colors.glow
      )}
      title={chain}
    />
  )
}

function AnimatedArrow() {
  return (
    <span className="flex items-center gap-0.5 text-gray-500 shrink-0 route-arrow">
      <span className="w-4 h-px bg-gradient-to-r from-gray-600 to-gray-400" />
      <svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        fill="none"
        className="text-gray-400"
      >
        <path
          d="M1 1L4 4L1 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function MiddleStep({ provider }: { provider: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-700/60 border border-gray-600/40 text-[10px] text-gray-300 font-medium shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
      {provider}
    </span>
  )
}

export function RouteVisualizer({ route, intent }: RouteVisualizerProps) {
  const steps = parseRoutePath(route.path, intent)
  const isCrossChain =
    steps.length >= 2 &&
    steps[0].chain &&
    steps[steps.length - 1].chain &&
    steps[0].chain.toLowerCase() !== steps[steps.length - 1].chain.toLowerCase()

  return (
    <div className="flex items-center gap-1.5 flex-wrap py-1.5">
      {steps.map((step, idx) => (
        <span key={idx} className="contents">
          {/* Arrow + middleware before all steps except first */}
          {idx > 0 && (
            <>
              <AnimatedArrow />
              {/* Show provider in the middle of a 2-step route */}
              {steps.length === 2 && idx === 1 && (
                <>
                  <MiddleStep provider={route.provider} />
                  <AnimatedArrow />
                </>
              )}
            </>
          )}
          {/* Step node */}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-800/80 border border-gray-700/50 shrink-0">
            {step.chain && <ChainDot chain={step.chain} />}
            <span className="text-[11px] font-medium text-gray-200">
              {step.chain && (
                <span className={cn('mr-1', getChainColor(step.chain).text)}>
                  {step.chain}
                </span>
              )}
              {step.token}
            </span>
          </span>
        </span>
      ))}

      {/* Cross-chain badge */}
      {isCrossChain && (
        <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-medium">
          cross-chain
        </span>
      )}
    </div>
  )
}
