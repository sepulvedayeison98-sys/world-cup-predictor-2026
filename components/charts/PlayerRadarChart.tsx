'use client'

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import { cn } from '@/lib/utils'

interface Props {
  player: any
  stats: any
}

export function PlayerRadarChart({ player, stats }: Props) {
  if (!stats) return null

  const isAttacker = ['ST', 'CF', 'LW', 'RW', 'CAM'].includes(player.position)
  const isDefender = ['CB', 'LB', 'RB', 'CDM'].includes(player.position)
  const isGK = player.position === 'GK'

  const radarData = isGK ? [
    { subject: 'Condición',  value: stats.physical_condition ?? 0 },
    { subject: 'Forma',      value: (stats.form_score / 10) * 100 },
    { subject: 'Rating',     value: ((stats.avg_rating ?? 0) / 10) * 100 },
    { subject: 'Minutos',    value: Math.min((stats.minutes_played / 270) * 100, 100) },
    { subject: 'Paradas',    value: Math.min((stats.saves ?? 0) * 10, 100) },
    { subject: 'Fiabilidad', value: stats.red_cards > 0 ? 60 : stats.yellow_cards > 2 ? 75 : 95 },
  ] : isAttacker ? [
    { subject: 'Condición',  value: stats.physical_condition ?? 0 },
    { subject: 'Forma',      value: (stats.form_score / 10) * 100 },
    { subject: 'Goles',      value: Math.min(stats.goals * 20, 100) },
    { subject: 'Asistencias', value: Math.min(stats.assists * 25, 100) },
    { subject: 'Dribbles',   value: Math.min((stats.dribbles_completed ?? 0) * 10, 100) },
    { subject: 'Rating',     value: ((stats.avg_rating ?? 0) / 10) * 100 },
  ] : isDefender ? [
    { subject: 'Condición',  value: stats.physical_condition ?? 0 },
    { subject: 'Forma',      value: (stats.form_score / 10) * 100 },
    { subject: 'Tackles',    value: Math.min((stats.tackles ?? 0) * 8, 100) },
    { subject: 'Intercep.',  value: Math.min((stats.interceptions ?? 0) * 8, 100) },
    { subject: 'Fiabilidad', value: stats.red_cards > 0 ? 50 : stats.yellow_cards > 3 ? 65 : 90 },
    { subject: 'Rating',     value: ((stats.avg_rating ?? 0) / 10) * 100 },
  ] : [
    { subject: 'Condición',  value: stats.physical_condition ?? 0 },
    { subject: 'Forma',      value: (stats.form_score / 10) * 100 },
    { subject: 'Goles',      value: Math.min(stats.goals * 20, 100) },
    { subject: 'Pases clave', value: Math.min((stats.key_passes ?? 0) * 12, 100) },
    { subject: 'Tackles',    value: Math.min((stats.tackles ?? 0) * 10, 100) },
    { subject: 'Rating',     value: ((stats.avg_rating ?? 0) / 10) * 100 },
  ]

  const overallScore = Math.round(radarData.reduce((s, d) => s + d.value, 0) / radarData.length)

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Rendimiento</h3>
        <div className="text-right">
          <p className="text-[10px] text-zinc-500">Score global</p>
          <p className={cn('text-xl font-black mono',
            overallScore >= 80 ? 'text-emerald-400' :
            overallScore >= 60 ? 'text-amber-400' : 'text-zinc-400'
          )}>
            {overallScore}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="#27272a" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 9 }} />
          <Radar
            name={player.short_name}
            dataKey="value"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: 8,
              fontSize: 11,
            }}
            formatter={(v: number) => [`${v.toFixed(0)}/100`, '']}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Breakdown */}
      <div className="mt-2 space-y-1.5">
        {radarData.map(d => (
          <div key={d.subject} className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 w-20 shrink-0">{d.subject}</span>
            <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700',
                  d.value >= 80 ? 'bg-emerald-500' :
                  d.value >= 60 ? 'bg-amber-500' : 'bg-zinc-600'
                )}
                style={{ width: `${d.value}%` }}
              />
            </div>
            <span className="text-[10px] mono text-zinc-400 w-7 text-right">{d.value.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
