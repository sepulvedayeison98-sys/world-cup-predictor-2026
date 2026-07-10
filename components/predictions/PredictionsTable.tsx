'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'
import { Flag } from '@/components/ui/Flag'

interface Props { predictions: any[] }

function Stars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={cn('text-[10px]', i < level ? 'text-amber-400' : 'text-zinc-700')}>★</span>
      ))}
    </div>
  )
}

function ProbCell({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={cn('text-xs font-bold mono', color)}>
        {Math.round(value * 100)}%
      </span>
      <div className="w-12 h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div className={cn('h-full rounded-full', color === 'text-emerald-400' ? 'bg-emerald-500' : color === 'text-amber-400' ? 'bg-amber-500' : 'bg-red-500')}
          style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  )
}

export function PredictionsTable({ predictions }: Props) {
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong' | 'pending'>('all')

  const filtered = predictions.filter((p: any) => {
    if (filter === 'correct') return p.was_correct === true
    if (filter === 'wrong')   return p.was_correct === false
    if (filter === 'pending') return p.was_correct === null
    return true
  })

  // Mensaje contextual cuando una pestaña queda vacía: aclara por qué (las
  // predicciones se evalúan solas al terminar el partido), en vez de un
  // genérico que parece un error.
  const anyResolved = predictions.some((p: any) => p.was_correct !== null)
  const emptyMessage =
    filter === 'correct'
      ? anyResolved ? 'Ninguna predicción acertada todavía.' : 'Aún no hay predicciones resueltas. Se evalúan automáticamente cuando los partidos terminan.'
      : filter === 'wrong'
        ? anyResolved ? 'Ninguna predicción fallada todavía.' : 'Aún no hay predicciones resueltas. Se evalúan automáticamente cuando los partidos terminan.'
        : filter === 'pending'
          ? 'No hay predicciones pendientes: todas las disponibles ya están resueltas.'
          : 'No hay predicciones disponibles.'

  return (
    <div className="card overflow-hidden">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800 p-3">
        {([
          { key: 'all',     label: 'Todas', count: predictions.length },
          { key: 'correct', label: '✓ Correctas', count: predictions.filter((p: any) => p.was_correct === true).length },
          { key: 'wrong',   label: '✗ Incorrectas', count: predictions.filter((p: any) => p.was_correct === false).length },
          { key: 'pending', label: '⏳ Pendientes', count: predictions.filter((p: any) => p.was_correct === null).length },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              filter === tab.key
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
            )}
          >
            {tab.label}
            <span className={cn('rounded px-1.5 py-0.5 text-[10px]',
              filter === tab.key ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="sticky left-0 z-10 bg-zinc-900 text-left">Partido</th>
              <th className="text-left">Fecha</th>
              <th className="text-right">Local</th>
              <th className="text-right">Empate</th>
              <th className="text-right">Visitante</th>
              <th className="text-center">Pronóstico</th>
              <th className="text-center">Confianza</th>
              <th className="text-center">Resultado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center">
                  <p className="mx-auto max-w-md text-sm text-zinc-400">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              filtered.map((p: any) => {
                const m = p.match
                const topScore = (p.exact_score_predictions ?? []).find((s: any) => s.rank === 1)

                // Determine predicted outcome from probabilities (not from Poisson mode score,
                // which can contradict: e.g. predicted_home_score=1, predicted_away_score=1
                // but away_win_probability is highest — showing "1-1" would confuse users)
                const homeP = p.home_win_probability ?? 0
                const drawP = p.draw_probability ?? 0
                const awayP = p.away_win_probability ?? 0
                const maxP  = Math.max(homeP, drawP, awayP)
                const predictedOutcome = maxP === homeP ? 'home' : maxP === awayP ? 'away' : 'draw'
                const predictedLabel =
                  predictedOutcome === 'home' ? `${m?.home_team?.code} gana` :
                  predictedOutcome === 'away' ? `${m?.away_team?.code} gana` : 'Empate'
                const outcomeColor =
                  predictedOutcome === 'home' ? 'text-emerald-400' :
                  predictedOutcome === 'away' ? 'text-red-400'     : 'text-amber-400'

                // Actual result label for finished matches
                const actualLabel =
                  p.actual_outcome === 'home' ? `${m?.home_team?.code} ganó` :
                  p.actual_outcome === 'away' ? `${m?.away_team?.code} ganó` :
                  p.actual_outcome === 'draw' ? 'Empate' : null

                return (
                  <tr key={p.id} className={cn(
                    p.was_correct === true  && 'bg-emerald-500/5',
                    p.was_correct === false && 'bg-red-500/5',
                  )}>
                    {/* Sticky: mantiene el partido visible al hacer scroll horizontal
                        en móvil. `!bg` gana sobre la regla .data-table tr:hover td */}
                    <td className="sticky left-0 z-10 !bg-zinc-900">
                      <div>
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                          <Flag code={m?.home_team?.code} />
                          {m?.home_team?.code} vs {m?.away_team?.code}
                          <Flag code={m?.away_team?.code} />
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {m?.venue}
                        </p>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-zinc-400 whitespace-nowrap">
                        {m?.kickoff_time ? format(new Date(m.kickoff_time), "d MMM · HH:mm", { locale: es }) : '—'}
                      </span>
                    </td>
                    <td className="text-right">
                      <ProbCell value={p.home_win_probability} color="text-emerald-400" />
                    </td>
                    <td className="text-right">
                      <ProbCell value={p.draw_probability} color="text-amber-400" />
                    </td>
                    <td className="text-right">
                      <ProbCell value={p.away_win_probability} color="text-red-400" />
                    </td>
                    <td className="text-center">
                      {/* Primary: predicted outcome (from probabilities, not Poisson mode) */}
                      <span className={cn('text-xs font-bold', outcomeColor)}>
                        {predictedLabel}
                      </span>
                      {/* Secondary: top exact score prediction */}
                      {topScore ? (
                        <p className="text-[10px] mono text-zinc-500 mt-0.5">
                          marcador {topScore.home_score}–{topScore.away_score}
                          <span className="text-zinc-600"> ({Math.round(topScore.probability * 100)}%)</span>
                        </p>
                      ) : null}
                      {/* Real score for finished matches */}
                      {m?.status === 'finished' && m?.home_score != null && m?.away_score != null && (
                        <p className="text-[10px] mono text-zinc-500 mt-0.5">
                          real <span className="font-bold text-zinc-300">{m.home_score}–{m.away_score}</span>
                        </p>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <Stars level={p.confidence_level} />
                        <span className="text-[10px] mono text-zinc-500">{p.confidence_score?.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="text-center">
                      {p.was_correct === null ? (
                        <span className="text-[10px] text-amber-400">Pendiente</span>
                      ) : (
                        <div>
                          <span className={cn('text-[10px] font-bold', p.was_correct ? 'text-emerald-400' : 'text-red-400')}>
                            {p.was_correct ? '✓ Correcto' : '✗ Incorrecto'}
                          </span>
                          {actualLabel && (
                            <p className="text-[10px] text-zinc-600">{actualLabel}</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/matches/${p.match_id}`}
                        className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
