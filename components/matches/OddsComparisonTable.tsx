'use client'

import { cn } from '@/lib/utils'
import { Award, TrendingUp, Activity, Users, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { runMarketMovementAgent } from '@/lib/agents/marketMovementAgent'

const MARKET_LABEL: Record<string, string> = {
  home_win:        'Victoria Local',
  draw:            'Empate',
  away_win:        'Victoria Visitante',
  over_0_5:        'Más de 0.5 goles',
  over_1_5:        'Más de 1.5 goles',
  over_2_5:        'Más de 2.5 goles',
  over_3_5:        'Más de 3.5 goles',
  btts_yes:        'Ambos marcan: Sí',
  btts_no:         'Ambos marcan: No',
  clean_sheet_home:'Portería a 0 Local',
  clean_sheet_away:'Portería a 0 Visitante',
}

interface OddsRow {
  bookmaker: string
  odds_value: number
  implied_probability: number
  margin?: number
}

interface Props {
  odds: any[]
  prediction?: any
  homeTeam: any
  awayTeam: any
}

export function OddsComparisonTable({ odds, prediction, homeTeam, awayTeam }: Props) {
  const marketReport = runMarketMovementAgent({ odds, prediction })
  const { summary: mkt, valueDiscrepancies, alignment, alignmentNote } = marketReport

  // Group by market → bookmaker
  const byMarket: Record<string, OddsRow[]> = {}
  for (const o of odds) {
    if (!byMarket[o.market]) byMarket[o.market] = []
    byMarket[o.market].push({
      bookmaker:           o.bookmaker,
      odds_value:          o.odds_value,
      implied_probability: o.implied_probability ?? 1 / o.odds_value,
    })
  }

  const allBookmakers = [...new Set(odds.map((o: any) => o.bookmaker))]
  const hasMain =
    ['home_win', 'draw', 'away_win'].some((m) => (byMarket[m]?.length ?? 0) > 0)
  const otherMarkets = Object.keys(byMarket).filter(
    (m) => !['home_win', 'draw', 'away_win'].includes(m)
  )

  if (odds.length === 0) {
    return (
      <div className="card p-8 flex flex-col items-center gap-2 text-zinc-600">
        <Award className="h-8 w-8" />
        <p className="text-sm">Sin cuotas disponibles para este partido.</p>
        <p className="text-[11px]">Se actualizan automáticamente cuando hay datos de casas de apuestas.</p>
      </div>
    )
  }

  const bestOf = (market: string) =>
    Math.max(...(byMarket[market]?.map((o) => o.odds_value) ?? [0]))

  // Overround margin for a bookmaker across 1X2
  const margin1x2 = (bk: string) => {
    const hw = byMarket['home_win']?.find((o) => o.bookmaker === bk)
    const dr = byMarket['draw']?.find((o) => o.bookmaker === bk)
    const aw = byMarket['away_win']?.find((o) => o.bookmaker === bk)
    const total =
      (hw?.implied_probability ?? 0) +
      (dr?.implied_probability ?? 0) +
      (aw?.implied_probability ?? 0)
    return total > 0 ? ((total - 1) * 100).toFixed(1) : '—'
  }

  const ALIGN_COLOR: Record<string, string> = {
    fuerte:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    moderado:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
    débil:     'text-red-400 bg-red-500/10 border-red-500/20',
    sin_datos: 'text-zinc-500 bg-zinc-800/50 border-zinc-700',
  }

  const SIGNAL_ICON = {
    sube_local:      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />,
    sube_visitante:  <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />,
    sube_empate:     <ArrowUpRight className="h-3.5 w-3.5 text-amber-400" />,
    estable:         <Minus className="h-3.5 w-3.5 text-zinc-400" />,
    sin_datos:       <Activity className="h-3.5 w-3.5 text-zinc-600" />,
  }

  return (
    <div className="space-y-4">

      {/* Market movement signal */}
      <div className="card p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Movimiento de Mercado</h3>
          {mkt.signal !== 'sin_datos' && (
            <span className={cn('ml-auto text-[10px] font-semibold border rounded-full px-2 py-0.5', ALIGN_COLOR[alignment])}>
              {alignment.toUpperCase()}
            </span>
          )}
        </div>

        {mkt.signal === 'sin_datos' ? (
          <p className="text-xs text-zinc-600">Sin datos de cuotas para analizar movimiento de mercado.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {/* Signal */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-center">
                <div className="flex justify-center mb-1">{SIGNAL_ICON[mkt.signal]}</div>
                <p className={cn('text-xs font-bold', mkt.signalColor)}>{mkt.signalLabel}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Señal</p>
              </div>

              {/* Consensus */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-center">
                <p className="text-base font-black mono text-zinc-200">{Math.round(mkt.consensusStrength * 100)}%</p>
                <p className="text-[10px] text-zinc-600">Consenso</p>
                <div className="mt-1 h-0.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${mkt.consensusStrength * 100}%` }} />
                </div>
              </div>

              {/* Bookmakers */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-center">
                <div className="flex justify-center mb-1"><Users className="h-3.5 w-3.5 text-zinc-500" /></div>
                <p className="text-base font-black mono text-zinc-200">{mkt.bookmakerCount}</p>
                <p className="text-[10px] text-zinc-600">Casas</p>
              </div>

              {/* Sharpest */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-center">
                <p className="text-[10px] font-bold text-amber-400 truncate">{mkt.sharpestBook ?? '—'}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Casa más sharp</p>
              </div>
            </div>

            {/* Spread bars */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Spread entre bookmakers (menor = más consenso)</p>
              {[
                { label: homeTeam?.code ?? 'Local', val: mkt.spread.home, implied: mkt.implied.home, color: 'bg-emerald-500' },
                { label: 'Empate',                  val: mkt.spread.draw, implied: mkt.implied.draw, color: 'bg-amber-500' },
                { label: awayTeam?.code ?? 'Visit.', val: mkt.spread.away, implied: mkt.implied.away, color: 'bg-red-500' },
              ].map(({ label, val, implied, color }) => {
                const maxSpread = Math.max(mkt.spread.home, mkt.spread.draw, mkt.spread.away, 0.001)
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 w-14 shrink-0">{label}</span>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', color)} style={{ width: `${(val / maxSpread) * 100}%` }} />
                    </div>
                    <span className="text-[10px] mono text-zinc-400 w-10 text-right">{(val * 100).toFixed(1)}pp</span>
                    <span className="text-[10px] mono text-zinc-600 w-10 text-right">{Math.round(implied * 100)}%</span>
                  </div>
                )
              })}
            </div>

            <p className="text-[10px] text-zinc-600 leading-relaxed">{alignmentNote}</p>

            {/* Value discrepancies */}
            {valueDiscrepancies.length > 0 && (
              <div className="border-t border-zinc-800 pt-3 space-y-1.5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Discrepancias modelo vs mercado</p>
                {valueDiscrepancies.map((d) => {
                  const isEdge = d.edge > 0
                  return (
                    <div key={d.outcome} className="flex items-center gap-2">
                      {isEdge
                        ? <ArrowUpRight className="h-3 w-3 text-emerald-400 shrink-0" />
                        : <ArrowDownRight className="h-3 w-3 text-red-400 shrink-0" />
                      }
                      <span className="text-[10px] text-zinc-400">
                        {d.outcome === 'home' ? (homeTeam?.code ?? 'Local') : d.outcome === 'away' ? (awayTeam?.code ?? 'Visit.') : 'Empate'}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        Modelo {Math.round(d.modelProb * 100)}% vs Mercado {Math.round(d.marketProb * 100)}%
                      </span>
                      <span className={cn('ml-auto text-[10px] font-bold mono', isEdge ? 'text-emerald-400' : 'text-red-400')}>
                        {isEdge ? '+' : ''}{(d.edge * 100).toFixed(1)}pp
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* 1X2 table */}
      {hasMain && (
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">1X2 — Comparativa de Casas</h3>
            <span className="ml-auto text-[10px] text-zinc-600">Mejor cuota en verde</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 pr-4 text-zinc-500 font-medium w-28">Casa</th>
                  <th className="text-center py-2 px-3 text-emerald-400 font-medium">
                    {homeTeam?.code ?? '1'}
                  </th>
                  <th className="text-center py-2 px-3 text-amber-400 font-medium">X</th>
                  <th className="text-center py-2 px-3 text-red-400 font-medium">
                    {awayTeam?.code ?? '2'}
                  </th>
                  <th className="text-center py-2 pl-3 text-zinc-600 font-medium">Margen</th>
                </tr>
              </thead>
              <tbody>
                {/* Modelo row */}
                {prediction && (
                  <tr className="border-b border-zinc-800/40 bg-violet-500/5">
                    <td className="py-2 pr-4 text-violet-400 font-semibold">Modelo</td>
                    <td className="text-center py-2 px-2 mono font-bold text-emerald-400">
                      {(1 / prediction.home_win_probability).toFixed(2)}
                    </td>
                    <td className="text-center py-2 px-2 mono font-bold text-amber-400">
                      {(1 / prediction.draw_probability).toFixed(2)}
                    </td>
                    <td className="text-center py-2 px-2 mono font-bold text-red-400">
                      {(1 / prediction.away_win_probability).toFixed(2)}
                    </td>
                    <td className="text-center py-2 pl-2 text-zinc-600 mono text-[11px]">—</td>
                  </tr>
                )}

                {allBookmakers.map((bk) => {
                  const hw = byMarket['home_win']?.find((o) => o.bookmaker === bk)
                  const dr = byMarket['draw']?.find((o) => o.bookmaker === bk)
                  const aw = byMarket['away_win']?.find((o) => o.bookmaker === bk)

                  return (
                    <tr
                      key={bk}
                      className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors"
                    >
                      <td className="py-2 pr-4 text-zinc-300 font-medium">
                        <span className="flex items-center gap-1.5">
                          {bk}
                          {bk === 'Pinnacle' ? (
                            <span className="rounded px-1 py-px text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Real</span>
                          ) : (
                            <span className="rounded px-1 py-px text-[8px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-500 border border-zinc-700">Derivada</span>
                          )}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'text-center py-2 px-2 mono font-bold',
                          hw && hw.odds_value === bestOf('home_win')
                            ? 'text-emerald-400'
                            : 'text-zinc-400'
                        )}
                      >
                        {hw ? hw.odds_value.toFixed(2) : <span className="text-zinc-700">—</span>}
                      </td>
                      <td
                        className={cn(
                          'text-center py-2 px-2 mono font-bold',
                          dr && dr.odds_value === bestOf('draw')
                            ? 'text-emerald-400'
                            : 'text-zinc-400'
                        )}
                      >
                        {dr ? dr.odds_value.toFixed(2) : <span className="text-zinc-700">—</span>}
                      </td>
                      <td
                        className={cn(
                          'text-center py-2 px-2 mono font-bold',
                          aw && aw.odds_value === bestOf('away_win')
                            ? 'text-emerald-400'
                            : 'text-zinc-400'
                        )}
                      >
                        {aw ? aw.odds_value.toFixed(2) : <span className="text-zinc-700">—</span>}
                      </td>
                      <td className="text-center py-2 pl-2 text-zinc-500 mono text-[11px]">
                        {margin1x2(bk)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[10px] text-zinc-600">
            Fila "Modelo" = cuotas justas implícitas del motor de predicción (sin margen de casa).
            Margen = sobreround de la casa; menor es mejor para el apostador.
          </p>
        </div>
      )}

      {/* Otros mercados */}
      {otherMarkets.length > 0 && (
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Otros Mercados</h3>
          </div>

          <div className="space-y-2">
            {otherMarkets.map((market) => {
              const rows = byMarket[market] ?? []
              const best = Math.max(...rows.map((o) => o.odds_value))

              return (
                <div key={market} className="border-b border-zinc-800/50 pb-2 last:border-0">
                  <p className="text-[10px] text-zinc-500 mb-1.5">
                    {MARKET_LABEL[market] ?? market}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rows.map((o) => (
                      <div
                        key={o.bookmaker}
                        className={cn(
                          'flex items-center gap-1.5 rounded px-2 py-1 text-[11px] border',
                          o.odds_value === best
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-zinc-800/60 border-zinc-800'
                        )}
                      >
                        <span className="text-zinc-400">{o.bookmaker}</span>
                        <span
                          className={cn(
                            'mono font-bold',
                            o.odds_value === best ? 'text-emerald-400' : 'text-zinc-300'
                          )}
                        >
                          {o.odds_value.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
