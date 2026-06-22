'use client'

import { cn } from '@/lib/utils'
import { Award, TrendingUp } from 'lucide-react'

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

  return (
    <div className="space-y-4">
      {/* 1X2 table */}
      {hasMain && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
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
                    <td className="py-2.5 pr-4 text-violet-400 font-semibold">Modelo</td>
                    <td className="text-center py-2.5 px-3 mono font-bold text-emerald-400">
                      {(1 / prediction.home_win_probability).toFixed(2)}
                    </td>
                    <td className="text-center py-2.5 px-3 mono font-bold text-amber-400">
                      {(1 / prediction.draw_probability).toFixed(2)}
                    </td>
                    <td className="text-center py-2.5 px-3 mono font-bold text-red-400">
                      {(1 / prediction.away_win_probability).toFixed(2)}
                    </td>
                    <td className="text-center py-2.5 pl-3 text-zinc-600 mono text-[11px]">—</td>
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
                      <td className="py-2.5 pr-4 text-zinc-300 font-medium">{bk}</td>
                      <td
                        className={cn(
                          'text-center py-2.5 px-3 mono font-bold',
                          hw && hw.odds_value === bestOf('home_win')
                            ? 'text-emerald-400'
                            : 'text-zinc-400'
                        )}
                      >
                        {hw ? hw.odds_value.toFixed(2) : <span className="text-zinc-700">—</span>}
                      </td>
                      <td
                        className={cn(
                          'text-center py-2.5 px-3 mono font-bold',
                          dr && dr.odds_value === bestOf('draw')
                            ? 'text-emerald-400'
                            : 'text-zinc-400'
                        )}
                      >
                        {dr ? dr.odds_value.toFixed(2) : <span className="text-zinc-700">—</span>}
                      </td>
                      <td
                        className={cn(
                          'text-center py-2.5 px-3 mono font-bold',
                          aw && aw.odds_value === bestOf('away_win')
                            ? 'text-emerald-400'
                            : 'text-zinc-400'
                        )}
                      >
                        {aw ? aw.odds_value.toFixed(2) : <span className="text-zinc-700">—</span>}
                      </td>
                      <td className="text-center py-2.5 pl-3 text-zinc-500 mono text-[11px]">
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
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Otros Mercados</h3>
          </div>

          <div className="space-y-3">
            {otherMarkets.map((market) => {
              const rows = byMarket[market] ?? []
              const best = Math.max(...rows.map((o) => o.odds_value))

              return (
                <div key={market} className="border-b border-zinc-800/50 pb-3 last:border-0">
                  <p className="text-[10px] text-zinc-500 mb-2">
                    {MARKET_LABEL[market] ?? market}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {rows.map((o) => (
                      <div
                        key={o.bookmaker}
                        className={cn(
                          'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] border',
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
