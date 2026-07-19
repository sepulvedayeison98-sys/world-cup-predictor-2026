'use client'

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { cn } from '@/lib/utils'

interface Props {
  homeTeam: any
  awayTeam: any
  homeStats: any
  awayStats: any
}

function normalize(value: number, max: number): number {
  return Math.min(100, Math.round((value / max) * 100))
}

export function TeamComparisonRadar({ homeTeam, awayTeam, homeStats, awayStats }: Props) {
  const radarData = [
    {
      subject: 'Ataque (xG)',
      [homeTeam.code]: normalize(homeStats.avg_xg ?? 0, 3),
      [awayTeam.code]: normalize(awayStats.avg_xg ?? 0, 3),
    },
    {
      subject: 'Defensa (xGA)',
      // Invert: lower xGA = better defense
      [homeTeam.code]: normalize(3 - (homeStats.avg_xga ?? 1.5), 3),
      [awayTeam.code]: normalize(3 - (awayStats.avg_xga ?? 1.5), 3),
    },
    {
      subject: 'Posesión',
      [homeTeam.code]: normalize(homeStats.avg_possession ?? 50, 80),
      [awayTeam.code]: normalize(awayStats.avg_possession ?? 50, 80),
    },
    {
      subject: 'Tiros/partido',
      [homeTeam.code]: normalize(homeStats.avg_shots ?? 10, 22),
      [awayTeam.code]: normalize(awayStats.avg_shots ?? 10, 22),
    },
    {
      subject: 'Efectividad',
      [homeTeam.code]: homeStats.avg_shots > 0
        ? normalize((homeStats.avg_goals_scored / homeStats.avg_shots) * 10, 10)
        : 50,
      [awayTeam.code]: awayStats.avg_shots > 0
        ? normalize((awayStats.avg_goals_scored / awayStats.avg_shots) * 10, 10)
        : 50,
    },
    {
      subject: 'ELO',
      [homeTeam.code]: normalize(homeTeam.elo_rating ?? 1500, 2200),
      [awayTeam.code]: normalize(awayTeam.elo_rating ?? 1500, 2200),
    },
  ]

  const StatBar = ({ label, home, away }: { label: string; home: number; away: number; unit?: string }) => {
    const total = home + away || 1
    return (
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-semibold mono text-emerald-400">{home}</span>
          <span className="text-zinc-500">{label}</span>
          <span className="font-semibold mono text-blue-400">{away}</span>
        </div>
        <div className="flex h-1 overflow-hidden rounded-full bg-zinc-800">
          <div className="bg-emerald-500 transition-all" style={{ width: `${(home / total) * 100}%` }} />
          <div className="bg-blue-500 transition-all"    style={{ width: `${(away / total) * 100}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Comparación de Equipos</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-400">{homeTeam.short_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-zinc-400">{awayTeam.short_name}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Radar */}
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="#27272a" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#71717a', fontSize: 9 }}
            />
            <Radar
              name={homeTeam.code}
              dataKey={homeTeam.code}
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Radar
              name={awayTeam.code}
              dataKey={awayTeam.code}
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                fontSize: 11,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>

        {/* Stats breakdown */}
        <div className="flex flex-col justify-center space-y-3">
          <StatBar
            label="Goles/partido"
            home={homeStats.avg_goals_scored ?? 0}
            away={awayStats.avg_goals_scored ?? 0}
          />
          <StatBar
            label="xG promedio"
            home={homeStats.avg_xg ?? 0}
            away={awayStats.avg_xg ?? 0}
          />
          <StatBar
            label="xGA promedio"
            home={homeStats.avg_xga ?? 0}
            away={awayStats.avg_xga ?? 0}
          />
          <StatBar
            label="Posesión %"
            home={homeStats.avg_possession ?? 50}
            away={awayStats.avg_possession ?? 50}
          />
          <StatBar
            label="Tiros/partido"
            home={homeStats.avg_shots ?? 0}
            away={awayStats.avg_shots ?? 0}
          />
          <StatBar
            label="Tiros a puerta"
            home={homeStats.avg_shots_on_target ?? 0}
            away={awayStats.avg_shots_on_target ?? 0}
          />
          <StatBar
            label="Corners/partido"
            home={homeStats.avg_corners ?? 0}
            away={awayStats.avg_corners ?? 0}
          />

          {/* Form */}
          <div>
            <p className="mb-1 text-[10px] text-zinc-500">Forma reciente (últimos 5)</p>
            <div className="flex items-center justify-between">
              <div className="flex gap-0.5">
                {(homeStats.form ?? []).slice(-5).map((r: string, i: number) => (
                  <span key={i} className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-bold',
                    r === 'W' && 'bg-emerald-500/20 text-emerald-400',
                    r === 'D' && 'bg-amber-500/20 text-amber-400',
                    r === 'L' && 'bg-red-500/20 text-red-400',
                  )}>{r}</span>
                ))}
              </div>
              <div className="flex gap-0.5">
                {(awayStats.form ?? []).slice(-5).map((r: string, i: number) => (
                  <span key={i} className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-bold',
                    r === 'W' && 'bg-emerald-500/20 text-emerald-400',
                    r === 'D' && 'bg-amber-500/20 text-amber-400',
                    r === 'L' && 'bg-red-500/20 text-red-400',
                  )}>{r}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
