'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Flag } from '@/components/ui/Flag'
import { TrendingUp, Zap, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { FeedEntry } from '@/lib/feed'

interface Props {
  entries: FeedEntry[]
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

const TYPE_META: Record<FeedEntry['type'], { label: string; dot: string; color: string; Icon: React.ElementType }> = {
  prediction: { label: 'PRED', dot: 'bg-blue-500',    color: 'text-blue-400',    Icon: TrendingUp    },
  value_bet:  { label: 'VAL',  dot: 'bg-amber-500',   color: 'text-amber-400',   Icon: Zap           },
  result:     { label: 'RES',  dot: 'bg-emerald-500', color: 'text-emerald-400', Icon: CheckCircle2  },
  alert:      { label: 'ALT',  dot: 'bg-red-500',     color: 'text-red-400',     Icon: AlertTriangle },
}

export function IntelligenceFeed({ entries }: Props) {
  const [highlighted, setHighlighted] = useState<string | null>(null)

  useEffect(() => {
    if (entries.length === 0) return
    setHighlighted(entries[0].id)
    const t = setTimeout(() => setHighlighted(null), 2000)
    return () => clearTimeout(t)
  }, [entries])

  if (entries.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-zinc-600">
        Sin señales recientes · El motor generará eventos cuando se procesen predicciones
      </div>
    )
  }

  return (
    <div className="divide-y divide-zinc-800/60">
      {entries.map((entry) => {
        const meta = TYPE_META[entry.type]
        const Icon = meta.Icon
        return (
          <div
            key={entry.id}
            className={cn(
              'flex items-start gap-3 px-4 py-2.5 transition-colors duration-500',
              highlighted === entry.id ? 'bg-emerald-500/5' : 'hover:bg-zinc-800/20'
            )}
          >
            <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
              <div className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
              <span className="text-[10px] font-bold tracking-wider text-zinc-600 mono">{meta.label}</span>
            </div>

            <div className={cn('mt-0.5 shrink-0', meta.color)}>
              <Icon className="h-3.5 w-3.5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {entry.code1 && <Flag code={entry.code1} />}
                {entry.code2 && (
                  <>
                    <span className="text-[10px] text-zinc-700">vs</span>
                    <Flag code={entry.code2} />
                  </>
                )}
                <p className="text-xs font-semibold text-zinc-200 truncate">{entry.title}</p>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{entry.detail}</p>
            </div>

            <span className="text-[10px] text-zinc-600 mono shrink-0 mt-0.5">{timeAgo(entry.timestamp)}</span>
          </div>
        )
      })}
    </div>
  )
}
