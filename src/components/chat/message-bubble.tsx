'use client'

import { cn } from '@/lib/utils'
import type { Message, RouteOption, ParsedIntent } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RouteVisualizer } from '@/components/route-visualizer'
import { RefreshCw } from 'lucide-react'

/** Returns a chain-accent border class based on route path content */
function getRouteAccentClass(path: string): string {
  const lower = path.toLowerCase()
  if (lower.includes('base')) return 'border-l-blue-500/60 hover:border-blue-500/40 hover:shadow-blue-500/5'
  if (lower.includes('arbitrum')) return 'border-l-orange-500/60 hover:border-orange-500/40 hover:shadow-orange-500/5'
  if (lower.includes('optimism')) return 'border-l-red-500/60 hover:border-red-500/40 hover:shadow-red-500/5'
  if (lower.includes('ethereum') || lower.includes('mainnet')) return 'border-l-purple-500/60 hover:border-purple-500/40 hover:shadow-purple-500/5'
  return 'hover:border-gray-600 hover:shadow-gray-500/5'
}

type MessageBubbleProps = {
  message: Message
  onSelectRoute?: (route: RouteOption, intent?: ParsedIntent) => void
  onRefreshRoutes?: () => void
}

export function MessageBubble({ message, onSelectRoute, onRefreshRoutes }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex w-full mb-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] md:max-w-[75%] flex flex-col gap-3',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {/* Message bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-indigo-600 text-white rounded-br-md'
              : 'bg-gray-800 text-gray-100 rounded-bl-md'
          )}
        >
          {message.content}
        </div>

        {/* Route option cards */}
        {message.routes && message.routes.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {message.routes.length} route{message.routes.length > 1 ? 's' : ''} found
              </span>
              {onRefreshRoutes && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-gray-400 hover:text-gray-200 h-7 px-2 gap-1 cursor-pointer"
                  onClick={onRefreshRoutes}
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </Button>
              )}
            </div>
            {message.routes.map((route) => (
              <Card
                key={route.id}
                className={cn(
                  'bg-gray-800/50 border-gray-700 border-l-2 py-3 transition-all duration-200 hover:shadow-lg',
                  getRouteAccentClass(route.path)
                )}
              >
                <CardContent className="px-4 py-0">
                  <div className="flex flex-col gap-2">
                    {/* Route visualization */}
                    <RouteVisualizer route={route} intent={message.intent} />

                    {/* Provider + path + controls */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-xs',
                              route.provider === 'Uniswap v4 Hook'
                                ? 'bg-pink-500/20 text-pink-300 border-pink-500/30'
                                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            )}
                          >
                            {route.provider}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-200 truncate">
                          {route.path}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>Fee: {route.fee}</span>
                          <span className="text-gray-600">|</span>
                          <span>ETA: {route.estimatedTime}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 cursor-pointer sm:w-auto w-full mt-2 sm:mt-0"
                        onClick={() => onSelectRoute?.(route, message.intent)}
                      >
                        Select
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Transaction hash link */}
        {message.txHash && (
          <a
            href={`https://etherscan.io/tx/${message.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
          >
            View transaction: {message.txHash.slice(0, 10)}...
            {message.txHash.slice(-8)}
          </a>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-gray-500 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  )
}
