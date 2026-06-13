'use client'

import { cn } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'

interface Props {
  stats: any[]
  homeTeam: any
  awayTeam: any
}

interface StatRowProps {
  label: string
  home: number
  away: number
  unit?: string
  higherIsBetter?: boolean
  format?: (v: number) => string
}

function StatRow({ label, home, away, unit = '', higherIsBetter = true, format: fmt }: StatRowProps) {
  const total = home + away || 1
  const homePct = (home / total) * 100
  const awayPct = (away / total) * 100
  const homeWins = higherIsBetter ? home > away : home < away

  const display = fmt ?? ((v: number) => `${v}${unit}`)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-bold mono', homeWins ? 'text-emerald-400' : 'text-zinc-300')}>
          {display(home)}
        </span>
        <span className="text-[10px] text-zinc-500">{label}</span>
        <span className={cn('font-bold mono', !homeWins && home !== away ? 'text-emerald-400' : 'text-zinc-300')}>
          {display(away)}
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800">
        <div
          className={cn('transition-all duration-700', homeWins ? 'bg-emerald-500' : 'bg-zinc-600')}
          style={{ width: `${homePct}%` }}
        />
        <div
          className={cn('transition-all duration-700', !homeWins && home !== away ? 'bg-blue-500' : 'bg-zinc-700')}
          style={{ width: `${awayPct}%` }}
        />
      </div>
    </div>
  )
}

export function MatchStatsComparison({ stats, homeTeam, awayTeam }: Props) {
  const home = stats.find((s: any) => s.team_id === homeTeam.id) ?? {}
  const away = stats.find((s: any) => s.team_id === awayTeam.id) ?? {}

  const rows: StatRowProps[] = [
    { label: 'Posesión', home: home.possession ?? 50, away: away.possession ?? 50, unit: '%' },
    { label: 'Tiros',    home: home.shots ?? 0,       away: away.shots ?? 0 },
    { label: 'A puerta', home: home.shots_on_target ?? 0, away: away.shots_on_target ?? 0 },
    { label: 'xG',       home: home.xg ?? 0, away: away.xg ?? 0, format: (v) => v.toFixed(2) },
    { label: 'Córners',  home: home.corners ?? 0, away: away.corners ?? 0 },
    { label: 'Faltas',   home: home.fouls ?? 0, away: away.fouls ?? 0, higherIsBetter: false },
    { label: 'Amarillas', home: home.yellow_cards ?? 0, away: away.yellow_cards ?? 0, higherIsBetter: false },
    { label: 'Pases',    home: home.passes ?? 0, away: away.passes ?? 0 },
    { label: 'Precisión pase', home: home.pass_accuracy ?? 0, away: away.pass_accuracy ?? 0, unit: '%' },
    { label: 'Paradas',  home: home.saves ?? 0, away: away.saves ?? 0 },
  ]

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Estadísticas del Partido</h3>
        </div>
        {/* Team labels */}
        <div className="flex items-center gap-4 text-xs">
          <span className="text-emerald-400 font-semibold">{homeTeam.code}</span>
          <span className="text-zinc-600">vs</span>
          <span className="text-blue-400 font-semibold">{awayTeam.code}</span>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <StatRow key={row.label} {...row} />
        ))}
      </div>
    </div>
  )
}
