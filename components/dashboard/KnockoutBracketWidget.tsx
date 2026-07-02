import Link from 'next/link'
import { GitBranch, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeKnockoutAdvance } from '@/lib/predictionEngine'
import { PHASE_LABELS } from '@/lib/constants'
import { formatColDate } from '@/lib/datetime'

interface KnockoutMatch {
  id: string
  phase: string
  kickoff_time: string
  status: string
  home_score: number | null
  away_score: number | null
  home_team: { code: string; short_name?: string; elo_rating?: number } | null
  away_team: { code: string; short_name?: string; elo_rating?: number } | null
  predictions: any
}

interface Props {
  matches: KnockoutMatch[]
}

/**
 * Widget del cuadro eliminatorio para el dashboard: reemplaza al widget de
 * grupos ahora que la fase de grupos terminó. Muestra cada cruce con la
 * probabilidad de clasificar del modelo (incluye prórroga/penales) o el
 * marcador si ya se jugó.
 */
export function KnockoutBracketWidget({ matches }: Props) {
  // Agrupar por fase manteniendo orden cronológico
  const byPhase = new Map<string, KnockoutMatch[]>()
  for (const m of matches) {
    if (!byPhase.has(m.phase)) byPhase.set(m.phase, [])
    byPhase.get(m.phase)!.push(m)
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Cuadro Eliminatorio
          </span>
        </div>
        <Link
          href="/bracket"
          className="flex items-center gap-0.5 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Ver cuadro <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="divide-y divide-zinc-800/60 max-h-[420px] overflow-y-auto">
        {matches.length === 0 && (
          <p className="p-4 text-sm text-zinc-500">Los cruces se definirán al cerrar la fase anterior.</p>
        )}

        {Array.from(byPhase.entries()).map(([phase, ties]) => (
          <div key={phase}>
            <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              {PHASE_LABELS[phase] ?? phase}
            </p>
            {ties.map((m) => {
              const pred = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
              const finished = m.status === 'finished'
              const advance = !finished && pred
                ? computeKnockoutAdvance(
                    {
                      home: pred.home_win_probability ?? 0.35,
                      draw: pred.draw_probability ?? 0.3,
                      away: pred.away_win_probability ?? 0.35,
                    },
                    m.home_team?.elo_rating ?? 1500,
                    m.away_team?.elo_rating ?? 1500,
                  )
                : null
              const homeFav = advance ? advance.home >= advance.away : (m.home_score ?? 0) > (m.away_score ?? 0)

              return (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className={cn('font-bold mono w-9', homeFav ? 'text-emerald-400' : 'text-zinc-300')}>
                      {m.home_team?.code ?? '—'}
                    </span>
                    <span className="text-zinc-600 text-[10px]">vs</span>
                    <span className={cn('font-bold mono w-9', !homeFav ? 'text-blue-400' : 'text-zinc-300')}>
                      {m.away_team?.code ?? '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {finished ? (
                      <span className="mono text-xs font-bold text-white">
                        {m.home_score}–{m.away_score}
                      </span>
                    ) : advance ? (
                      <span className="mono text-[11px] text-zinc-400">
                        <span className="text-emerald-400 font-semibold">{Math.round(advance.home * 100)}%</span>
                        <span className="text-zinc-600 mx-0.5">·</span>
                        <span className="text-blue-400 font-semibold">{Math.round(advance.away * 100)}%</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-600">sin predicción</span>
                    )}
                    <span className="text-[10px] text-zinc-600 mono w-11 text-right">
                      {finished ? 'Final' : formatColDate(m.kickoff_time)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      <p className="border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-600">
        % de clasificar según el modelo (incluye prórroga y penales) · hora Colombia
      </p>
    </div>
  )
}
