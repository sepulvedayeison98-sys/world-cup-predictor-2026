'use client'

import { cn } from '@/lib/utils'
import { Hash } from 'lucide-react'

interface Score {
  home_score: number
  away_score: number
  probability: number
  rank: number
}

interface Props {
  scores: Score[]
}

export function ExactScoresTable({ scores }: Props) {
  const sorted = [...scores].sort((a, b) => a.rank - b.rank)
  const maxProb = sorted[0]?.probability ?? 0.01

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Hash className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Top 10 Marcadores Exactos</h3>
      </div>

      <div className="space-y-1">
        {sorted.map((s, idx) => {
          const pct = Math.round(s.probability * 100)
          const relWidth = (s.probability / maxProb) * 100

          return (
            <div
              key={s.rank}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-1.5',
                idx === 0 && 'bg-amber-500/5 border border-amber-500/20'
              )}
            >
              {/* Rank */}
              <span className={cn(
                'w-4 text-center text-[10px] font-bold shrink-0',
                idx === 0 ? 'text-amber-400' : 'text-zinc-600'
              )}>
                {s.rank}
              </span>

              {/* Score */}
              <span className={cn(
                'mono text-sm font-bold w-10 shrink-0',
                idx === 0 ? 'text-white' : 'text-zinc-300'
              )}>
                {s.home_score}–{s.away_score}
              </span>

              {/* Bar */}
              <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    idx === 0 ? 'bg-amber-500' :
                    idx < 3  ? 'bg-emerald-500/60' : 'bg-zinc-600'
                  )}
                  style={{ width: `${relWidth}%` }}
                />
              </div>

              {/* Probability */}
              <span className={cn(
                'text-[11px] font-semibold mono w-8 text-right shrink-0',
                idx === 0 ? 'text-amber-400' :
                idx < 3  ? 'text-emerald-400' : 'text-zinc-500'
              )}>
                {pct}%
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-2 text-[9px] text-zinc-600">
        Generados por simulación Monte Carlo · {sorted.length} escenarios principales
      </p>
    </div>
  )
}
