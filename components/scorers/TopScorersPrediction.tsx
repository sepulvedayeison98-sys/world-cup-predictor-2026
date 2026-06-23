'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Flag } from '@/components/ui/Flag'
import { Target, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'

interface Player {
  player_id: string
  goals: number
  assists: number
  matches_played: number
  shots: number
  shots_on_target: number
  avg_rating: number
  form_score: number
  physical_condition: number
  goalsPerGame: number
  expectedRemaining: number
  projectedGoals: number
  teamAdvanceProb: number
  player: {
    id: string
    name: string
    short_name: string
    position: string
    photo_url: string | null
    team_id: string
    team: {
      id: string
      name: string
      short_name: string
      code: string
      confederation: string
    }
  }
}

interface Props { players: Player[] }

const POSITION_COLOR: Record<string, string> = {
  FW: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  MF: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  DF: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
  GK: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
}

const CONFEDERATION_COLOR: Record<string, string> = {
  UEFA:     'text-blue-400',
  CONMEBOL: 'text-amber-400',
  CONCACAF: 'text-red-400',
  AFC:      'text-violet-400',
  CAF:      'text-emerald-400',
  OFC:      'text-cyan-400',
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

function TopThreePodium({ players }: { players: Player[] }) {
  const top3 = players.slice(0, 3)
  if (top3.length === 0) return null

  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3.length === 2 ? [top3[0], top3[1]] : [top3[0]]
  const ranks = top3.length >= 3 ? [2, 1, 3] : top3.length === 2 ? [1, 2] : [1]

  const heightClass = ['h-24', 'h-32', 'h-20']
  const rankColors = ['text-zinc-300', 'text-amber-400', 'text-amber-700']
  const bgColors = ['bg-zinc-700/20 border-zinc-700', 'bg-amber-500/10 border-amber-500/30', 'bg-amber-900/10 border-amber-900/30']

  return (
    <div className="grid grid-cols-3 gap-3">
      {podiumOrder.map((player, i) => {
        const rank = ranks[i]
        const ri = rank - 1
        return (
          <div key={player.player_id} className={cn('card p-4 text-center space-y-2 border flex flex-col items-center', bgColors[ri])}>
            <span className={cn('text-xs font-black mono', rankColors[ri])}>#{rank}</span>
            {player.player?.photo_url ? (
              <img src={player.player.photo_url} alt={player.player.short_name} className="w-10 h-10 rounded-full object-cover mx-auto border border-zinc-700" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto">
                <Target className="h-4 w-4 text-zinc-600" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-white leading-tight">{player.player?.short_name ?? player.player?.name}</p>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <Flag code={player.player?.team?.code} />
                <span className="text-[9px] text-zinc-500">{player.player?.team?.code}</span>
              </div>
            </div>
            <div>
              <p className={cn('text-2xl font-black mono', rankColors[ri])}>{player.goals}</p>
              <p className="text-[9px] text-zinc-600">goles actuales</p>
            </div>
            <div className="w-full">
              <p className="text-xs font-bold text-emerald-400 mono">+{player.projectedGoals.toFixed(1)}</p>
              <p className="text-[9px] text-zinc-600">proyectados</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TopScorersPrediction({ players }: Props) {
  const [showAll, setShowAll] = useState(false)
  const [sortBy, setSortBy] = useState<'goals' | 'projected' | 'perGame'>('goals')

  const sorted = [...players].sort((a, b) => {
    if (sortBy === 'goals')     return b.goals - a.goals || b.projectedGoals - a.projectedGoals
    if (sortBy === 'projected') return b.projectedGoals - a.projectedGoals || b.goals - a.goals
    return b.goalsPerGame - a.goalsPerGame || b.goals - a.goals
  })

  const visible = showAll ? sorted : sorted.slice(0, 15)
  const maxGoals = sorted[0]?.goals ?? 1
  const maxProjected = Math.max(...sorted.map(p => p.projectedGoals), 1)
  const maxPerGame = Math.max(...sorted.map(p => p.goalsPerGame), 1)

  if (sorted.length === 0) {
    return (
      <div className="card p-12 text-center space-y-3">
        <Target className="h-10 w-10 text-zinc-700 mx-auto" />
        <p className="text-sm font-medium text-zinc-500">Sin datos de goleadores</p>
        <p className="text-xs text-zinc-600 max-w-sm mx-auto">
          Las estadísticas de jugadores aparecerán aquí cuando estén disponibles en la base de datos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TopThreePodium players={sorted} />

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-600">Ordenar por:</span>
        {([
          ['goals',     'Goles actuales'],
          ['projected', 'Proyección total'],
          ['perGame',   'Goles/partido'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSortBy(key)}
            className={cn(
              'px-3 py-1 text-[10px] font-medium rounded-full border transition-colors',
              sortBy === key
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
            )}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">#</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Jugador</th>
                <th className="text-center px-3 py-3 text-zinc-500 font-medium">PJ</th>
                <th className="text-center px-3 py-3 text-zinc-500 font-medium">Goles</th>
                <th className="text-center px-3 py-3 text-zinc-500 font-medium">Ast.</th>
                <th className="text-center px-3 py-3 text-zinc-500 font-medium">G/P</th>
                <th className="text-center px-3 py-3 text-zinc-500 font-medium">P. Rest.</th>
                <th className="text-center px-4 py-3 text-emerald-500 font-medium">Proyección</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {visible.map((player, idx) => {
                const rank = sorted.indexOf(player) + 1
                const pos = player.player?.position?.slice(0, 2).toUpperCase() ?? 'FW'
                const posColor = POSITION_COLOR[pos] ?? POSITION_COLOR['FW']
                const confColor = CONFEDERATION_COLOR[player.player?.team?.confederation] ?? 'text-zinc-400'

                return (
                  <tr key={player.player_id} className={cn(
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
                      <div className="flex items-center gap-2.5">
                        {player.player?.photo_url ? (
                          <img src={player.player.photo_url} alt="" className="w-7 h-7 rounded-full object-cover border border-zinc-700 shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-200 truncate">{player.player?.short_name ?? player.player?.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Flag code={player.player?.team?.code} />
                            <span className={cn('text-[9px] font-medium', confColor)}>{player.player?.team?.code}</span>
                            <span className={cn('text-[8px] border rounded px-1', posColor)}>{pos}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-zinc-400 mono">{player.matches_played}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-center">
                        <p className={cn('font-bold mono', rank <= 3 ? 'text-amber-400' : 'text-zinc-200')}>{player.goals}</p>
                        <MiniBar value={player.goals} max={maxGoals} color={rank <= 3 ? 'bg-amber-500' : 'bg-zinc-600'} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-zinc-400 mono">{player.assists}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-zinc-300 mono">{player.goalsPerGame.toFixed(2)}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-zinc-400 mono">{player.expectedRemaining.toFixed(1)}</span>
                        <span className="text-[9px] text-zinc-600">{Math.round(player.teamAdvanceProb * 100)}% avance</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-center">
                        <p className="text-emerald-400 font-black mono text-sm">
                          {(player.goals + player.projectedGoals).toFixed(1)}
                        </p>
                        <p className="text-[9px] text-zinc-600">+{player.projectedGoals.toFixed(1)} más</p>
                        <MiniBar value={player.goals + player.projectedGoals} max={maxGoals + maxProjected} color="bg-emerald-500" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {sorted.length > 15 && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-xs text-zinc-500 hover:text-zinc-300 border-t border-zinc-800 transition-colors"
          >
            {showAll ? (
              <><ChevronUp className="h-3.5 w-3.5" /> Mostrar menos</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5" /> Ver los {sorted.length - 15} restantes</>
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px] text-zinc-700">
        <TrendingUp className="h-3 w-3" />
        <span>
          Proyección = goles/partido × partidos esperados restantes (grupos + rondas eliminatorias ponderadas por probabilidad de avance)
        </span>
      </div>
    </div>
  )
}
