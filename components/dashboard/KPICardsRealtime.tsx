/**
 * Versión en tiempo real del componente KPICards
 * Utiliza el hook useRealtimeKPIs para mantener los datos sincronizados
 */

'use client'

import { Target, BarChart3, Zap, TrendingUp, DollarSign, Search, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRealtimeKPIs } from '@/hooks/useRealtimeKPIs'
import type { DashboardKPIs } from '@/types'

interface Props {
  initialKPIs: DashboardKPIs
  competitionId?: string
}

export function KPICardsRealtime({ initialKPIs, competitionId }: Props) {
  const { kpis, isLive } = useRealtimeKPIs({ initialKPIs, competitionId })
  const roiPositive = (kpis.roi ?? 0) >= 0

  const cards = [
    {
      label: 'Total Partidos',
      value: kpis.total_matches.toString(),
      sub: `${kpis.analyzed_matches} analizados`,
      icon: BarChart3,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Picks Premium',
      value: kpis.active_picks.toString(),
      sub: `de ${kpis.value_bets_pending} activas`,
      icon: Zap,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
    },
    {
      label: 'Precisión',
      value: kpis.historical_accuracy === null ? '—' : `${(kpis.historical_accuracy * 100).toFixed(1)}%`,
      sub: `${kpis.correct_predictions}/${kpis.total_predictions} correctos`,
      icon: Target,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      highlight: kpis.historical_accuracy !== null && kpis.historical_accuracy >= 0.65,
    },
    {
      label: 'ROI',
      value: kpis.roi === null ? '—' : `${roiPositive ? '+' : ''}${kpis.roi.toFixed(1)}%`,
      sub: kpis.roi === null ? 'sin apuestas resueltas' : `${kpis.value_bets_won} apuestas ganadas`,
      icon: DollarSign,
      color: kpis.roi === null ? 'text-zinc-400' : roiPositive ? 'text-emerald-400' : 'text-red-400',
      bg: kpis.roi === null ? 'bg-zinc-500/10' : roiPositive ? 'bg-emerald-500/10' : 'bg-red-500/10',
      border: kpis.roi === null ? 'border-zinc-500/20' : roiPositive ? 'border-emerald-500/20' : 'border-red-500/20',
    },
    {
      label: 'Apuestas de Valor',
      value: kpis.value_bets_detected.toString(),
      sub: `${kpis.value_bets_won} resueltas`,
      icon: Search,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'Partidos Analizados',
      value: kpis.analyzed_matches.toString(),
      sub: `de ${kpis.total_matches} programados`,
      icon: TrendingUp,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
  ]

  return (
    <div className="relative">
      {/* Indicador de estado en vivo */}
      <div className="absolute -top-8 right-0 flex items-center gap-2">
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-full',
          isLive
            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
            : 'text-zinc-400 bg-zinc-500/10 border border-zinc-500/20'
        )}>
          <Radio className={cn('h-2.5 w-2.5', isLive && 'animate-pulse')} />
          {isLive ? 'En Vivo' : 'Actualización manual'}
        </div>
      </div>

      {/* Grid de tarjetas KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className={cn(
                'kpi-card',
                card.highlight && 'border-emerald-500/30 glow-emerald'
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  {card.label}
                </p>
                <div className={cn('rounded-md p-1.5 border', card.bg, card.border)}>
                  <Icon className={cn('h-3.5 w-3.5', card.color)} />
                </div>
              </div>
              <p className={cn('mt-2 text-2xl font-bold mono', card.color)}>
                {card.value}
              </p>
              <p className="text-[11px] text-zinc-500">{card.sub}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
