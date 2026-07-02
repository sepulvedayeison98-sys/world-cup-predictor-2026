'use client'

import { cn, formatProbability } from '@/lib/utils'
import { computeKnockoutAdvance } from '@/lib/predictionEngine'
import { Shield, TrendingUp, Target, AlertTriangle, Trophy } from 'lucide-react'

const KNOCKOUT_PHASES = new Set([
  'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final',
])

// P(X <= k) para X ~ Poisson(lambda)
function poissonCDF(lambda: number, k: number): number {
  if (lambda <= 0) return k >= 0 ? 1 : 0
  let cum = 0, term = Math.exp(-lambda)
  for (let i = 0; i <= k; i++) { cum += term; term *= lambda / (i + 1) }
  return Math.min(1, cum)
}

function deriveLambdas(prediction: any, match: any): { lambdaHome: number; lambdaAway: number } {
  const hStat = match?.home_team?.team_statistics?.[0]
  const aStat = match?.away_team?.team_statistics?.[0]
  const homeXg  = hStat?.avg_xg  ?? hStat?.avg_goals_scored  ?? 1.3
  const awayXg  = aStat?.avg_xg  ?? aStat?.avg_goals_scored  ?? 1.1
  const homeXga = hStat?.avg_xga ?? hStat?.avg_goals_conceded ?? 1.1
  const awayXga = aStat?.avg_xga ?? aStat?.avg_goals_conceded ?? 1.3
  const baseHome = Math.max(0.20, (homeXg + awayXga) / 2)
  const baseAway = Math.max(0.20, (awayXg + homeXga) / 2)
  const total    = Math.min(baseHome + baseAway, 5.5)
  const hw = prediction.home_win_probability ?? 0.40
  const aw = prediction.away_win_probability ?? 0.28
  const hs = Math.max(0.20, Math.min(0.80, hw / Math.max(0.01, hw + aw)))
  return {
    lambdaHome: Math.max(0.10, total * hs),
    lambdaAway: Math.max(0.10, total * (1 - hs)),
  }
}

function computeMarketProbs(lambdaHome: number, lambdaAway: number) {
  const lambdaTotal = lambdaHome + lambdaAway
  const pHome0 = poissonCDF(lambdaHome, 0)
  const pAway0 = poissonCDF(lambdaAway, 0)
  const bttsYes = (1 - pHome0) * (1 - pAway0)
  return [
    { label: 'Más de 0.5 goles',     prob: 1 - poissonCDF(lambdaTotal, 0) },
    { label: 'Más de 1.5 goles',     prob: 1 - poissonCDF(lambdaTotal, 1) },
    { label: 'Más de 2.5 goles',     prob: 1 - poissonCDF(lambdaTotal, 2) },
    { label: 'Más de 3.5 goles',     prob: 1 - poissonCDF(lambdaTotal, 3) },
    { label: 'Ambos marcan: Sí',     prob: bttsYes },
    { label: 'Ambos marcan: No',     prob: 1 - bttsYes },
    { label: 'Portería a 0 Local',   prob: pAway0 },
    { label: 'Portería a 0 Visitante', prob: pHome0 },
  ]
}

interface Props {
  prediction: any
  match: any
}

function Stars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={cn('text-sm', i < level ? 'text-amber-400' : 'text-zinc-700')}>★</span>
      ))}
    </div>
  )
}

function ProbabilityGauge({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="#27272a" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="14"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${pct * 0.88} 88`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white mono">
          {pct}%
        </span>
      </div>
    </div>
  )
}

export function MatchPredictionPanel({ prediction, match }: Props) {
  const homeWin = prediction.home_win_probability ?? 0
  const draw   = prediction.draw_probability ?? 0
  const away   = prediction.away_win_probability ?? 0

  // Normalize 1X2 bar so it always fills 100% regardless of floating-point drift
  const probTotal = homeWin + draw + away || 1
  const hBarPct = (homeWin / probTotal) * 100
  const dBarPct = (draw / probTotal) * 100
  const aBarPct = (away / probTotal) * 100

  const { lambdaHome, lambdaAway } = deriveLambdas(prediction, match)
  const extraMarkets = computeMarketProbs(lambdaHome, lambdaAway)

  // En eliminatorias el empate no es resultado final: calculamos quién avanza
  const isKnockout = KNOCKOUT_PHASES.has(match.phase)
  const advance = isKnockout
    ? computeKnockoutAdvance(
        { home: homeWin, draw, away },
        match.home_team?.elo_rating ?? 1500,
        match.away_team?.elo_rating ?? 1500,
      )
    : null

  // Weight bar: scale so largest weight fills 100% of the bar
  const weights = [
    { label: 'xG y capacidad ofensiva', weight: prediction.xg_weight ?? 0.40 },
    { label: 'ELO Rating',               weight: prediction.elo_weight ?? 0.25 },
    { label: 'Forma reciente',            weight: prediction.form_weight ?? 0.15 },
    { label: 'Mercado de apuestas',        weight: prediction.market_weight ?? 0.10 },
    { label: 'Noticias y lesiones',        weight: prediction.news_weight ?? 0.10 },
  ]
  const maxWeight = Math.max(...weights.map(w => w.weight), 0.01)

  const topOutcome =
    homeWin >= draw && homeWin >= away
      ? { label: match.home_team?.short_name ?? 'Local', prob: homeWin, color: '#10b981' }
      : draw >= homeWin && draw >= away
      ? { label: 'Empate', prob: draw, color: '#f59e0b' }
      : { label: match.away_team?.short_name ?? 'Visitante', prob: away, color: '#ef4444' }

  return (
    <div className="space-y-4">

      {/* Prediction summary card */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Predicción del Motor</h3>
          <span className="ml-auto text-[10px] text-zinc-600 mono">v{prediction.model_version ?? '1.0.0'}</span>
        </div>

        {/* 3 gauges */}
        <div className="flex items-end justify-around mb-4">
          <div className="flex flex-col items-center gap-1">
            <ProbabilityGauge value={homeWin} color="#10b981" />
            <p className="text-[10px] font-medium text-zinc-400 text-center">
              {match.home_team?.code}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ProbabilityGauge value={draw} color="#f59e0b" />
            <p className="text-[10px] font-medium text-zinc-400">X</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ProbabilityGauge value={away} color="#ef4444" />
            <p className="text-[10px] font-medium text-zinc-400 text-center">
              {match.away_team?.code}
            </p>
          </div>
        </div>

        {/* Stacked bar — normalized so bars always fill 100% */}
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-800 mb-1">
          <div className="bg-emerald-500 transition-all" style={{ width: `${hBarPct}%` }} />
          <div className="bg-amber-500 transition-all"  style={{ width: `${dBarPct}%` }} />
          <div className="bg-red-500 transition-all"    style={{ width: `${aBarPct}%` }} />
        </div>
        {isKnockout && (
          <p className="text-[10px] text-zinc-600 text-center">
            Probabilidades en 90 minutos — el empate se resuelve en prórroga/penales
          </p>
        )}

        {/* Clasificación (solo eliminatorias) */}
        {advance && (
          <div className="mt-4 rounded-lg bg-zinc-950 border border-zinc-800 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-[11px] font-semibold text-zinc-300">¿Quién clasifica?</p>
              <span className="ml-auto text-[9px] text-zinc-600">incluye prórroga y penales</span>
            </div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={cn('font-bold mono', advance.home >= advance.away ? 'text-emerald-400' : 'text-zinc-300')}>
                {match.home_team?.code} {formatProbability(advance.home)}
              </span>
              <span className={cn('font-bold mono', advance.away > advance.home ? 'text-blue-400' : 'text-zinc-300')}>
                {match.away_team?.code} {formatProbability(advance.away)}
              </span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="bg-emerald-500 transition-all" style={{ width: `${advance.home * 100}%` }} />
              <div className="bg-blue-500 transition-all" style={{ width: `${advance.away * 100}%` }} />
            </div>
          </div>
        )}

        {/* Marcador predicho */}
        <div className="mt-4 flex items-center justify-between rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-3">
          <div className="flex flex-col items-center">
            <p className="text-[10px] text-zinc-500">Marcador estimado</p>
            <p className="text-2xl font-black mono text-white mt-0.5">
              {prediction.predicted_home_score}–{prediction.predicted_away_score}
            </p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-[10px] text-zinc-500">Favorito</p>
            <p className="text-sm font-bold text-white mt-0.5" style={{ color: topOutcome.color }}>
              {topOutcome.label}
            </p>
            <p className="text-xs mono" style={{ color: topOutcome.color }}>
              {Math.round(topOutcome.prob * 100)}%
            </p>
          </div>
        </div>

        {/* Confidence */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-zinc-500">Confianza del modelo</p>
            <Stars level={prediction.confidence_level} />
          </div>
          <div className="text-right">
            <p className="text-xl font-bold mono text-white">{prediction.confidence_score?.toFixed(1)}%</p>
            <p className="text-[10px] text-zinc-600">score</p>
          </div>
        </div>
      </div>

      {/* Markets probability table */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Probabilidades por Mercado</h3>
        </div>

        <div className="space-y-1">
          {extraMarkets.map((market) => (
            <div key={market.label} className="flex items-center justify-between py-1.5 border-b border-zinc-800/50 last:border-0">
              <span className="text-xs text-zinc-400">{market.label}</span>
              <div className="flex items-center gap-3">
                <div className="w-20 h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      market.prob >= 0.65 ? 'bg-emerald-500' :
                      market.prob >= 0.40 ? 'bg-amber-500' : 'bg-zinc-600'
                    )}
                    style={{ width: `${market.prob * 100}%` }}
                  />
                </div>
                <span className={cn(
                  'text-xs font-semibold mono w-9 text-right',
                  market.prob >= 0.65 ? 'text-emerald-400' :
                  market.prob >= 0.40 ? 'text-amber-400' : 'text-zinc-500'
                )}>
                  {Math.round(market.prob * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-2 flex items-center gap-1 text-[10px] text-zinc-600">
          <AlertTriangle className="h-3 w-3" />
          Mercados de goles son estimaciones del motor — no son cuotas.
        </p>
      </div>

      {/* Model weights breakdown */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Pesos del Modelo</h3>
        </div>
        <div className="space-y-1.5">
          {weights.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-32 shrink-0">{item.label}</span>
              <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500/60"
                  style={{ width: `${(item.weight / maxWeight) * 100}%` }}
                />
              </div>
              <span className="text-[10px] mono text-zinc-400 w-7 text-right">
                {Math.round(item.weight * 100)}%
              </span>
            </div>
          ))}

        </div>
      </div>
    </div>
  )
}
