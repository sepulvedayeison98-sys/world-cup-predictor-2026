'use client'

import { Sparkles, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeSmartBets, type SmartBetTier, type SmartBetRecommendation } from '@/lib/smartBetsEngine'

const TIER_CONFIG: Record<SmartBetTier, { label: string; bar: string; badge: string; text: string; border: string }> = {
  premium:    { label: 'Premium',    bar: 'from-amber-600 to-amber-400',     badge: 'bg-amber-500/15 border-amber-500/30',    text: 'text-amber-400',   border: 'border-amber-500/20'   },
  muy_fuerte: { label: 'Muy Fuerte', bar: 'from-emerald-700 to-emerald-400', badge: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  fuerte:     { label: 'Fuerte',     bar: 'from-blue-700 to-blue-400',       badge: 'bg-blue-500/15 border-blue-500/30',      text: 'text-blue-400',    border: 'border-blue-500/20'    },
  moderada:   { label: 'Moderada',   bar: 'from-zinc-600 to-zinc-400',       badge: 'bg-zinc-700/30 border-zinc-700',         text: 'text-zinc-400',    border: 'border-zinc-700/30'    },
  evitar:     { label: 'Evitar',     bar: 'from-red-900 to-red-700',         badge: 'bg-red-900/20 border-red-900/30',        text: 'text-red-500',     border: 'border-red-900/20'     },
}

const RANK_MEDALS = ['🥇', '🥈', '🥉']

interface Props {
  prediction: any | null
  homeStats: any | null
  awayStats: any | null
  match: any
  injuries: any[]
}

export function SmartBetsPanel({ prediction, homeStats, awayStats, match, injuries }: Props) {
  const homeTeam = match?.home_team
  const awayTeam = match?.away_team

  const recs = computeSmartBets(prediction, homeStats, awayStats, homeTeam, awayTeam, injuries)

  if (!prediction) {
    return (
      <div className="card p-10 flex flex-col items-center gap-3 text-zinc-600">
        <Sparkles className="h-8 w-8 opacity-30" />
        <p className="text-sm font-medium text-zinc-500">Sin predicción disponible</p>
        <p className="text-xs text-center max-w-xs">
          El motor necesita una predicción generada para calcular las recomendaciones.
        </p>
      </div>
    )
  }

  if (recs.length === 0) {
    return (
      <div className="card p-10 flex flex-col items-center gap-3 text-zinc-600">
        <Sparkles className="h-8 w-8 opacity-30" />
        <p className="text-sm font-medium text-zinc-500">Sin recomendaciones con suficiente confianza</p>
        <p className="text-xs text-center max-w-xs">
          Ningún mercado supera el umbral mínimo de confianza (60%) para este partido.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-white">Smart Bets AI</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Las {recs.length} apuesta{recs.length !== 1 ? 's' : ''} más sólidas para este partido según el motor de predicción
          </p>
        </div>
      </div>

      {/* Cards */}
      {recs.map((rec, i) => (
        <BetCard key={rec.id} rec={rec} rank={i} />
      ))}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 mt-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500/60 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Predicciones estadísticas del motor — no constituyen asesoramiento financiero ni garantía de resultado.
          Los porcentajes reflejan probabilidad estimada, no certeza. Apuesta responsablemente. +18.
        </p>
      </div>
    </div>
  )
}

function BetCard({ rec, rank }: { rec: SmartBetRecommendation; rank: number }) {
  const cfg = TIER_CONFIG[rec.tier]
  const barWidth = Math.max(4, rec.confidence)

  return (
    <div className={cn('card overflow-hidden border', cfg.border)}>
      {/* Confidence bar at top */}
      <div className="h-1 w-full bg-zinc-800">
        <div
          className={cn('h-full bg-gradient-to-r transition-all', cfg.bar)}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base">{RANK_MEDALS[rank] ?? `#${rank + 1}`}</span>
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border',
            cfg.badge, cfg.text
          )}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {cfg.label}
          </span>
          <span className="text-sm font-bold text-white">{rec.label}</span>
        </div>

        {/* Confidence gauge */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Confianza del motor</span>
            <span className={cn('text-3xl font-bold mono', cfg.text)}>{rec.confidence}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full bg-gradient-to-r', cfg.bar)}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-zinc-700">
            <span>60%</span>
            <span>80%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Justification */}
        <p className="text-xs text-zinc-300 leading-relaxed border-l-2 border-zinc-700 pl-3">
          {rec.justification}
        </p>

        {/* Factors */}
        {(rec.factors.for.length > 0 || rec.factors.against.length > 0) && (
          <div className="space-y-1.5 pt-0.5">
            {rec.factors.for.map((f, j) => (
              <div key={`f${j}`} className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-zinc-300 leading-snug">{f}</span>
              </div>
            ))}
            {rec.factors.against.map((f, j) => (
              <div key={`a${j}`} className="flex items-start gap-2">
                <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-zinc-400 leading-snug">{f}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
