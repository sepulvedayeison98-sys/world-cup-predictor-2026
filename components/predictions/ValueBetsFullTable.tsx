'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { TrendingUp, ExternalLink, ArrowUpDown, Clock, Star } from 'lucide-react'
import { Flag } from '@/components/ui/Flag'

const MARKET_LABELS: Record<string, string> = {
  home_win:         'Victoria Local',
  draw:             'Empate',
  away_win:         'Victoria Visitante',
  over_2_5:         'Más de 2.5',
  over_1_5:         'Más de 1.5',
  over_0_5:         'Más de 0.5',
  over_3_5:         'Más de 3.5',
  btts_yes:         'Ambos marcan',
  btts_no:          'No ambos marcan',
  clean_sheet_home: 'Portería 0 Local',
  clean_sheet_away: 'Portería 0 Visitante',
}

const GRADE_CONFIG = {
  high:   { label: 'ALTO',  bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  medium: { label: 'MEDIO', bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',  dot: 'bg-amber-500'   },
  low:    { label: 'BAJO',  bg: 'bg-zinc-800',        border: 'border-zinc-700',        text: 'text-zinc-500',  dot: 'bg-zinc-600'    },
  none:   { label: '—',     bg: 'bg-zinc-900',         border: 'border-zinc-800',        text: 'text-zinc-600',  dot: 'bg-zinc-700'    },
}

type SortKey = 'ev' | 'edge' | 'odds' | 'date'
type SortDir = 'desc' | 'asc'

function timeUntil(iso: string): { label: string; urgency: 'now' | 'soon' | 'today' | 'normal' } {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms < 0)        return { label: 'En curso', urgency: 'now' }
  const h = ms / 3600000
  if (h < 2)         return { label: `${Math.round(h * 60)}m`, urgency: 'now' }
  if (h < 6)         return { label: `${h.toFixed(0)}h`, urgency: 'soon' }
  if (h < 24)        return { label: `${h.toFixed(0)}h`, urgency: 'today' }
  const d = Math.floor(h / 24)
  return { label: `${d}d`, urgency: 'normal' }
}

const URGENCY_COLOR = {
  now:    'text-red-400 bg-red-500/10 border-red-500/20',
  soon:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
  today:  'text-blue-400 bg-blue-500/10 border-blue-500/20',
  normal: 'text-zinc-500 bg-zinc-800 border-zinc-700',
}

interface Props { bets: any[] }

export function ValueBetsFullTable({ bets }: Props) {
  const [gradeFilter, setGradeFilter] = useState<string>('all')
  const [marketFilter, setMarketFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)

  // Find top pick: highest EV among high-grade bets
  const topPickId = useMemo(() => {
    const highBets = bets.filter(b => b.grade === 'high')
    if (highBets.length === 0) return null
    return highBets.reduce((best, b) => (b.expected_value ?? 0) > (best.expected_value ?? 0) ? b : best).id
  }, [bets])

  const maxEdge = useMemo(() => Math.max(...bets.map(b => b.edge ?? 0), 0.001), [bets])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    let result = bets.filter(b => {
      if (gradeFilter !== 'all' && b.grade !== gradeFilter) return false
      if (marketFilter !== 'all' && b.market !== marketFilter) return false
      return true
    })

    result = [...result].sort((a, b) => {
      let va = 0, vb = 0
      if (sortKey === 'ev')   { va = a.expected_value ?? 0; vb = b.expected_value ?? 0 }
      if (sortKey === 'edge') { va = a.edge ?? 0;           vb = b.edge ?? 0           }
      if (sortKey === 'odds') { va = a.odds_value ?? 0;     vb = b.odds_value ?? 0     }
      if (sortKey === 'date') {
        va = new Date(a.match?.kickoff_time ?? 0).getTime()
        vb = new Date(b.match?.kickoff_time ?? 0).getTime()
      }
      return sortDir === 'desc' ? vb - va : va - vb
    })
    return result
  }, [bets, gradeFilter, marketFilter, sortKey, sortDir])

  const uniqueMarkets = useMemo(() => [...new Set(bets.map(b => b.market))], [bets])

  const PAGE_SIZE = 25
  useEffect(() => { setPage(1) }, [gradeFilter, marketFilter, sortKey, sortDir])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function SortButton({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k
    return (
      <button onClick={() => toggleSort(k)} className={cn(
        'flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors border',
        active
          ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
      )}>
        {label}
        <ArrowUpDown className="h-2.5 w-2.5" />
        {active && <span className="text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>}
      </button>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Filters + Sort */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-3">
        {/* Grade filter */}
        <div className="flex gap-1">
          {(['all', 'high', 'medium', 'low'] as const).map(g => (
            <button key={g} onClick={() => setGradeFilter(g)} className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
              gradeFilter === g
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
            )}>
              {g === 'all' ? 'Todos' :
               g === 'high' ? '🟢 Alto' :
               g === 'medium' ? '🟡 Medio' : '🔴 Bajo'}
            </button>
          ))}
        </div>

        {/* Market filter */}
        <select
          value={marketFilter}
          onChange={e => setMarketFilter(e.target.value)}
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
        >
          <option value="all">Todos los mercados</option>
          {uniqueMarkets.map(m => (
            <option key={m} value={m}>{MARKET_LABELS[m] ?? m}</option>
          ))}
        </select>

        {/* Sort controls */}
        <div className="hidden sm:flex items-center gap-1 ml-auto">
          <span className="text-[10px] text-zinc-600 mr-1">Ordenar:</span>
          <SortButton k="date" label="Fecha" />
          <SortButton k="ev"   label="EV"    />
          <SortButton k="edge" label="Edge"  />
          <SortButton k="odds" label="Cuota" />
        </div>

        <span className="text-xs text-zinc-500 ml-auto sm:ml-0">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Mobile sort (xs) */}
      <div className="flex sm:hidden items-center gap-1 px-3 py-2 border-b border-zinc-800/60 bg-zinc-900/50">
        <span className="text-[10px] text-zinc-600">Ordenar:</span>
        <SortButton k="date" label="Fecha" />
        <SortButton k="ev"   label="EV"    />
        <SortButton k="edge" label="Edge"  />
      </div>

      {/* MOBILE: card list */}
      <div className="md:hidden divide-y divide-zinc-800/70">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">No hay apuestas con los filtros actuales</p>
        ) : (
          paged.map(bet => {
            const grade  = GRADE_CONFIG[bet.grade as keyof typeof GRADE_CONFIG] ?? GRADE_CONFIG.none
            const ev     = bet.expected_value ?? 0
            const edge   = (bet.edge ?? 0) * 100
            const m      = bet.match
            const isTop  = bet.id === topPickId
            const timeInfo = m?.kickoff_time ? timeUntil(m.kickoff_time) : null
            return (
              <Link key={bet.id} href={`/matches/${bet.match_id}`}
                className={cn('block p-3 hover:bg-zinc-800/30 transition-colors', isTop && 'bg-violet-500/3 border-l-2 border-violet-500/50')}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {isTop && (
                      <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-violet-500/15 border border-violet-500/30 text-violet-400">
                        <Star className="h-2 w-2" /> TOP
                      </span>
                    )}
                    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border', grade.bg, grade.border, grade.text)}>
                      <span className={cn('h-1 w-1 rounded-full', grade.dot)} />
                      {grade.label}
                    </span>
                  </div>
                  <span className={cn('flex items-center gap-0.5 text-sm font-bold mono', ev > 0 ? 'text-emerald-400' : 'text-red-400')}>
                    <TrendingUp className="h-3 w-3" />{ev > 0 ? '+' : ''}{(ev * 100).toFixed(1)}% EV
                  </span>
                </div>

                <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
                  <Flag code={m?.home_team?.code} />
                  {m?.home_team?.code} vs {m?.away_team?.code}
                  <Flag code={m?.away_team?.code} />
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-zinc-400">
                    {MARKET_LABELS[bet.market] ?? bet.market} · {bet.bookmaker}
                  </p>
                  {timeInfo && (
                    <span className={cn('inline-flex items-center gap-0.5 rounded border px-1 py-0 text-[10px] font-semibold', URGENCY_COLOR[timeInfo.urgency])}>
                      <Clock className="h-2 w-2" />{timeInfo.label}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1 text-center mt-2">
                  <div><p className="text-[10px] text-zinc-600">Cuota</p><p className="text-xs font-bold mono text-white">{bet.odds_value?.toFixed(2)}</p></div>
                  <div><p className="text-[10px] text-zinc-600">Modelo</p><p className="text-xs font-semibold mono text-emerald-400">{((bet.model_probability ?? 0) * 100).toFixed(0)}%</p></div>
                  <div><p className="text-[10px] text-zinc-600">Edge</p><p className={cn('text-xs font-semibold mono', edge > 0 ? 'text-emerald-400' : 'text-red-400')}>{edge > 0 ? '+' : ''}{edge.toFixed(1)}%</p></div>
                  <div><p className="text-[10px] text-zinc-600">Kelly</p><p className="text-xs font-semibold mono text-violet-400">{bet.stake_suggestion_percent > 0 ? `${bet.stake_suggestion_percent?.toFixed(1)}%` : '—'}</p></div>
                </div>

                {bet.ai_justification && (
                  <p className="mt-1.5 text-[10px] text-zinc-500 italic leading-relaxed border-t border-zinc-800 pt-1.5">
                    {bet.ai_justification}
                  </p>
                )}
              </Link>
            )
          })
        )}
      </div>

      {/* DESKTOP: full table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left w-4"></th>
              <th className="text-left">Partido</th>
              <th className="text-left">Mercado</th>
              <th className="text-left">Casa</th>
              <th className="text-right cursor-pointer hover:text-zinc-300" onClick={() => toggleSort('odds')}>
                Cuota {sortKey === 'odds' && (sortDir === 'desc' ? '↓' : '↑')}
              </th>
              <th className="text-right">Implícita</th>
              <th className="text-right">Modelo</th>
              <th className="text-right cursor-pointer hover:text-zinc-300" onClick={() => toggleSort('edge')}>
                Edge {sortKey === 'edge' && (sortDir === 'desc' ? '↓' : '↑')}
              </th>
              <th className="text-right cursor-pointer hover:text-zinc-300" onClick={() => toggleSort('ev')}>
                EV {sortKey === 'ev' && (sortDir === 'desc' ? '↓' : '↑')}
              </th>
              <th className="text-right">Kelly</th>
              <th className="text-center">Valor</th>
              <th className="text-center cursor-pointer hover:text-zinc-300" onClick={() => toggleSort('date')}>
                Tiempo {sortKey === 'date' && (sortDir === 'desc' ? '↓' : '↑')}
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-12 text-center text-sm text-zinc-500">
                  No hay apuestas con los filtros actuales
                </td>
              </tr>
            ) : (
              paged.map(bet => {
                const grade   = GRADE_CONFIG[bet.grade as keyof typeof GRADE_CONFIG] ?? GRADE_CONFIG.none
                const ev      = bet.expected_value ?? 0
                const edge    = bet.edge ?? 0
                const edgePct = edge * 100
                const isTop   = bet.id === topPickId
                const m       = bet.match
                const timeInfo = m?.kickoff_time ? timeUntil(m.kickoff_time) : null

                return (
                  <tr key={bet.id} className={cn(isTop && 'bg-violet-500/3')}>
                    {/* Top pick indicator */}
                    <td className="pl-3 pr-0 py-2.5">
                      {isTop && <Star className="h-3 w-3 text-violet-400 fill-violet-400/50" />}
                    </td>

                    {/* Match */}
                    <td>
                      <div>
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                          <Flag code={m?.home_team?.code} />
                          {m?.home_team?.code} vs {m?.away_team?.code}
                          <Flag code={m?.away_team?.code} />
                        </p>
                        {m?.kickoff_time && (
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            {format(new Date(m.kickoff_time), "d MMM HH:mm", { locale: es })}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Market */}
                    <td>
                      <span className="text-xs text-zinc-300">{MARKET_LABELS[bet.market] ?? bet.market}</span>
                    </td>

                    {/* Bookmaker */}
                    <td>
                      <span className="text-[10px] text-zinc-500">{bet.bookmaker}</span>
                    </td>

                    {/* Odds */}
                    <td className="text-right">
                      <span className="mono text-sm font-bold text-white">{bet.odds_value?.toFixed(2)}</span>
                    </td>

                    {/* Implied prob */}
                    <td className="text-right">
                      <span className="mono text-xs text-zinc-400">
                        {((bet.implied_probability ?? 0) * 100).toFixed(1)}%
                      </span>
                    </td>

                    {/* Model prob */}
                    <td className="text-right">
                      <span className="mono text-xs text-emerald-400 font-semibold">
                        {((bet.model_probability ?? 0) * 100).toFixed(1)}%
                      </span>
                    </td>

                    {/* Edge with mini bar */}
                    <td className="text-right min-w-[70px]">
                      <span className={cn('mono text-xs font-semibold', edgePct > 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {edgePct > 0 ? '+' : ''}{edgePct.toFixed(1)}%
                      </span>
                      <div className="mt-0.5 h-0.5 w-10 ml-auto bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', edgePct >= 10 ? 'bg-emerald-400' : edgePct >= 5 ? 'bg-amber-400' : 'bg-zinc-500')}
                          style={{ width: `${Math.min(100, (edge / maxEdge) * 100)}%` }}
                        />
                      </div>
                    </td>

                    {/* EV */}
                    <td className="text-right">
                      <span className={cn('mono text-sm font-bold flex items-center justify-end gap-0.5', ev > 0 ? 'text-emerald-400' : 'text-red-400')}>
                        <TrendingUp className="h-3 w-3" />
                        {ev > 0 ? '+' : ''}{(ev * 100).toFixed(1)}%
                      </span>
                    </td>

                    {/* Kelly */}
                    <td className="text-right">
                      <span className="mono text-xs text-violet-400">
                        {bet.stake_suggestion_percent > 0 ? `${bet.stake_suggestion_percent?.toFixed(1)}%` : '—'}
                      </span>
                    </td>

                    {/* Grade */}
                    <td className="text-center">
                      <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border', grade.bg, grade.border, grade.text)}>
                        <span className={cn('h-1 w-1 rounded-full', grade.dot)} />
                        {grade.label}
                      </span>
                    </td>

                    {/* Time to kickoff */}
                    <td className="text-center">
                      {timeInfo ? (
                        <span className={cn('inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold', URGENCY_COLOR[timeInfo.urgency])}>
                          <Clock className="h-2.5 w-2.5" />{timeInfo.label}
                        </span>
                      ) : <span className="text-zinc-700">—</span>}
                    </td>

                    {/* Link */}
                    <td>
                      <Link
                        href={`/matches/${bet.match_id}`}
                        className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-2">
          <span className="text-xs text-zinc-500">Página {page} de {totalPages}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-600 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-600 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
