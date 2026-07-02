'use client'

import { cn } from '@/lib/utils'
import { Stethoscope, TrendingUp } from 'lucide-react'

interface Props {
  stats: any
  injuries: any[]
}

export function PlayerStatsPanel({ stats, injuries }: Props) {
  if (!stats) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-zinc-500">Sin estadísticas para esta competición</p>
      </div>
    )
  }

  const statBlocks = [
    {
      label: 'Partidos',
      value: stats.matches_played,
      sub: `${stats.minutes_played}' jugados`,
      color: 'text-white',
    },
    {
      label: 'Goles',
      value: stats.goals,
      sub: `${stats.shots_on_target ?? 0} tiros a puerta`,
      color: stats.goals > 0 ? 'text-emerald-400' : 'text-zinc-400',
    },
    {
      label: 'Asistencias',
      value: stats.assists,
      sub: `${stats.key_passes ?? 0} pases clave`,
      color: stats.assists > 0 ? 'text-blue-400' : 'text-zinc-400',
    },
    {
      label: 'Rating Promedio',
      value: stats.avg_rating?.toFixed(1) ?? '—',
      sub: 'Por partido',
      color: stats.avg_rating >= 7.5 ? 'text-emerald-400' : stats.avg_rating >= 6.5 ? 'text-amber-400' : 'text-zinc-400',
    },
    {
      label: 'Tiros',
      value: stats.shots ?? 0,
      sub: `${stats.shots_on_target ?? 0} a puerta`,
      color: 'text-zinc-300',
    },
    {
      label: 'Dribbles',
      value: stats.dribbles_completed ?? 0,
      sub: 'Completados',
      color: 'text-zinc-300',
    },
    {
      label: 'Tackles',
      value: stats.tackles ?? 0,
      sub: `${stats.interceptions ?? 0} intercepciones`,
      color: 'text-zinc-300',
    },
    {
      label: 'Tarjetas',
      value: stats.yellow_cards ?? 0,
      sub: `${stats.red_cards ?? 0} rojas`,
      color: stats.yellow_cards > 3 ? 'text-amber-400' : 'text-zinc-400',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Estadísticas en el Torneo</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statBlocks.map(b => (
            <div key={b.label} className="rounded-lg bg-zinc-950 border border-zinc-800 p-3">
              <p className="text-[10px] text-zinc-500 mb-1">{b.label}</p>
              <p className={cn('text-2xl font-black mono', b.color)}>{b.value}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{b.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Injuries history */}
      {injuries.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">Historial de Lesiones</h3>
          </div>
          <div className="space-y-2">
            {injuries.map((inj: any) => (
              <div key={inj.id} className="flex items-start gap-3 rounded-lg border border-zinc-800 p-2.5">
                <span className="text-sm mt-0.5">
                  {inj.injury_type === 'muscular' ? '🦵' :
                   inj.injury_type === 'suspension' ? '🟨' : '⚕️'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold capitalize text-zinc-200">{inj.injury_type}</p>
                    <span className={cn('text-[10px] font-bold rounded px-1.5 py-0.5 border',
                      inj.is_active
                        ? 'text-red-400 bg-red-500/10 border-red-500/20'
                        : 'text-zinc-500 bg-zinc-800 border-zinc-700'
                    )}>
                      {inj.is_active ? 'ACTIVA' : 'RECUPERADO'}
                    </span>
                  </div>
                  {inj.description && (
                    <p className="text-[10px] text-zinc-500 mt-0.5">{inj.description}</p>
                  )}
                  <div className="flex gap-3 mt-1 text-[10px] text-zinc-600">
                    <span>Reportada: {new Date(inj.reported_at).toLocaleDateString('es-CO')}</span>
                    {inj.expected_return && (
                      <span>Retorno est.: {inj.expected_return}</span>
                    )}
                    <span>Impacto: {inj.impact_score}/10</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
