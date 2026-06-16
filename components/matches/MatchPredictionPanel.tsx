'use client'

import { cn, formatProbability } from '@/lib/utils'
import { Shield, TrendingUp, Target, AlertTriangle } from 'lucide-react'

const MARKET_ROWS = [
  { key: 'home_win', label: 'Victoria Local' },
  { key: 'draw', label: 'Empate' },
  { key: 'away_win', label: 'Victoria Visitante' },
]

const EXTRA_MARKETS = [
  { label: 'Más de 0.5 goles', prob: 0.91 },
  { label: 'Más de 1.5 goles', prob: 0.68 },
  { label: 'Más de 2.5 goles', prob: 0.42 },
  { label: 'Más de 3.5 goles', prob: 0.20 },
  { label: 'Ambos marcan: Sí', prob: 0.45 },
  { label: 'Ambos marcan: No', prob: 0.55 },
  { label: 'Portería a 0 Local', prob: 0.48 },
  { label: 'Portería a 0 Visitante', prob: 0.30 },
]

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
  const homeWin = prediction.home_win_probability
  const draw   = prediction.draw_probability
  const away   = prediction.away_win_probability

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

        {/* Stacked bar */}
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-800 mb-1">
          <div className="bg-emerald-500 transition-all" style={{ width: `${homeWin * 100}%` }} />
          <div className="bg-amber-500 transition-all"  style={{ width: `${draw * 100}%` }} />
          <div className="bg-red-500 transition-all"    style={{ width: `${away * 100}%` }} />
        </div>

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
          {EXTRA_MARKETS.map((market) => (
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
          {[
            { label: 'xG y capacidad ofensiva', weight: prediction.xg_weight ?? 0.40 },
            { label: 'ELO Rating',               weight: prediction.elo_weight ?? 0.25 },
            { label: 'Forma reciente',            weight: prediction.form_weight ?? 0.15 },
            { label: 'Mercado de apuestas',        weight: prediction.market_weight ?? 0.10 },
            { label: 'Noticias y lesiones',        weight: prediction.news_weight ?? 0.10 },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-32 shrink-0">{item.label}</span>
              <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500/60"
                  style={{ width: `${item.weight * 100 * 2.5}%` }}
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
