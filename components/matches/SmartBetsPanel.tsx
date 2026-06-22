'use client'

import { Sparkles, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  generateSmartBetJustification,
  getSmartBetTier,
  getMarketLabel,
  type OddsMarket,
  type ValueBetGrade,
  type SmartBetTier,
} from '@/lib/valueBets'

const TIER_CONFIG: Record<SmartBetTier, { label: string; bg: string; text: string; dot: string }> = {
  premium:    { label: 'Premium',    bg: 'bg-amber-500/15 border-amber-500/30',    text: 'text-amber-400',   dot: 'bg-amber-400'   },
  muy_fuerte: { label: 'Muy Fuerte', bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  fuerte:     { label: 'Fuerte',     bg: 'bg-blue-500/15 border-blue-500/30',      text: 'text-blue-400',    dot: 'bg-blue-400'    },
  moderada:   { label: 'Moderada',   bg: 'bg-zinc-700/30 border-zinc-700',         text: 'text-zinc-400',    dot: 'bg-zinc-400'    },
}

interface Props {
  smartBets: any[]
  prediction: any | null
  homeStats: any | null
  awayStats: any | null
  match: any
}

export function SmartBetsPanel({ smartBets, prediction, homeStats, awayStats, match }: Props) {
  const homeTeam = match?.home_team
  const awayTeam = match?.away_team

  const top = smartBets.filter((b) => b.grade !== 'none').slice(0, 3)

  if (top.length === 0) {
    return (
      <div className="card p-10 flex flex-col items-center gap-3 text-zinc-600">
        <Sparkles className="h-8 w-8 opacity-30" />
        <p className="text-sm font-medium text-zinc-500">Sin apuestas de valor detectadas</p>
        <p className="text-xs text-center max-w-xs leading-relaxed">
          El motor no encuentra diferencias significativas entre el modelo y el mercado para este partido.
          Cuando existan cuotas con valor, aparecerán aquí automáticamente.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-400" />
        <div>
          <h3 className="text-sm font-semibold text-white">Smart Bets AI</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Top {top.length} apuesta{top.length !== 1 ? 's' : ''} con mayor valor esperado según el motor de predicción
          </p>
        </div>
      </div>

      {/* Bet cards */}
      {top.map((bet, i) => {
        const tier = getSmartBetTier(bet)
        const tierCfg = TIER_CONFIG[tier]
        const { justification, factors } = generateSmartBetJustification({
          market:              bet.market as OddsMarket,
          grade:               bet.grade as ValueBetGrade,
          expected_value:      bet.expected_value,
          edge:                bet.edge,
          model_probability:   bet.model_probability,
          implied_probability: bet.implied_probability,
          odds_value:          bet.odds_value,
          prediction,
          homeStats,
          awayStats,
          homeTeam,
          awayTeam,
        })

        const evPct    = (bet.expected_value * 100).toFixed(1)
        const edgePct  = (bet.edge * 100).toFixed(1)
        const modelPct = (bet.model_probability * 100).toFixed(1)
        const kelly    = bet.stake_suggestion_percent != null ? Number(bet.stake_suggestion_percent).toFixed(1) : '—'
        const evBarPct = Math.min(100, (bet.expected_value / 0.25) * 100)

        return (
          <div key={bet.id ?? i} className="card p-4 space-y-3">
            {/* Card header row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border', tierCfg.bg, tierCfg.text)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', tierCfg.dot)} />
                {tierCfg.label}
              </span>
              <span className="text-sm font-semibold text-white">
                {getMarketLabel(bet.market as OddsMarket)}
              </span>
              <span className="ml-auto shrink-0 text-[11px] text-zinc-500 bg-zinc-800 rounded px-2 py-0.5">
                {bet.bookmaker}
              </span>
            </div>

            {/* Metrics row */}
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <p className="text-[10px] text-zinc-600 mb-0.5">Cuota</p>
                <p className="text-2xl font-bold text-white mono">@{bet.odds_value.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 mb-0.5">Modelo</p>
                <p className="text-xl font-bold text-emerald-400 mono">{modelPct}%</p>
              </div>
              <div className="ml-auto flex gap-4 flex-wrap">
                <div>
                  <p className="text-[10px] text-zinc-600 mb-0.5">Valor esperado</p>
                  <p className="text-sm font-bold text-emerald-400 mono">+{evPct}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600 mb-0.5">Edge</p>
                  <p className="text-sm font-bold text-blue-400 mono">+{edgePct}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600 mb-0.5">Kelly</p>
                  <p className="text-sm font-bold text-zinc-300 mono">{kelly}%</p>
                </div>
              </div>
            </div>

            {/* EV bar */}
            <div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-700 to-emerald-400 rounded-full"
                  style={{ width: `${evBarPct}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-700 mt-1">Valor esperado (escala 0–25%)</p>
            </div>

            {/* Justification */}
            <p className="text-xs text-zinc-300 leading-relaxed border-l-2 border-zinc-700 pl-3">
              {justification}
            </p>

            {/* Factors */}
            {(factors.for.length > 0 || factors.against.length > 0) && (
              <div className="space-y-1.5 pt-0.5">
                {factors.for.map((f, j) => (
                  <div key={`for-${j}`} className="flex items-start gap-2 text-[11px]">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-zinc-300">{f}</span>
                  </div>
                ))}
                {factors.against.map((f, j) => (
                  <div key={`against-${j}`} className="flex items-start gap-2 text-[11px]">
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-zinc-400">{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500/60 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Las predicciones son estimaciones estadísticas del motor. No constituyen asesoramiento financiero
          ni garantía de resultado. Apuesta solo con recursos que puedas permitirte perder. +18.
        </p>
      </div>
    </div>
  )
}
