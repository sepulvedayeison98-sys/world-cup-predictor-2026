'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface PeriodScores { home: number[]; away: number[] }

interface Props {
  matchId: string
  homeCode: string
  awayCode: string
}

/**
 * Desglose por cuarto de un partido NBA (equivalente al timeline del
 * fútbol, pero honesto con los datos disponibles en baloncesto). Muestra
 * los puntos de cada cuarto/prórroga y el diferencial acumulado.
 * Se alimenta de matches.period_scores vía /api/matches/[id]/periods.
 */
export function QuarterBreakdown({ matchId, homeCode, awayCode }: Props) {
  const [ps, setPs] = useState<PeriodScores | null | 'loading'>('loading')

  useEffect(() => {
    let alive = true
    fetch(`/api/matches/${matchId}/periods`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (alive) setPs(d.period_scores ?? null) })
      .catch(() => { if (alive) setPs(null) })
    return () => { alive = false }
  }, [matchId])

  if (ps === null) return null // sin desglose disponible: no ocupar espacio

  const periods = ps === 'loading' ? [] : ps.home.map((_, i) => i)
  const label = (i: number, n: number) => (i < 4 ? `Q${i + 1}` : n - i === 1 ? 'PR' : `PR${i - 3}`)

  // Diferencial acumulado tras cada periodo (perspectiva local)
  let runH = 0, runA = 0
  const running = ps === 'loading' ? [] : ps.home.map((h, i) => { runH += h; runA += (ps.away[i] ?? 0); return runH - runA })

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-bold text-white">Desglose por cuarto</h2>
      </div>

      {ps === 'loading' ? (
        <div className="px-4 py-6 text-center text-xs text-zinc-500">Cargando cuartos…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2 text-left">Equipo</th>
                {periods.map((i) => (
                  <th key={i} className="px-3 py-2 text-center w-12">{label(i, ps.home.length)}</th>
                ))}
                <th className="px-3 py-2 text-center font-bold">T</th>
              </tr>
            </thead>
            <tbody>
              {([['home', homeCode, ps.home], ['away', awayCode, ps.away]] as const).map(([side, code, arr]) => {
                const total = arr.reduce((s, v) => s + v, 0)
                return (
                  <tr key={side} className="border-b border-zinc-800/60">
                    <td className="px-4 py-2 font-bold text-zinc-200">{code}</td>
                    {arr.map((v, i) => {
                      const win = v > (side === 'home' ? ps.away[i] : ps.home[i])
                      return (
                        <td key={i} className={cn('px-3 py-2 text-center tabular-nums', win ? 'font-bold text-emerald-400' : 'text-zinc-400')}>{v}</td>
                      )
                    })}
                    <td className="px-3 py-2 text-center font-bold text-white tabular-nums">{total}</td>
                  </tr>
                )
              })}
              {/* Diferencial acumulado (perspectiva local) */}
              <tr className="text-[11px] text-zinc-500">
                <td className="px-4 py-2">Dif. acumulada</td>
                {running.map((d, i) => (
                  <td key={i} className={cn('px-3 py-2 text-center tabular-nums', d > 0 ? 'text-emerald-500' : d < 0 ? 'text-red-400' : 'text-zinc-600')}>
                    {d > 0 ? `+${d}` : d}
                  </td>
                ))}
                <td className="px-3 py-2" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-600">
        Fuente: API-Basketball · puntos por cuarto (PR = prórroga)
      </p>
    </div>
  )
}
