'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Flag } from '@/components/ui/Flag'
import { TrendingUp, Zap, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

interface FeedEntry {
  id: string
  type: 'prediction' | 'value_bet' | 'result' | 'alert'
  timestamp: string
  title: string
  detail: string
  color: string
  icon: React.ElementType
  code1?: string | null
  code2?: string | null
}

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

const TYPE_META: Record<FeedEntry['type'], { label: string; dot: string }> = {
  prediction: { label: 'PRED', dot: 'bg-blue-500' },
  value_bet:  { label: 'VAL',  dot: 'bg-amber-500' },
  result:     { label: 'RES',  dot: 'bg-emerald-500' },
  alert:      { label: 'ALT',  dot: 'bg-red-500' },
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
        const Icon = entry.icon
        const meta = TYPE_META[entry.type]
        return (
          <div
            key={entry.id}
            className={cn(
              'flex items-start gap-3 px-4 py-2.5 transition-colors duration-500',
              highlighted === entry.id ? 'bg-emerald-500/5' : 'hover:bg-zinc-800/20'
            )}
          >
            {/* Type badge */}
            <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
              <div className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
              <span className="text-[8px] font-bold tracking-wider text-zinc-600 mono">{meta.label}</span>
            </div>

            {/* Icon */}
            <div className={cn('mt-0.5 shrink-0', entry.color)}>
              <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {entry.code1 && <Flag code={entry.code1} />}
                {entry.code2 && (
                  <>
                    <span className="text-[9px] text-zinc-700">vs</span>
                    <Flag code={entry.code2} />
                  </>
                )}
                <p className="text-xs font-semibold text-zinc-200 truncate">{entry.title}</p>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{entry.detail}</p>
            </div>

            {/* Time */}
            <span className="text-[9px] text-zinc-600 mono shrink-0 mt-0.5">{timeAgo(entry.timestamp)}</span>
          </div>
        )
      })}
    </div>
  )
}

/* Server-side data builder */
export function buildFeedEntries(
  predictions: any[],
  valueBets: any[],
): FeedEntry[] {
  const entries: FeedEntry[] = []

  for (const p of (predictions ?? []).slice(0, 10)) {
    const m = p.match
    const homeP = p.home_win_probability ?? 0
    const drawP = p.draw_probability ?? 0
    const awayP = p.away_win_probability ?? 0
    const maxP = Math.max(homeP, drawP, awayP)
    const outcome = maxP === homeP ? `${m?.home_team?.code} gana` : maxP === awayP ? `${m?.away_team?.code} gana` : 'Empate'
    entries.push({
      id: `pred-${p.id}`,
      type: 'prediction',
      timestamp: p.created_at ?? new Date().toISOString(),
      title: `${m?.home_team?.code ?? '?'} – ${m?.away_team?.code ?? '?'}`,
      detail: `${outcome} · Confianza ${Math.round(maxP * 100)}% · Calidad ${p.data_quality_score ? Math.round(p.data_quality_score) : '—'}`,
      color: 'text-blue-400',
      icon: TrendingUp,
      code1: m?.home_team?.code,
      code2: m?.away_team?.code,
    })
  }

  for (const b of (valueBets ?? []).slice(0, 5)) {
    const edge = b.edge_percentage ?? (b.model_probability - (b.implied_probability ?? 0)) * 100
    entries.push({
      id: `bet-${b.id}`,
      type: 'value_bet',
      timestamp: b.created_at ?? new Date().toISOString(),
      title: b.description ?? 'Apuesta de valor detectada',
      detail: `Edge: +${edge.toFixed(1)}% · Cuota: ${b.odds_value?.toFixed(2)} · ${b.bookmaker ?? '—'}`,
      color: 'text-amber-400',
      icon: Zap,
    })
  }

  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}
