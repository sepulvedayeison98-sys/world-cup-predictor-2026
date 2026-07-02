'use client'

import { cn } from '@/lib/utils'
import { Stethoscope, AlertTriangle } from 'lucide-react'

interface Props {
  injuries: any[]
  homeTeamId: string
  awayTeamId: string
  homeTeam: any
  awayTeam: any
}

const INJURY_ICONS: Record<string, string> = {
  muscular:   '🦵',
  ligament:   '🦴',
  fracture:   '🦴',
  illness:    '🤒',
  suspension: '🟨',
  other:      '⚕️',
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  injured:   { label: 'Lesionado', color: 'text-red-400' },
  doubt:     { label: 'Duda',      color: 'text-amber-400' },
  suspended: { label: 'Suspendido', color: 'text-yellow-400' },
  available: { label: 'Disponible', color: 'text-emerald-400' },
}

export function InjuriesPanel({ injuries, homeTeamId, awayTeamId, homeTeam, awayTeam }: Props) {
  const homeInjuries = injuries.filter((i) => i.team_id === homeTeamId)
  const awayInjuries = injuries.filter((i) => i.team_id === awayTeamId)

  if (injuries.length === 0) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Bajas / Lesiones</h3>
        </div>
        <div className="py-4 text-center">
          <p className="text-xs text-emerald-400">✓ Sin bajas confirmadas</p>
        </div>
      </div>
    )
  }

  const InjuryCard = ({ injury }: { injury: any }) => {
    const p = injury.player
    return (
      <div className="flex items-start gap-2 rounded-lg border border-zinc-800 p-2 hover:border-zinc-700 transition-colors">
        <span className="text-sm">{INJURY_ICONS[injury.injury_type] ?? '⚕️'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-zinc-200 truncate">
              {p?.short_name ?? p?.name}
            </span>
            <span className={cn(
              'text-[10px] font-bold uppercase shrink-0',
              injury.injury_type === 'suspension' ? 'text-yellow-400' : 'text-red-400'
            )}>
              {injury.injury_type === 'suspension' ? 'SUSP' : 'BAJA'}
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 truncate">
            {p?.position} · {injury.description ?? 'Sin detalles'}
          </p>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[10px] text-zinc-600">
              Impacto: {'■'.repeat(Math.round(injury.impact_score / 2))}{'□'.repeat(5 - Math.round(injury.impact_score / 2))}
            </span>
            {injury.expected_return && (
              <span className="text-[10px] text-zinc-600">
                Regreso: {injury.expected_return}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="h-4 w-4 text-red-400" />
        <h3 className="text-sm font-semibold text-white">Bajas / Lesiones</h3>
        <span className="ml-auto text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5">
          {injuries.length} bajas
        </span>
      </div>

      <div className="space-y-4">
        {homeInjuries.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wider">
              {homeTeam.short_name}
            </p>
            <div className="space-y-1.5">
              {homeInjuries.map((inj) => (
                <InjuryCard key={inj.id} injury={inj} />
              ))}
            </div>
          </div>
        )}

        {awayInjuries.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wider">
              {awayTeam.short_name}
            </p>
            <div className="space-y-1.5">
              {awayInjuries.map((inj) => (
                <InjuryCard key={inj.id} injury={inj} />
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1 text-[10px] text-zinc-600">
        <AlertTriangle className="h-3 w-3" />
        El impacto afecta las probabilidades del modelo
      </p>
    </div>
  )
}
