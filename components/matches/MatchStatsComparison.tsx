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
          className={cn('transition-all duration-700', !homeWins && home !== away ? 'bg-red-500' : 'bg-zinc-700')}
          style={{ width: `${awayPct}%` }}
        />
      </div>
    </div>
  )
}

export function MatchStatsComparison({ stats, homeTeam, awayTeam }: Props) {
  const hMatch = stats.find((s: any) => s.team_id === homeTeam.id) ?? {}
  const aMatch = stats.find((s: any) => s.team_id === awayTeam.id) ?? {}
  // Procedencia (Regla Data First): real de ESPN vs estimación del modelo
  const allEspn = stats.length > 0 && stats.every((s: any) => s.source === 'espn')
  // Fallback a estadísticas históricas del equipo cuando no hay datos del partido
  const hAvg = homeTeam.team_statistics?.[0] ?? {}
  const aAvg = awayTeam.team_statistics?.[0] ?? {}
  const v = (matchVal: any, avgVal: any) => matchVal ?? avgVal ?? 0

  const rows: StatRowProps[] = [
    { label: 'Posesión',      home: v(hMatch.possession, 50),              away: v(aMatch.possession, 50),              unit: '%' },
    { label: 'Tiros',         home: v(hMatch.shots, hAvg.avg_shots),        away: v(aMatch.shots, aAvg.avg_shots) },
    { label: 'A puerta',      home: v(hMatch.shots_on_target, null),        away: v(aMatch.shots_on_target, null) },
    { label: 'xG',            home: v(hMatch.xg, hAvg.avg_xg),             away: v(aMatch.xg, aAvg.avg_xg),            format: (n: number) => n.toFixed(2) },
    { label: 'Córners',       home: v(hMatch.corners, hAvg.avg_corners),   away: v(aMatch.corners, aAvg.avg_corners) },
    { label: 'Faltas',        home: v(hMatch.fouls, null),                  away: v(aMatch.fouls, null),                higherIsBetter: false },
    { label: 'Amarillas',     home: v(hMatch.yellow_cards, null),           away: v(aMatch.yellow_cards, null),         higherIsBetter: false },
    { label: 'Goles marcados',home: v(null, hAvg.avg_goals_scored),         away: v(null, aAvg.avg_goals_scored),       format: (n: number) => n.toFixed(1) },
    { label: 'Goles recibidos',home: v(null, hAvg.avg_goals_conceded),      away: v(null, aAvg.avg_goals_conceded),     higherIsBetter: false, format: (n: number) => n.toFixed(1) },
    { label: 'Paradas',       home: v(hMatch.saves, null),                  away: v(aMatch.saves, null) },
  ].filter(r => r.home !== 0 || r.away !== 0) // ocultar filas sin datos

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
          <span className="text-red-400 font-semibold">{awayTeam.code}</span>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <StatRow key={row.label} {...row} />
        ))}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[10px]">
        {allEspn ? (
          <>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-zinc-500">
              Estadísticas oficiales (ESPN) · el xG es una estimación del modelo IA
            </span>
          </>
        ) : (
          <>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="text-amber-500/80">
              Estimación del modelo — estadísticas oficiales no disponibles para este partido
            </span>
          </>
        )}
      </p>
    </div>
  )
}
