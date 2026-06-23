'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { TrendingUp, ExternalLink } from 'lucide-react'
import { Flag } from '@/components/ui/Flag'

const MARKET_LABELS: Record<string, string> = {
  home_win:         'Victoria Local',
  draw:             'Empate',
  away_win:         'Victoria Visitante',
  over_2_5:         'Más de 2.5 goles',
  over_1_5:         'Más de 1.5 goles',
  over_0_5:         'Más de 0.5 goles',
  over_3_5:         'Más de 3.5 goles',
  btts_yes:         'Ambos marcan: Sí',
  btts_no:          'Ambos marcan: No',
  clean_sheet_home: 'Portería 0 Local',
  clean_sheet_away: 'Portería 0 Visitante',
}

const GRADE_CONFIG = {
  high:   { label: '🟢 ALTO',  bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  medium: { label: '🟡 MEDIO', bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400' },
  low:    { label: '🔴 BAJO',  bg: 'bg-zinc-800',       border: 'border-zinc-700',        text: 'text-zinc-500' },
  none:   { label: '—',        bg: 'bg-zinc-900',        border: 'border-zinc-800',        text: 'text-zinc-600' },
}

interface Props { bets: any[] }

export function ValueBetsFullTable({ bets }: Props) {
  const [gradeFilter, setGradeFilter] = useState<string>('all')
  const [marketFilter, setMarketFilter] = useState<string>('all')

  const filtered = bets.filter((b) => {
    if (gradeFilter !== 'all' && b.grade !== gradeFilter) return false
    if (marketFilter !== 'all' && b.market !== marketFilter) return false
    return true
  })

  const uniqueMarkets = [...new Set(bets.map((b) => b.market))]

  // Paginacion: solo se renderizan PAGE_SIZE filas a la vez (evita pintar
  // cientos de filas de golpe). El filtrado sigue sobre el set completo.
  const PAGE_SIZE = 25
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [gradeFilter, marketFilter])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="card overflow-hidden">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-3">
        <div className="flex gap-1">
          {['all', 'high', 'medium', 'low'].map((g) => (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                gradeFilter === g
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
              )}
            >
              {g === 'all' ? 'Todos' : GRADE_CONFIG[g as keyof typeof GRADE_CONFIG]?.label ?? g}
            </button>
          ))}
        </div>

        <select
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value)}
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
        >
          <option value="all">Todos los mercados</option>
          {uniqueMarkets.map((m) => (
            <option key={m} value={m}>{MARKET_LABELS[m] ?? m}</option>
          ))}
        </select>

        <span className="ml-auto text-xs text-zinc-500">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Vista MÓVIL: tarjetas apiladas (la tabla de 12 columnas no cabe en celular) */}
      <div className="md:hidden divide-y divide-zinc-800/70">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">No hay apuestas con los filtros actuales</p>
        ) : (
          paged.map((bet: any) => {
            const grade = GRADE_CONFIG[bet.grade as keyof typeof GRADE_CONFIG] ?? GRADE_CONFIG.none
            const ev = bet.expected_value ?? 0
            const edge = (bet.edge ?? 0) * 100
            const m = bet.match
            return (
              <Link key={bet.id} href={`/matches/${bet.match_id}`} className="block p-3 hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border', grade.bg, grade.border, grade.text)}>
                    {grade.label}
                  </span>
                  <span className={cn('flex items-center gap-0.5 text-sm font-bold mono', ev > 0 ? 'text-emerald-400' : 'text-red-400')}>
                    <TrendingUp className="h-3 w-3" />{ev > 0 ? '+' : ''}{(ev * 100).toFixed(1)}% EV
                  </span>
                </div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
                  <Flag code={m?.home_team?.code} />
                  {m?.home_team?.code} vs {m?.away_team?.code}
                  <Flag code={m?.away_team?.code} />
                </p>
                <p className="text-[11px] text-zinc-400 mb-2">
                  {MARKET_LABELS[bet.market] ?? bet.market} · {bet.bookmaker}
                  {m?.kickoff_time && (
                    <span className="text-zinc-600"> · {format(new Date(m.kickoff_time), 'd MMM HH:mm', { locale: es })}</span>
                  )}
                </p>
                <div className="grid grid-cols-4 gap-1 text-center">
                  <div><p className="text-[9px] text-zinc-600">Cuota</p><p className="text-xs font-bold mono text-white">{bet.odds_value?.toFixed(2)}</p></div>
                  <div><p className="text-[9px] text-zinc-600">Modelo</p><p className="text-xs font-semibold mono text-emerald-400">{((bet.model_probability ?? 0) * 100).toFixed(0)}%</p></div>
                  <div><p className="text-[9px] text-zinc-600">Edge</p><p className={cn('text-xs font-semibold mono', edge > 0 ? 'text-emerald-400' : 'text-red-400')}>{edge > 0 ? '+' : ''}{edge.toFixed(1)}%</p></div>
                  <div><p className="text-[9px] text-zinc-600">Kelly</p><p className="text-xs font-semibold mono text-violet-400">{bet.stake_suggestion_percent > 0 ? `${bet.stake_suggestion_percent?.toFixed(1)}%` : '—'}</p></div>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Vista ESCRITORIO: tabla completa */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left">Partido</th>
              <th className="text-left">Mercado</th>
              <th className="text-left">Casa</th>
              <th className="text-right">Cuota</th>
              <th className="text-right">Implícita</th>
              <th className="text-right">Modelo</th>
              <th className="text-right">Edge</th>
              <th className="text-right">EV</th>
              <th className="text-right">Kelly</th>
              <th className="text-center">Valor</th>
              <th className="text-center">Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-sm text-zinc-500">
                  No hay apuestas con los filtros actuales
                </td>
              </tr>
            ) : (
              paged.map((bet: any) => {
                const grade = GRADE_CONFIG[bet.grade as keyof typeof GRADE_CONFIG] ?? GRADE_CONFIG.none
                const ev = bet.expected_value ?? 0
                const edge = (bet.edge ?? 0) * 100
                const m = bet.match

                return (
                  <tr key={bet.id}>
                    {/* Match */}
                    <td>
                      <div>
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                          <Flag code={m?.home_team?.code} />
                          {m?.home_team?.code} vs {m?.away_team?.code}
                          <Flag code={m?.away_team?.code} />
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {m?.kickoff_time ? format(new Date(m.kickoff_time), "d MMM HH:mm", { locale: es }) : '—'}
                        </p>
                      </div>
                    </td>

                    {/* Market */}
                    <td>
                      <span className="text-xs text-zinc-300">
                        {MARKET_LABELS[bet.market] ?? bet.market}
                      </span>
                    </td>

                    {/* Bookmaker */}
                    <td>
                      <span className="text-[10px] text-zinc-500">{bet.bookmaker}</span>
                    </td>

                    {/* Odds */}
                    <td className="text-right">
                      <span className="mono text-sm font-bold text-white">{bet.odds_value?.toFixed(2)}</span>
                    </td>

                    {/* Implied */}
                    <td className="text-right">
                      <span className="mono text-xs text-zinc-400">
                        {((bet.implied_probability ?? 0) * 100).toFixed(1)}%
                      </span>
                    </td>

                    {/* Model */}
                    <td className="text-right">
                      <span className="mono text-xs text-emerald-400 font-semibold">
                        {((bet.model_probability ?? 0) * 100).toFixed(1)}%
                      </span>
                    </td>

                    {/* Edge */}
                    <td className="text-right">
                      <span className={cn('mono text-xs font-semibold', edge > 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {edge > 0 ? '+' : ''}{edge.toFixed(1)}%
                      </span>
                    </td>

                    {/* EV */}
                    <td className="text-right">
                      <span className={cn(
                        'mono text-sm font-bold flex items-center justify-end gap-0.5',
                        ev > 0 ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        <TrendingUp className="h-3 w-3" />
                        {ev > 0 ? '+' : ''}{(ev * 100).toFixed(1)}%
                      </span>
                    </td>

                    {/* Kelly */}
                    <td className="text-right">
                      <span className="mono text-xs text-violet-400">
                        {bet.stake_suggestion_percent > 0
                          ? `${bet.stake_suggestion_percent?.toFixed(1)}%`
                          : '—'
                        }
                      </span>
                    </td>

                    {/* Grade */}
                    <td className="text-center">
                      <span className={cn(
                        'inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border',
                        grade.bg, grade.border, grade.text
                      )}>
                        {grade.label}
                      </span>
                    </td>

                    {/* Result */}
                    <td className="text-center">
                      <span className={cn(
                        'text-[10px] font-semibold',
                        bet.result === 'won'     ? 'text-emerald-400' :
                        bet.result === 'lost'    ? 'text-red-400' :
                        bet.result === 'void'    ? 'text-zinc-500' :
                        'text-amber-400'
                      )}>
                        {bet.result === 'won'     ? '✓ Ganada' :
                         bet.result === 'lost'    ? '✗ Perdida' :
                         bet.result === 'void'    ? '— Nula' :
                         '⏳ Pendiente'}
                      </span>
                    </td>

                    {/* Link */}
                    <td>
                      <Link
                        href={`/matches/${bet.match_id}`}
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

      {/* Paginacion */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-2">
          <span className="text-xs text-zinc-500">Página {page} de {totalPages}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-600 disabled:opacity-40 disabled:hover:border-zinc-700"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-600 disabled:opacity-40 disabled:hover:border-zinc-700"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
