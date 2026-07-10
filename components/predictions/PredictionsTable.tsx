'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import { Flag } from '@/components/ui/Flag'
import { ProbBar1X2 } from '@/components/predictions/ProbBar1X2'

interface Props { predictions: any[] }

function Stars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`Confianza ${level} de 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={cn('text-[10px]', i < level ? 'text-amber-400' : 'text-zinc-700')}>★</span>
      ))}
    </div>
  )
}

/** Deriva de una predicción todo lo que ambas vistas (tarjeta y tabla) necesitan. */
function derive(p: any) {
  const m = p.match
  const homeP = p.home_win_probability ?? 0
  const drawP = p.draw_probability ?? 0
  const awayP = p.away_win_probability ?? 0
  const maxP = Math.max(homeP, drawP, awayP)
  const outcome = maxP === homeP ? 'home' : maxP === awayP ? 'away' : 'draw'
  const pickLabel = outcome === 'home' ? `${m?.home_team?.code} gana` : outcome === 'away' ? `${m?.away_team?.code} gana` : 'Empate'
  const pickColor = outcome === 'home' ? 'text-emerald-400' : outcome === 'away' ? 'text-red-400' : 'text-amber-400'
  const topScore = (p.exact_score_predictions ?? []).find((s: any) => s.rank === 1)
  const finished = m?.status === 'finished' && m?.home_score != null && m?.away_score != null
  const actualLabel =
    p.actual_outcome === 'home' ? `${m?.home_team?.code} ganó` :
    p.actual_outcome === 'away' ? `${m?.away_team?.code} ganó` :
    p.actual_outcome === 'draw' ? 'Empate' : null
  return { m, homeP, drawP, awayP, pickLabel, pickColor, topScore, finished, actualLabel }
}

function ResultBadge({ p }: { p: any }) {
  if (p.was_correct === null) return <span className="text-[10px] font-semibold text-amber-400">⏳ Pendiente</span>
  return (
    <span className={cn('text-[10px] font-bold', p.was_correct ? 'text-emerald-400' : 'text-red-400')}>
      {p.was_correct ? '✓ Correcto' : '✗ Incorrecto'}
    </span>
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

  const anyResolved = predictions.some((p: any) => p.was_correct !== null)
  const emptyMessage =
    filter === 'correct'
      ? anyResolved ? 'Ninguna predicción acertada todavía.' : 'Aún no hay predicciones resueltas. Se evalúan automáticamente cuando los partidos terminan.'
      : filter === 'wrong'
        ? anyResolved ? 'Ninguna predicción fallada todavía.' : 'Aún no hay predicciones resueltas. Se evalúan automáticamente cuando los partidos terminan.'
        : filter === 'pending'
          ? 'No hay predicciones pendientes: todas las disponibles ya están resueltas.'
          : 'No hay predicciones disponibles.'

  const tabs = [
    { key: 'all',     label: 'Todas', count: predictions.length },
    { key: 'correct', label: '✓ Correctas', count: predictions.filter((p: any) => p.was_correct === true).length },
    { key: 'wrong',   label: '✗ Incorrectas', count: predictions.filter((p: any) => p.was_correct === false).length },
    { key: 'pending', label: '⏳ Pendientes', count: predictions.filter((p: any) => p.was_correct === null).length },
  ] as const

  return (
    <div className="card overflow-hidden">
      {/* Filtros — scroll horizontal propio para que nunca se corten en móvil */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 p-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              filter === tab.key
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300',
            )}
          >
            {tab.label}
            <span className={cn('rounded px-1.5 py-0.5 text-[10px]', filter === tab.key ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500')}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mx-auto max-w-md px-4 py-10 text-center text-sm text-zinc-400">{emptyMessage}</p>
      ) : (
        <>
          {/* ── MÓVIL: tarjetas apiladas (sin scroll horizontal) ── */}
          <ul className="divide-y divide-zinc-800/60 md:hidden">
            {filtered.map((p: any) => {
              const d = derive(p)
              return (
                <li key={p.id} className={cn(p.was_correct === true && 'bg-emerald-500/5', p.was_correct === false && 'bg-red-500/5')}>
                  <Link href={`/matches/${p.match_id}`} className="block px-4 py-3 active:bg-zinc-800/40 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-zinc-100">
                        <Flag code={d.m?.home_team?.code} /> {d.m?.home_team?.code}
                        <span className="text-zinc-600 font-normal">vs</span>
                        {d.m?.away_team?.code} <Flag code={d.m?.away_team?.code} />
                      </span>
                      <span className="shrink-0 text-[10px] text-zinc-500 mono">
                        {d.m?.kickoff_time ? format(new Date(d.m.kickoff_time), 'd MMM · HH:mm', { locale: es }) : '—'}
                      </span>
                    </div>

                    <ProbBar1X2 className="mt-2.5" home={d.homeP} draw={d.drawP} away={d.awayP} variant="full"
                      homeLabel={d.m?.home_team?.code} awayLabel={d.m?.away_team?.code} />

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-xs">
                        <span className={cn('font-bold', d.pickColor)}>{d.pickLabel}</span>
                        <Stars level={p.confidence_level} />
                      </span>
                      <span className="flex items-center gap-1.5">
                        {d.finished && (
                          <span className="mono text-[10px] text-zinc-500">real <span className="font-bold text-zinc-300">{d.m.home_score}–{d.m.away_score}</span></span>
                        )}
                        <ResultBadge p={p} />
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* ── DESKTOP: tabla con la barra 1X2 unificada ── */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full data-table">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left">Partido</th>
                  <th className="text-left">Fecha</th>
                  <th className="text-left w-48">Probabilidades (1·X·2)</th>
                  <th className="text-center">Pronóstico</th>
                  <th className="text-center">Confianza</th>
                  <th className="text-center">Resultado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => {
                  const d = derive(p)
                  return (
                    <tr key={p.id} className={cn(p.was_correct === true && 'bg-emerald-500/5', p.was_correct === false && 'bg-red-500/5')}>
                      <td>
                        <Link href={`/matches/${p.match_id}`} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 hover:text-emerald-400 transition-colors">
                          <Flag code={d.m?.home_team?.code} />
                          {d.m?.home_team?.code} vs {d.m?.away_team?.code}
                          <Flag code={d.m?.away_team?.code} />
                        </Link>
                        <p className="text-[10px] text-zinc-500">{d.m?.venue}</p>
                      </td>
                      <td>
                        <span className="text-xs text-zinc-400 whitespace-nowrap">
                          {d.m?.kickoff_time ? format(new Date(d.m.kickoff_time), 'd MMM · HH:mm', { locale: es }) : '—'}
                        </span>
                      </td>
                      <td>
                        <ProbBar1X2 home={d.homeP} draw={d.drawP} away={d.awayP} />
                      </td>
                      <td className="text-center">
                        <span className={cn('text-xs font-bold', d.pickColor)}>{d.pickLabel}</span>
                        {d.topScore && (
                          <p className="mt-0.5 text-[10px] mono text-zinc-500">
                            marcador {d.topScore.home_score}–{d.topScore.away_score}
                            <span className="text-zinc-600"> ({Math.round(d.topScore.probability * 100)}%)</span>
                          </p>
                        )}
                        {d.finished && (
                          <p className="mt-0.5 text-[10px] mono text-zinc-500">real <span className="font-bold text-zinc-300">{d.m.home_score}–{d.m.away_score}</span></p>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <Stars level={p.confidence_level} />
                          <span className="text-[10px] mono text-zinc-500">{p.confidence_score?.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="text-center">
                        <ResultBadge p={p} />
                        {d.actualLabel && p.was_correct !== null && (
                          <p className="text-[10px] text-zinc-600">{d.actualLabel}</p>
                        )}
                      </td>
                      <td>
                        <Link href={`/matches/${p.match_id}`} aria-label="Ver detalle" className="flex items-center text-zinc-500 hover:text-zinc-300 transition-colors">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
