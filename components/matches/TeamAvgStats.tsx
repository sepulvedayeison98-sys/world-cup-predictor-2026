'use client'

import { cn } from '@/lib/utils'
import { Activity } from 'lucide-react'

function AvgRow({
  label,
  home,
  away,
  higherIsBetter = true,
  format: fmt,
}: {
  label: string
  home: number | null
  away: number | null
  higherIsBetter?: boolean
  format?: (v: number) => string
}) {
  const h = home ?? 0
  const a = away ?? 0
  const total = h + a || 1
  const homePct = (h / total) * 100
  const awayPct = (a / total) * 100
  const homeWins = higherIsBetter ? h > a : h < a
  const tied = h === a
  const display = fmt ?? ((v: number) => v.toFixed(1))

  if (home === null && away === null) return null

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-bold mono w-10', homeWins && !tied ? 'text-emerald-400' : 'text-zinc-300')}>
          {home !== null ? display(home) : 'N/D'}
        </span>
        <span className="text-[10px] text-zinc-500">{label}</span>
        <span className={cn('font-bold mono w-10 text-right', !homeWins && !tied ? 'text-emerald-400' : 'text-zinc-300')}>
          {away !== null ? display(away) : 'N/D'}
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800">
        <div
          className={cn('transition-all duration-700', homeWins && !tied ? 'bg-emerald-500' : 'bg-zinc-600')}
          style={{ width: `${homePct}%` }}
        />
        <div
          className={cn('transition-all duration-700', !homeWins && !tied ? 'bg-blue-500' : 'bg-zinc-700')}
          style={{ width: `${awayPct}%` }}
        />
      </div>
    </div>
  )
}

interface Props {
  homeTeam: any
  awayTeam: any
  homeStats: any
  awayStats: any
}

export function TeamAvgStats({ homeTeam, awayTeam, homeStats, awayStats }: Props) {
  const rows = [
    {
      label: 'Córners / partido',
      home: homeStats.avg_corners ?? null,
      away: awayStats.avg_corners ?? null,
    },
    {
      label: 'Amarillas / partido',
      home: homeStats.avg_yellow_cards ?? null,
      away: awayStats.avg_yellow_cards ?? null,
      higherIsBetter: false,
    },
    {
      label: 'Rojas / partido',
      home: homeStats.avg_red_cards ?? null,
      away: awayStats.avg_red_cards ?? null,
      higherIsBetter: false,
    },
    {
      label: 'Tiros / partido',
      home: homeStats.avg_shots ?? null,
      away: awayStats.avg_shots ?? null,
    },
    {
      label: 'A puerta / partido',
      home: homeStats.avg_shots_on_target ?? null,
      away: awayStats.avg_shots_on_target ?? null,
    },
    {
      label: 'xG / partido',
      home: homeStats.avg_xg ?? null,
      away: awayStats.avg_xg ?? null,
      format: (v: number) => v.toFixed(2),
    },
    {
      label: 'xGA / partido',
      home: homeStats.avg_xga ?? null,
      away: awayStats.avg_xga ?? null,
      higherIsBetter: false,
      format: (v: number) => v.toFixed(2),
    },
    {
      label: 'Posesión media',
      home: homeStats.avg_possession ?? null,
      away: awayStats.avg_possession ?? null,
      format: (v: number) => `${v.toFixed(0)}%`,
    },
    {
      label: 'Goles / partido',
      home: homeStats.avg_goals_scored ?? null,
      away: awayStats.avg_goals_scored ?? null,
      format: (v: number) => v.toFixed(2),
    },
    {
      label: 'Concedidos / partido',
      home: homeStats.avg_goals_conceded ?? null,
      away: awayStats.avg_goals_conceded ?? null,
      higherIsBetter: false,
      format: (v: number) => v.toFixed(2),
    },
  ]

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Medias por Partido</h3>
          <span className="text-[10px] text-zinc-600">temporada actual</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-emerald-400 font-semibold">{homeTeam.code}</span>
          <span className="text-zinc-600">vs</span>
          <span className="text-blue-400 font-semibold">{awayTeam.code}</span>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <AvgRow key={row.label} {...(row as any)} />
        ))}
      </div>

      <p className="mt-3 text-[10px] text-zinc-700">
        Basado en estadísticas de la competición. Faltas por partido: disponible solo en estadísticas en vivo.
      </p>
    </div>
  )
}
