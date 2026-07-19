'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Trophy, ArrowUpDown, Info } from 'lucide-react'
import { Flag } from '@/components/ui/Flag'

interface SimEntry {
  team_id: string
  winner_prob: number
  final_prob: number
  semi_final_prob: number
  quarter_final_prob: number
  round_of_16_prob: number
  group_stage_advance_prob: number
  team: {
    name: string
    short_name: string
    code: string
    confederation: string
    elo_rating: number
  }
}

interface Props { simulations: SimEntry[] }

const CONFEDERATION_COLOR: Record<string, string> = {
  UEFA:     'text-blue-400 bg-blue-500/10 border-blue-500/20',
  CONMEBOL: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  CONCACAF: 'text-red-400 bg-red-500/10 border-red-500/20',
  AFC:      'text-violet-400 bg-violet-500/10 border-violet-500/20',
  CAF:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  OFC:      'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
}

type SortKey = 'winner' | 'final' | 'semi' | 'quarter' | 'r16' | 'groups' | 'elo'
type FilterType = 'all' | 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'AFC' | 'CAF'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'winner',  label: 'Campeón'       },
  { key: 'final',   label: 'Final'         },
  { key: 'semi',    label: 'Semifinal'     },
  { key: 'quarter', label: 'Cuartos'       },
  { key: 'r16',     label: 'Octavos'       },
  { key: 'groups',  label: 'Fase Grupos'   },
  { key: 'elo',     label: 'ELO'           },
]

function getProbBySort(sim: SimEntry, key: SortKey): number {
  switch (key) {
    case 'winner':  return sim.winner_prob
    case 'final':   return sim.final_prob
    case 'semi':    return sim.semi_final_prob
    case 'quarter': return sim.quarter_final_prob
    case 'r16':     return sim.round_of_16_prob
    case 'groups':  return sim.group_stage_advance_prob
    case 'elo':     return sim.team.elo_rating / 2200
  }
}

function ProbCell({ prob, maxProb }: { prob: number; maxProb: number }) {
  const pct = prob * 100
  const relWidth = maxProb > 0 ? (prob / maxProb) * 100 : 0
  const color =
    pct >= 50 ? 'text-emerald-400' :
    pct >= 20 ? 'text-amber-400'   :
    pct >= 5  ? 'text-zinc-300'    : 'text-zinc-600'
  const barColor =
    pct >= 50 ? 'bg-emerald-500' :
    pct >= 20 ? 'bg-amber-500'   :
    pct >= 5  ? 'bg-zinc-500'    : 'bg-zinc-700'

  return (
    <td className="px-2 py-3 text-center min-w-[60px]">
      <p className={cn('text-xs font-bold mono', color)}>{pct.toFixed(1)}%</p>
      <div className="mt-0.5 h-0.5 w-10 mx-auto bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${relWidth}%` }} />
      </div>
    </td>
  )
}

export function ChampionProbabilityBracket({ simulations }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortKey, setSortKey] = useState<SortKey>('winner')

  const sorted = [...simulations].sort((a, b) => getProbBySort(b, sortKey) - getProbBySort(a, sortKey))
  const filtered = filter === 'all' ? sorted : sorted.filter(s => s.team.confederation === filter)

  // Rank global por winner_prob pre-computado (evita O(n²) dentro del map de filas)
  const globalRankByTeamId = new Map(
    [...simulations].sort((a, b) => b.winner_prob - a.winner_prob).map((s, i) => [s.team_id, i + 1])
  )

  // Top 3 siempre por winner_prob
  const top3 = [...simulations].sort((a, b) => b.winner_prob - a.winner_prob).slice(0, 3)
  const hasData = simulations.length > 0 && simulations.some(s => s.winner_prob > 0)
  const confederations = Array.from(new Set(simulations.map(s => s.team.confederation))).sort()

  // Máximos por columna para escalar barras
  const maxByPhase = {
    winner:  Math.max(...simulations.map(s => s.winner_prob), 0.001),
    final:   Math.max(...simulations.map(s => s.final_prob), 0.001),
    semi:    Math.max(...simulations.map(s => s.semi_final_prob), 0.001),
    quarter: Math.max(...simulations.map(s => s.quarter_final_prob), 0.001),
    r16:     Math.max(...simulations.map(s => s.round_of_16_prob), 0.001),
    groups:  Math.max(...simulations.map(s => s.group_stage_advance_prob), 0.001),
  }

  // Podio: orden clásico 2°–1°–3°
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length === 2
    ? [top3[0], top3[1]]
    : top3

  const podiumRanks  = top3.length >= 3 ? [2, 1, 3] : [1, 2]
  const podiumColors = ['text-zinc-300', 'text-amber-400', 'text-amber-700']
  const podiumBg     = [
    'bg-zinc-700/20 border-zinc-700',
    'bg-amber-500/10 border-amber-500/30',
    'bg-amber-900/10 border-amber-900/30',
  ]
  const podiumBarColors = ['bg-zinc-400', 'bg-amber-500', 'bg-amber-700']

  return (
    <div className="space-y-6">

      {!hasData ? (
        <div className="card p-12 text-center space-y-3">
          <Trophy className="h-10 w-10 text-zinc-700 mx-auto" />
          <p className="text-sm font-medium text-zinc-500">Simulación pendiente</p>
          <p className="text-xs text-zinc-600 max-w-sm mx-auto">
            Las probabilidades se generan ejecutando la simulación Monte Carlo desde{' '}
            <code className="bg-zinc-800 px-1 rounded">/api/simulate</code>.
            Una vez ejecutada, los datos aparecen aquí automáticamente.
          </p>
        </div>
      ) : (
        <>
          {/* Podio 2°–1°–3° */}
          <div className={cn('grid gap-3', top3.length >= 3 ? 'grid-cols-3' : `grid-cols-${top3.length}`)}>
            {podiumOrder.map((sim, i) => {
              const rank = podiumRanks[i]
              const ri   = rank - 1
              const maxW = maxByPhase.winner
              return (
                <div key={sim.team_id}
                  className={cn('card p-4 text-center space-y-2 border flex flex-col items-center', podiumBg[ri])}>
                  <span className={cn('text-[10px] font-black uppercase tracking-widest', podiumColors[ri])}>
                    {rank === 1 ? '🥇 1°' : rank === 2 ? '🥈 2°' : '🥉 3°'}
                  </span>
                  <div className="flex items-center justify-center gap-1.5">
                    <Flag code={sim.team.code} />
                    <span className="text-sm font-bold text-white">{sim.team.code}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-tight">{sim.team.name}</p>
                  {sim.team.elo_rating > 0 && (
                    <p className="text-[10px] text-zinc-700 mono">ELO {sim.team.elo_rating}</p>
                  )}
                  <p className={cn('text-2xl font-black mono', podiumColors[ri])}>
                    {(sim.winner_prob * 100).toFixed(1)}%
                  </p>
                  {/* Barra relativa al líder */}
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', podiumBarColors[ri])}
                      style={{ width: `${(sim.winner_prob / maxW) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600">prob. campeón</p>
                </div>
              )
            })}
          </div>

          {/* Controles */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            {/* Filtro por confederación */}
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFilter('all')}
                className={cn('px-3 py-1 text-[10px] font-medium rounded-full border transition-colors',
                  filter === 'all' ? 'bg-zinc-700 border-zinc-600 text-white' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300')}>
                Todas
              </button>
              {confederations.map(conf => (
                <button key={conf} onClick={() => setFilter(conf as FilterType)}
                  className={cn('px-3 py-1 text-[10px] font-medium rounded-full border transition-colors',
                    CONFEDERATION_COLOR[conf] ?? 'text-zinc-400 bg-zinc-800/50 border-zinc-700',
                    filter === conf ? 'opacity-100' : 'opacity-60 hover:opacity-100')}>
                  {conf}
                </button>
              ))}
            </div>

            {/* Ordenar */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-3 w-3 text-zinc-600" />
              <span className="text-[10px] text-zinc-600">Ordenar:</span>
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="text-[10px] bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-zinc-300 focus:outline-none"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabla completa */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/80">
                    <th className="text-left px-4 py-3 text-zinc-500 font-medium w-8">#</th>
                    <th className="text-left px-4 py-3 text-zinc-500 font-medium">Selección</th>
                    <th className="text-center px-2 py-3 text-zinc-500 font-medium">ELO</th>
                    <th
                      className={cn('text-center px-2 py-3 font-medium cursor-pointer hover:text-zinc-300', sortKey === 'groups' ? 'text-emerald-400' : 'text-zinc-500')}
                      onClick={() => setSortKey('groups')}>
                      Grupos
                    </th>
                    <th
                      className={cn('text-center px-2 py-3 font-medium cursor-pointer hover:text-zinc-300', sortKey === 'r16' ? 'text-emerald-400' : 'text-zinc-500')}
                      onClick={() => setSortKey('r16')}>
                      Octavos
                    </th>
                    <th
                      className={cn('text-center px-2 py-3 font-medium cursor-pointer hover:text-zinc-300', sortKey === 'quarter' ? 'text-emerald-400' : 'text-zinc-500')}
                      onClick={() => setSortKey('quarter')}>
                      Cuartos
                    </th>
                    <th
                      className={cn('text-center px-2 py-3 font-medium cursor-pointer hover:text-zinc-300', sortKey === 'semi' ? 'text-emerald-400' : 'text-zinc-500')}
                      onClick={() => setSortKey('semi')}>
                      Semis
                    </th>
                    <th
                      className={cn('text-center px-2 py-3 font-medium cursor-pointer hover:text-zinc-300', sortKey === 'final' ? 'text-emerald-400' : 'text-zinc-500')}
                      onClick={() => setSortKey('final')}>
                      Final
                    </th>
                    <th
                      className={cn('text-center px-4 py-3 font-medium cursor-pointer hover:text-amber-300', sortKey === 'winner' ? 'text-amber-400' : 'text-zinc-500')}
                      onClick={() => setSortKey('winner')}>
                      Campeón ↕
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filtered.map((sim) => {
                    const rank = sorted.indexOf(sim) + 1
                    const globalRank = globalRankByTeamId.get(sim.team_id) ?? 0
                    const confStyle = CONFEDERATION_COLOR[sim.team.confederation] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'
                    return (
                      <tr key={sim.team_id} className={cn(
                        'hover:bg-zinc-800/30 transition-colors',
                        globalRank <= 3 && 'bg-amber-500/3'
                      )}>
                        <td className="px-4 py-2.5">
                          <span className={cn('text-sm font-bold mono',
                            globalRank === 1 ? 'text-amber-400' :
                            globalRank === 2 ? 'text-zinc-300' :
                            globalRank === 3 ? 'text-amber-700' : 'text-zinc-600')}>
                            {rank}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Flag code={sim.team.code} />
                            <div>
                              <p className="font-semibold text-zinc-200">{sim.team.short_name ?? sim.team.name}</p>
                              <span className={cn('text-[10px] border rounded px-1.5 py-0.5', confStyle)}>
                                {sim.team.confederation}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className="text-[10px] text-zinc-500 mono">{sim.team.elo_rating || '—'}</span>
                        </td>
                        <ProbCell prob={sim.group_stage_advance_prob} maxProb={maxByPhase.groups} />
                        <ProbCell prob={sim.round_of_16_prob}         maxProb={maxByPhase.r16}    />
                        <ProbCell prob={sim.quarter_final_prob}       maxProb={maxByPhase.quarter} />
                        <ProbCell prob={sim.semi_final_prob}          maxProb={maxByPhase.semi}   />
                        <ProbCell prob={sim.final_prob}               maxProb={maxByPhase.final}  />
                        <td className="px-4 py-2.5 text-center">
                          <p className={cn('text-sm font-black mono',
                            sim.winner_prob * 100 >= 15 ? 'text-amber-400' :
                            sim.winner_prob * 100 >= 5  ? 'text-zinc-300' : 'text-zinc-600')}>
                            {(sim.winner_prob * 100).toFixed(1)}%
                          </p>
                          <div className="mt-1 w-16 mx-auto h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${(sim.winner_prob / maxByPhase.winner) * 100}%` }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Nota metodológica */}
          <div className="flex items-start gap-1.5 text-[10px] text-zinc-700">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <span>
              Las probabilidades se calculan simulando el torneo completo 3.000 veces mediante Monte Carlo.
              Las barras horizontales son relativas al equipo favorito de cada fase (no a 100%).
              Columnas con ↕ o clic son ordenables. Suma Σ campeón debe ser ≈100%.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
