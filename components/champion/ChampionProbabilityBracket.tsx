'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Trophy, Medal, Star } from 'lucide-react'
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
  UEFA: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  CONMEBOL: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  CONCACAF: 'text-red-400 bg-red-500/10 border-red-500/20',
  AFC: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  CAF: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  OFC: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
}

function ProbBar({ prob, color, width = 'full' }: { prob: number; color: string; width?: string }) {
  return (
    <div className={cn('h-1.5 bg-zinc-800 rounded-full overflow-hidden w-' + width)}>
      <div className={cn('h-full rounded-full transition-all duration-700', color)}
        style={{ width: `${prob * 100}%` }} />
    </div>
  )
}

function PhaseCell({ prob, label }: { prob: number; label: string }) {
  const pct = Math.round(prob * 100)
  const color = pct >= 50 ? 'text-emerald-400' : pct >= 20 ? 'text-amber-400' : pct >= 5 ? 'text-zinc-300' : 'text-zinc-600'
  return (
    <div className="text-center">
      <p className={cn('text-xs font-bold mono', color)}>{pct}%</p>
      <p className="text-[9px] text-zinc-700">{label}</p>
    </div>
  )
}

type FilterType = 'all' | 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'AFC' | 'CAF'

export function ChampionProbabilityBracket({ simulations }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')

  const sorted = [...simulations].sort((a, b) => b.winner_prob - a.winner_prob)
  const filtered = filter === 'all' ? sorted : sorted.filter(s => s.team.confederation === filter)

  const top3 = sorted.slice(0, 3)
  const hasData = sorted.length > 0 && sorted[0].winner_prob > 0

  const confederations = Array.from(new Set(sorted.map(s => s.team.confederation)))

  return (
    <div className="space-y-6">

      {!hasData ? (
        /* Estado vacío — la simulación Monte Carlo aún no se ha ejecutado */
        <div className="card p-12 text-center space-y-3">
          <Trophy className="h-10 w-10 text-zinc-700 mx-auto" />
          <p className="text-sm font-medium text-zinc-500">Simulación pendiente</p>
          <p className="text-xs text-zinc-600 max-w-sm mx-auto">
            Las probabilidades de campeón se generan ejecutando la simulación Monte Carlo del torneo
            desde <code className="bg-zinc-800 px-1 rounded">/api/simulate</code>.
            Una vez ejecutada, los datos aparecen aquí automáticamente.
          </p>
        </div>
      ) : (
        <>
          {/* Podio top 3 */}
          <div className="grid grid-cols-3 gap-3">
            {top3.map((sim, i) => {
              const medalColors = ['text-amber-400', 'text-zinc-300', 'text-amber-600']
              const bgColors = ['bg-amber-500/10 border-amber-500/30', 'bg-zinc-700/20 border-zinc-700', 'bg-amber-900/10 border-amber-900/30']
              return (
                <div key={sim.team_id} className={cn('card p-4 text-center space-y-2 border', bgColors[i])}>
                  <div className="flex justify-center">
                    {i === 0 ? <Trophy className={cn('h-6 w-6', medalColors[i])} /> : <Medal className={cn('h-5 w-5', medalColors[i])} />}
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <Flag code={sim.team.code} />
                    <span className="text-sm font-bold text-white">{sim.team.code}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500">{sim.team.name}</p>
                  <p className={cn('text-2xl font-black mono', medalColors[i])}>
                    {(sim.winner_prob * 100).toFixed(1)}%
                  </p>
                  <ProbBar prob={sim.winner_prob * 5} color={i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-zinc-400' : 'bg-amber-700'} />
                  <p className="text-[9px] text-zinc-600">prob. de campeonato</p>
                </div>
              )
            })}
          </div>

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

          {/* Tabla completa */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/80">
                    <th className="text-left px-4 py-3 text-zinc-500 font-medium">#</th>
                    <th className="text-left px-4 py-3 text-zinc-500 font-medium">Selección</th>
                    <th className="text-center px-3 py-3 text-zinc-500 font-medium">Fase Gpos.</th>
                    <th className="text-center px-3 py-3 text-zinc-500 font-medium">Octavos</th>
                    <th className="text-center px-3 py-3 text-zinc-500 font-medium">Cuartos</th>
                    <th className="text-center px-3 py-3 text-zinc-500 font-medium">Semis</th>
                    <th className="text-center px-3 py-3 text-zinc-500 font-medium">Final</th>
                    <th className="text-center px-4 py-3 text-amber-500 font-medium">Campeón</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filtered.map((sim, idx) => {
                    const rank = sorted.indexOf(sim) + 1
                    const confStyle = CONFEDERATION_COLOR[sim.team.confederation] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'
                    const winPct = sim.winner_prob * 100
                    return (
                      <tr key={sim.team_id} className={cn(
                        'hover:bg-zinc-800/30 transition-colors',
                        rank <= 3 && 'bg-amber-500/3'
                      )}>
                        <td className="px-4 py-3">
                          <span className={cn('text-sm font-bold mono',
                            rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-zinc-300' : rank === 3 ? 'text-amber-700' : 'text-zinc-600')}>
                            {rank}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Flag code={sim.team.code} />
                            <div>
                              <p className="font-semibold text-zinc-200">{sim.team.short_name ?? sim.team.name}</p>
                              <span className={cn('text-[9px] border rounded px-1.5 py-0.5', confStyle)}>
                                {sim.team.confederation}
                              </span>
                            </div>
                          </div>
                        </td>
                        <PhaseCell prob={sim.group_stage_advance_prob} label="" />
                        <PhaseCell prob={sim.round_of_16_prob} label="" />
                        <PhaseCell prob={sim.quarter_final_prob} label="" />
                        <PhaseCell prob={sim.semi_final_prob} label="" />
                        <PhaseCell prob={sim.final_prob} label="" />
                        <td className="px-4 py-3 text-center">
                          <p className={cn('text-sm font-black mono',
                            winPct >= 15 ? 'text-amber-400' : winPct >= 5 ? 'text-zinc-300' : 'text-zinc-600')}>
                            {winPct.toFixed(1)}%
                          </p>
                          <div className="mt-1 w-16 mx-auto h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${Math.min(100, winPct * 5)}%` }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <p className="text-[10px] text-zinc-700 text-center">
        Probabilidades calculadas mediante simulación Monte Carlo del torneo completo ·
        Modelo basado en ELO rating y forma reciente
      </p>
    </div>
  )
}
