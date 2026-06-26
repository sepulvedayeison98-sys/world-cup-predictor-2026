'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Sparkles, Brain, TrendingUp, Globe2, AlertTriangle,
  Target, Zap, Shield, ChevronRight, Activity, Flame,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeSmartBets } from '@/lib/smartBetsEngine'
import type { MatchFormEntry, SmartBetRecommendation } from '@/lib/smartBetsEngine'
import type { AnalysisContext, MatchAnalysis } from '@/app/api/analysis/match/[id]/route'

// ─── Props (same as SmartBetsPanel) ──────────────────────────

interface Props {
  prediction: any | null
  homeStats: any | null
  awayStats: any | null
  match: any
  injuries: any[]
  odds?: any[]
  homeRecentMatches?: MatchFormEntry[]
  awayRecentMatches?: MatchFormEntry[]
}

// ─── Utility helpers ──────────────────────────────────────────

function pct(v: number) { return Math.round(v * 100) }

type ValueGrade = 'muy_buena' | 'buena' | 'neutral' | 'evitar'

const VALUE_CONFIG: Record<ValueGrade, { label: string; color: string; bg: string }> = {
  muy_buena: { label: 'Muy buena oportunidad', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  buena:     { label: 'Buena oportunidad',      color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20'    },
  neutral:   { label: 'Neutral',                 color: 'text-zinc-400',    bg: 'bg-zinc-800 border-zinc-700'           },
  evitar:    { label: 'Evitar',                  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20'      },
}

const MARKET_ID_MAP: Record<string, string> = {
  home_win: 'home_win', draw: 'draw', away_win: 'away_win',
  dc_1x: 'dc_1x', dc_x2: 'dc_x2',
  over_1_5: 'over_1_5', over_2_5: 'over_2_5', over_3_5: 'over_3_5',
  btts_yes: 'btts', btts_no: 'btts',
  corners_8_5: 'corners', corners_9_5: 'corners', corners_10_5: 'corners',
  cards_2_5: 'yellow_cards', cards_3_5: 'yellow_cards',
}

function getAvgOdds(betId: string, odds: any[]): number | null {
  const market = MARKET_ID_MAP[betId]
  if (!market) return null
  const matching = (odds ?? []).filter(o => o.market === market && o.odds_value > 1)
  if (!matching.length) return null
  return matching.reduce((s: number, o: any) => s + o.odds_value, 0) / matching.length
}

function computeValueGrade(confidence: number, betId: string, odds: any[]): ValueGrade {
  const modelProb = confidence / 100
  const avgOdds = getAvgOdds(betId, odds)
  if (avgOdds == null) {
    // Sin cuotas reales no podemos calcular valor esperado → cap en 'buena'
    if (confidence >= 75) return 'buena'
    if (confidence >= 60) return 'neutral'
    return 'evitar'
  }
  const ev = modelProb * avgOdds - 1
  if (ev > 0.13) return 'muy_buena'
  if (ev > 0.05) return 'buena'
  if (ev > -0.05) return 'neutral'
  return 'evitar'
}

// ─── Loading skeleton ─────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-zinc-800', className)} />
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-3/4' : 'w-full')} />
      ))}
    </div>
  )
}

// ─── Tier badge ───────────────────────────────────────────────

const TIER_STYLE: Record<string, string> = {
  premium:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  muy_fuerte: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  fuerte:     'bg-blue-500/15 text-blue-300 border-blue-500/30',
  moderada:   'bg-zinc-700 text-zinc-300 border-zinc-600',
  evitar:     'bg-red-500/15 text-red-400 border-red-500/30',
}

const TIER_LABEL: Record<string, string> = {
  premium: 'Premium', muy_fuerte: 'Muy Fuerte', fuerte: 'Fuerte',
  moderada: 'Moderada', evitar: 'Evitar',
}

// ─── Section 1: AI Summary ────────────────────────────────────

function AISummarySection({ prediction, smartBets, match }: {
  prediction: any; smartBets: SmartBetRecommendation[]; match: any
}) {
  const hw = pct(prediction?.home_win_probability ?? 0.40)
  const dr = pct(prediction?.draw_probability ?? 0.28)
  const aw = pct(prediction?.away_win_probability ?? 0.32)
  const conf = prediction?.confidence_score ?? 60
  const topBet = smartBets[0]

  const riskLabel = conf >= 72 ? 'Bajo' : conf >= 58 ? 'Medio' : 'Alto'
  const riskColor = conf >= 72 ? 'text-emerald-400' : conf >= 58 ? 'text-amber-400' : 'text-red-400'

  const favLabel = hw >= aw && hw >= dr
    ? match.home_team?.short_name ?? 'Local'
    : aw >= hw && aw >= dr
      ? match.away_team?.short_name ?? 'Visitante'
      : 'Empate'
  const favProb = Math.max(hw, dr, aw)
  const favColor = hw >= aw && hw >= dr ? '#10b981' : aw >= hw && aw >= dr ? '#ef4444' : '#f59e0b'

  return (
    <div className="card p-5 border-glow-success">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Resumen IA</h3>
        </div>
        <span className={cn(
          'text-xs font-semibold px-2.5 py-1 rounded-full border',
          conf >= 72 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : conf >= 58 ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-red-500/15 text-red-400 border-red-500/30'
        )}>
          Confianza {conf.toFixed(0)}%
        </span>
      </div>

      {/* Probability gauges */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: match.home_team?.code ?? 'LOC', prob: hw, color: '#10b981' },
          { label: 'X', prob: dr, color: '#f59e0b' },
          { label: match.away_team?.code ?? 'VIS', prob: aw, color: '#ef4444' },
        ].map(({ label, prob, color }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 bg-zinc-950 rounded-lg p-3 border border-zinc-800">
            <p className="text-[10px] text-zinc-500 font-medium">{label}</p>
            <p className="text-2xl font-black mono" style={{ color }}>{prob}%</p>
            <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${prob}%`, backgroundColor: color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Score + favorite + risk */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-center">
          <p className="text-[10px] text-zinc-500 mb-1">Marcador Est.</p>
          <p className="text-lg font-black mono text-white">
            {prediction?.predicted_home_score ?? 1}–{prediction?.predicted_away_score ?? 0}
          </p>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-center">
          <p className="text-[10px] text-zinc-500 mb-1">Resultado Esp.</p>
          <p className="text-sm font-bold" style={{ color: favColor }}>{favLabel}</p>
          <p className="text-[10px] mono" style={{ color: favColor }}>{favProb}%</p>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-center">
          <p className="text-[10px] text-zinc-500 mb-1">Riesgo</p>
          <p className={cn('text-sm font-bold', riskColor)}>{riskLabel}</p>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
          <span>Indicador de confianza</span>
          <span className="mono">{conf.toFixed(0)}/100</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-1000',
              conf >= 72 ? 'bg-emerald-500' : conf >= 58 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${Math.min(100, conf)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Section 2: Tactical Analysis ────────────────────────────

function TacticalSection({ match, analysis, isLoading }: {
  match: any; analysis: MatchAnalysis | null; isLoading: boolean
}) {
  if (isLoading) return <CardSkeleton lines={6} />

  const t = analysis?.tactical
  const home = match.home_team?.short_name ?? 'Local'
  const away = match.away_team?.short_name ?? 'Visitante'
  const posEdge = t?.possessionEdge === 'home' ? home : t?.possessionEdge === 'away' ? away : 'Equilibrado'
  const transEdge = t?.transitionEdge === 'home' ? home : t?.transitionEdge === 'away' ? away : 'Equilibrado'

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-4 w-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-white">Análisis Táctico</h3>
      </div>

      {/* Home vs Away styles */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { team: home, style: t?.homeStyle, color: 'emerald' as const },
          { team: away, style: t?.awayStyle, color: 'red' as const },
        ].map(({ team, style, color }) => (
          <div key={team} className={cn(
            'rounded-lg p-3 border',
            color === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-red-500/5 border-red-500/15'
          )}>
            <p className={cn('text-[10px] font-bold uppercase tracking-wider mb-1.5',
              color === 'emerald' ? 'text-emerald-400' : 'text-red-400'
            )}>{team}</p>
            <p className="text-[11px] text-zinc-300 leading-relaxed">{style ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Strengths & weaknesses */}
      {[
        { label: '⚡ Fortalezas', items: [t?.homeStrengths, t?.awayStrengths], teams: [home, away] },
        { label: '🎯 Debilidades', items: [t?.homeWeaknesses, t?.awayWeaknesses], teams: [home, away] },
      ].map(({ label, items, teams }) => (
        <div key={label} className="mb-3">
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">{label}</p>
          <div className="grid grid-cols-2 gap-2">
            {items.map((text, i) => (
              <p key={i} className="text-[11px] text-zinc-400 leading-relaxed">{text ?? '—'}</p>
            ))}
          </div>
        </div>
      ))}

      {/* Key battleground */}
      {t?.keyBattleground && (
        <div className="mt-2 rounded-lg bg-violet-500/5 border border-violet-500/15 p-3">
          <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider mb-1">Punto de Quiebre</p>
          <p className="text-[11px] text-zinc-300 leading-relaxed">{t.keyBattleground}</p>
        </div>
      )}

      {/* Possession & transitions chips */}
      <div className="flex gap-2 mt-3 flex-wrap">
        <div className="flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1">
          <Activity className="h-3 w-3 text-blue-400" />
          <span className="text-[10px] text-zinc-400">Posesión:</span>
          <span className="text-[10px] font-semibold text-blue-400">{posEdge}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1">
          <Zap className="h-3 w-3 text-amber-400" />
          <span className="text-[10px] text-zinc-400">Transiciones:</span>
          <span className="text-[10px] font-semibold text-amber-400">{transEdge}</span>
        </div>
      </div>

      {/* Half expectations */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        {[
          { label: '1er Tiempo', text: t?.firstHalf },
          { label: '2do Tiempo', text: t?.secondHalf },
        ].map(({ label, text }) => (
          <div key={label} className="rounded-lg bg-zinc-950 border border-zinc-800 p-3">
            <p className="text-[10px] text-zinc-500 font-semibold mb-1.5">{label}</p>
            <p className="text-[11px] text-zinc-400 leading-relaxed">{text ?? '—'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section 3: Form Status ───────────────────────────────────

function FormSection({ match, homeRecentMatches, awayRecentMatches, homeStats, awayStats }: {
  match: any
  homeRecentMatches?: MatchFormEntry[]
  awayRecentMatches?: MatchFormEntry[]
  homeStats: any
  awayStats: any
}) {
  const teams = [
    { team: match.home_team, stats: homeStats, form: homeRecentMatches ?? [], side: 'home' as const },
    { team: match.away_team, stats: awayStats, form: awayRecentMatches ?? [], side: 'away' as const },
  ]

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-white">Estado de Forma</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {teams.map(({ team, stats, form, side }) => {
          const wins = form.filter(m => m.result === 'W').length
          const draws = form.filter(m => m.result === 'D').length
          const losses = form.filter(m => m.result === 'L').length
          const cleanSheets = form.filter(m => m.is_clean_sheet).length
          const goalsFor = form.reduce((s, m) => s + m.goals_scored, 0)
          const goalsAg = form.reduce((s, m) => s + m.goals_conceded, 0)
          const n = form.length || 1

          return (
            <div key={side}>
              <p className={cn(
                'text-[10px] font-bold uppercase tracking-wider mb-3',
                side === 'home' ? 'text-emerald-400' : 'text-red-400'
              )}>{team?.short_name ?? team?.name}</p>

              {/* Last 5 results */}
              <div className="flex gap-1 mb-3">
                {form.slice(0, 6).map((m, i) => (
                  <div key={i} className={cn(
                    'w-6 h-6 rounded-sm text-[10px] font-bold flex items-center justify-center',
                    m.result === 'W' ? 'bg-emerald-500/20 text-emerald-400' :
                    m.result === 'D' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  )}>
                    {m.result === 'W' ? 'V' : m.result === 'D' ? 'E' : 'P'}
                  </div>
                ))}
                {form.length === 0 && <span className="text-[10px] text-zinc-600">Sin datos</span>}
              </div>

              {/* Stats grid */}
              <div className="space-y-1.5">
                {[
                  { label: 'xG/partido',  value: stats?.avg_xg?.toFixed(2) ?? '—' },
                  { label: 'xGA/partido', value: stats?.avg_xga?.toFixed(2) ?? '—' },
                  { label: 'Goles/prom',  value: form.length ? (goalsFor / n).toFixed(1) : '—' },
                  { label: 'Recibidos',   value: form.length ? (goalsAg / n).toFixed(1) : '—' },
                  { label: 'Portería 0',  value: form.length ? `${cleanSheets}/${form.length}` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-500">{label}</span>
                    <span className="text-[10px] font-semibold mono text-zinc-300">{value}</span>
                  </div>
                ))}
              </div>

              {/* Trend */}
              {form.length >= 3 && (
                <div className="mt-2 pt-2 border-t border-zinc-800">
                  <div className="flex gap-1 text-[10px]">
                    <span className="text-zinc-500">Racha:</span>
                    <span className={cn('font-semibold',
                      wins >= 3 ? 'text-emerald-400' : losses >= 3 ? 'text-red-400' : 'text-amber-400'
                    )}>
                      {wins >= 3 ? '🔥 Racha ganadora' : losses >= 3 ? '📉 Racha negativa' : '⚖️ Irregular'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Section 4: World Cup Context ────────────────────────────

function ContextSection({ match, analysis, isLoading }: {
  match: any; analysis: MatchAnalysis | null; isLoading: boolean
}) {
  if (isLoading) return <CardSkeleton lines={4} />

  const ctx = analysis?.context
  const home = match.home_team?.short_name ?? 'Local'
  const away = match.away_team?.short_name ?? 'Visitante'

  const intensityColor: Record<string, string> = {
    'Muy Alta': 'text-red-400 bg-red-500/10 border-red-500/20',
    'Alta':     'text-orange-400 bg-orange-500/10 border-orange-500/20',
    'Media':    'text-amber-400 bg-amber-500/10 border-amber-500/20',
    'Baja':     'text-blue-400 bg-blue-500/10 border-blue-500/20',
    'Muy Baja': 'text-zinc-400 bg-zinc-800 border-zinc-700',
  }
  const level = ctx?.intensityLevel ?? 'Media'

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Contexto del Mundial</h3>
        </div>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', intensityColor[level])}>
          Intensidad: {level}
        </span>
      </div>

      {/* Team needs */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {[
          { label: home, need: ctx?.homeNeed, color: 'emerald' as const },
          { label: away, need: ctx?.awayNeed, color: 'red' as const },
        ].map(({ label, need, color }) => (
          <div key={label} className={cn(
            'rounded-lg p-3 border',
            color === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-red-500/5 border-red-500/15'
          )}>
            <p className={cn('text-[10px] font-bold uppercase tracking-wider mb-1.5',
              color === 'emerald' ? 'text-emerald-400' : 'text-red-400'
            )}>{label}</p>
            <p className="text-[11px] text-zinc-300 leading-relaxed">{need ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Competitive description */}
      {ctx?.competitiveDescription && (
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3">
          <p className="text-[11px] text-zinc-300 leading-relaxed">{ctx.competitiveDescription}</p>
        </div>
      )}

      {ctx?.intensityReason && (
        <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">{ctx.intensityReason}</p>
      )}
    </div>
  )
}

// ─── Section 5 + 6: Smart Bets + Value Indicator ─────────────

function SmartBetsSection({ smartBets, analysis, odds, isLoading, match }: {
  smartBets: SmartBetRecommendation[]
  analysis: MatchAnalysis | null
  odds: any[]
  isLoading: boolean
  match: any
}) {
  if (!smartBets.length) {
    return (
      <div className="card p-6 text-center">
        <Target className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">Sin apuestas recomendadas para este partido.</p>
        <p className="text-xs text-zinc-600 mt-1">El modelo requiere más datos para generar recomendaciones confiables.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Smart Bets</h3>
        <span className="text-[10px] text-zinc-500 ml-auto">{smartBets.length} apuesta{smartBets.length !== 1 ? 's' : ''} detectada{smartBets.length !== 1 ? 's' : ''}</span>
      </div>

      {smartBets.map((bet, idx) => {
        const explanation = analysis?.betExplanations?.[bet.id]
        const valueGrade = computeValueGrade(bet.confidence, bet.id, odds)
        const valueCfg = VALUE_CONFIG[valueGrade]
        const avgOdds = getAvgOdds(bet.id, odds)

        return (
          <div
            key={bet.id}
            className={cn(
              'card overflow-hidden',
              bet.tier === 'premium' || bet.tier === 'muy_fuerte' ? 'border-glow-success' :
              bet.tier === 'fuerte' ? 'border-glow-warning' :
              bet.tier === 'evitar' ? 'border-glow-risk' : 'border-glow-neutral'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-600 mono">#{idx + 1}</span>
                <span className="text-sm font-semibold text-white">{bet.label}</span>
              </div>
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', TIER_STYLE[bet.tier])}>
                {TIER_LABEL[bet.tier] ?? bet.tier}
              </span>
            </div>

            <div className="p-4">
              {/* Probability + value row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                {/* Prob gauge */}
                <div className="flex flex-col items-center gap-1">
                  <div className="relative h-14 w-14">
                    <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#27272a" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="14"
                        fill="none"
                        stroke={
                          bet.tier === 'premium' || bet.tier === 'muy_fuerte' ? '#10b981' :
                          bet.tier === 'fuerte' ? '#f59e0b' :
                          bet.tier === 'evitar' ? '#ef4444' : '#6366f1'
                        }
                        strokeWidth="3"
                        strokeDasharray={`${bet.confidence * 0.88} 88`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-black mono text-white">
                      {bet.confidence}%
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-500">Probabilidad</p>
                </div>

                {/* Value indicator + odds */}
                <div className="flex-1 space-y-2">
                  <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold', valueCfg.bg, valueCfg.color)}>
                    <Flame className="h-3 w-3" />
                    {valueCfg.label}
                  </div>
                  {avgOdds && (
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      <span>Cuota prom. mercado:</span>
                      <span className="mono font-semibold text-zinc-300">{avgOdds.toFixed(2)}</span>
                    </div>
                  )}
                  {bet.edge != null && bet.edge > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <ChevronRight className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold mono">+{bet.edge.toFixed(1)}% edge vs mercado</span>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Explanation */}
              <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3">
                <p className="text-[10px] text-zinc-500 mb-1.5 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-emerald-400" />
                  ¿Por qué esta apuesta?
                </p>
                {isLoading && !explanation ? (
                  <div className="space-y-1.5">
                    <Skeleton className="h-2.5 w-full" />
                    <Skeleton className="h-2.5 w-5/6" />
                    <Skeleton className="h-2.5 w-4/6" />
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    {explanation ?? bet.justification}
                  </p>
                )}
              </div>

              {/* For/Against factors */}
              {(bet.factors?.for?.length || bet.factors?.against?.length) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {bet.factors?.for?.length > 0 && (
                    <div>
                      <p className="text-[9px] text-emerald-500 font-semibold mb-1">A favor</p>
                      {bet.factors.for.slice(0, 2).map((f, i) => (
                        <p key={i} className="text-[10px] text-zinc-500 leading-relaxed">• {f}</p>
                      ))}
                    </div>
                  )}
                  {bet.factors?.against?.length > 0 && (
                    <div>
                      <p className="text-[9px] text-red-500 font-semibold mb-1">En contra</p>
                      {bet.factors.against.slice(0, 2).map((f, i) => (
                        <p key={i} className="text-[10px] text-zinc-500 leading-relaxed">• {f}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Section 7: Risk Factors ──────────────────────────────────

function RisksSection({ analysis, injuries, match, isLoading }: {
  analysis: MatchAnalysis | null; injuries: any[]; match: any; isLoading: boolean
}) {
  if (isLoading) return <CardSkeleton lines={3} />

  const aiRisks = analysis?.risks ?? []
  const injuryRisks = injuries
    .filter((inj: any) => inj.impact_score >= 30)
    .slice(0, 2)
    .map((inj: any) => {
      const teamName = inj.team_id === match.home_team_id
        ? (match.home_team?.short_name ?? 'Local')
        : (match.away_team?.short_name ?? 'Visitante')
      return `Baja de ${inj.players?.short_name ?? 'jugador clave'} en ${teamName} (impacto ${inj.impact_score}/100).`
    })

  const allRisks = [...injuryRisks, ...aiRisks].filter(Boolean).slice(0, 5)

  if (!allRisks.length) return null

  return (
    <div className="card p-4 border-glow-risk">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Factores de Riesgo</h3>
      </div>
      <div className="space-y-2">
        {allRisks.map((risk, i) => (
          <div key={i} className="flex gap-2.5 items-start">
            <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-amber-500/15 flex items-center justify-center">
              <span className="text-[9px] font-bold text-amber-400">{i + 1}</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">{risk}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section 8: AI Conclusion ─────────────────────────────────

function ConclusionSection({ analysis, isLoading }: { analysis: MatchAnalysis | null; isLoading: boolean }) {
  if (isLoading) return <CardSkeleton lines={4} />
  if (!analysis?.conclusion) return null

  return (
    <div className="card p-4 border-glow-success">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Conclusión IA</h3>
        <span className={cn(
          'ml-auto text-[9px] mono px-1.5 py-0.5 rounded border',
          analysis.is_fallback
            ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
            : 'text-zinc-600 border-transparent'
        )}>
          {analysis.is_fallback ? 'Estimación del modelo' : 'Generado por IA'}
        </span>
      </div>
      <p className="text-[12px] text-zinc-300 leading-relaxed">{analysis.conclusion}</p>
    </div>
  )
}

// ─── Client-side fallback (mirrors server generateFallbackAnalysis) ──────────

function buildFallback(ctx: AnalysisContext, bets: SmartBetRecommendation[]): MatchAnalysis {
  const home  = ctx.homeTeam.name
  const away  = ctx.awayTeam.name
  const hw    = Math.round(ctx.prediction.home_win_probability * 100)
  const aw    = Math.round(ctx.prediction.away_win_probability * 100)
  const hXg   = ctx.homeStats?.avg_xg  ?? 1.2
  const aXg   = ctx.awayStats?.avg_xg  ?? 1.0
  const hXga  = ctx.homeStats?.avg_xga ?? 1.1
  const aXga  = ctx.awayStats?.avg_xga ?? 1.2
  const favor = hw > aw ? home : aw > hw ? away : 'ambos equipos'

  return {
    tactical: {
      homeStyle: `${home} desarrolla un juego de presión alta con producción ofensiva de ${hXg.toFixed(1)} xG por partido, privilegiando el control de zonas centrales y la transición rápida tras recuperar el balón.`,
      awayStyle: `${away} apuesta por una estructura defensiva compacta concediendo solo ${aXga.toFixed(1)} xG por partido, buscando hacer daño mediante el contraataque y la pelota parada.`,
      homeStrengths: `Potencia ofensiva de ${hXg.toFixed(1)} xG por partido, ventaja ELO (${ctx.homeTeam.elo_rating}) y solidez en mediocampo. Favorito estadístico del modelo híbrido.`,
      awayStrengths: `Disciplina táctica defensiva, capacidad de absorber presión y eficiencia en contraataques. Solvencia en partidos de alta tensión.`,
      homeWeaknesses: `Con ${hXga.toFixed(1)} xGA por partido, vulnerable al contragolpe si el visitante cierra bien los espacios y explota la profundidad.`,
      awayWeaknesses: `Producción ofensiva de ${aXg.toFixed(1)} xG por partido puede ser insuficiente si el local establece dominio posesional desde el inicio.`,
      keyBattleground: `El mediocampo será el campo de batalla decisivo. Quien controle las segundas jugadas y limite las transiciones del rival definirá el ritmo y las oportunidades de gol.`,
      possessionEdge: hw > aw + 10 ? 'home' : aw > hw + 10 ? 'away' : 'balanced',
      possessionReason: `${hw > aw ? home : away} tiene ventaja en posesión basada en el diferencial ELO y su estilo de juego predominante.`,
      transitionEdge: 'balanced',
      transitionReason: `Ambos equipos presentan capacidades similares en transición, con el visitante favoreciendo el contragolpe y el local la presión inmediata.`,
      firstHalf: `Inicio cauteloso mientras ambos equipos se estudian. ${home} buscará establecer control posesional mientras ${away} aguarda estructurado para aprovechar los espacios al contragolpe.`,
      secondHalf: `Mayor apertura de espacios a medida que avance el partido. La fatiga y la presión del marcador provocarán ajustes tácticos significativos, con mayor intensidad en los últimos 20 minutos.`,
    },
    context: {
      homeNeed: `${home} necesita los tres puntos para consolidar su posición en el grupo y mantener vivas sus aspiraciones de clasificación en el Mundial 2026.`,
      awayNeed: `${away} busca un resultado positivo —mínimo un punto— que le permita mantener opciones vigentes en la fase de grupos del torneo.`,
      intensityLevel: hw > 75 || aw > 75 ? 'Muy Alta' : hw > 60 || aw > 60 ? 'Alta' : (hw < 40 && aw < 40) ? 'Baja' : 'Media',
      intensityReason: `La diferencia entre equipos y el momento del torneo generan una intensidad elevada donde un resultado negativo puede comprometer seriamente la clasificación de uno o ambos equipos.`,
      competitiveDescription: `Este encuentro en la ${ctx.phase} del Mundial 2026 tiene peso crítico. El marcador final definirá posiblemente las opciones de clasificación al siguiente ronda, elevando la presión y la intensidad competitiva del partido.`,
    },
    betExplanations: Object.fromEntries(
      bets.map(b => [
        b.id,
        `El modelo asigna ${b.confidence}% de probabilidad a esta apuesta basándose en el análisis conjunto de xG (${hXg.toFixed(1)} vs ${aXg.toFixed(1)}), ELO rating, forma reciente y diferencial estadístico entre ${home} y ${away}. Nivel de confianza ${b.tier}.`,
      ])
    ),
    risks: [
      `Posibles rotaciones o cambios de alineación no reflejados en los datos estadísticos actuales podrían alterar las proyecciones del modelo.`,
      `La presión psicológica de un partido de Mundial puede generar variaciones de rendimiento difíciles de cuantificar estadísticamente.`,
      ctx.weather_condition !== 'Despejado' || ctx.weather_temp_celsius !== 22
        ? `Condiciones climáticas (${ctx.weather_condition}, ${ctx.weather_temp_celsius}°C) podrían afectar el ritmo e intensidad del partido.`
        : `Factores externos como el estado del terreno de juego y las decisiones arbitrales pueden inclinar el balance en un partido ajustado.`,
    ],
    conclusion: `El análisis posiciona a ${favor} como favorito estadístico con ${Math.max(hw, aw)}% de probabilidad. ${bets[0] ? `La apuesta con mejor equilibrio riesgo-valor es "${bets[0].label}" (${bets[0].confidence}% de confianza), respaldada por los indicadores xG y el diferencial ELO acumulado.` : 'El modelo no detecta apuestas con valor diferencial claro para este partido.'} El principal factor de riesgo es la imprevisibilidad inherente a los partidos de fase de grupos del Mundial, donde la presión puede distorsionar los patrones estadísticos habituales. Se recomienda un enfoque conservador de gestión del riesgo.`,
    is_fallback: true,
  }
}

// ─── Main component ───────────────────────────────────────────

export function AISmartBetsPanel({
  prediction,
  homeStats,
  awayStats,
  match,
  injuries,
  odds = [],
  homeRecentMatches = [],
  awayRecentMatches = [],
}: Props) {
  // Compute smart bets using existing engine
  const smartBets = useMemo(() => {
    if (!prediction) return []
    return computeSmartBets(
      prediction, homeStats, awayStats,
      match.home_team, match.away_team,
      injuries, match, odds,
      homeRecentMatches, awayRecentMatches,
    )
  }, [
    prediction?.id, homeStats, awayStats,
    match.home_team_id, match.away_team_id, match.id,
    injuries, odds, homeRecentMatches, awayRecentMatches,
  ])

  // Build context for AI analysis
  const context: AnalysisContext = useMemo(() => ({
    matchId: match.id,
    homeTeam: {
      name: match.home_team?.name ?? 'Local',
      code: match.home_team?.code ?? 'LOC',
      fifa_ranking: match.home_team?.fifa_ranking ?? 0,
      elo_rating: match.home_team?.elo_rating ?? 1500,
    },
    awayTeam: {
      name: match.away_team?.name ?? 'Visitante',
      code: match.away_team?.code ?? 'VIS',
      fifa_ranking: match.away_team?.fifa_ranking ?? 0,
      elo_rating: match.away_team?.elo_rating ?? 1500,
    },
    phase: match.phase ?? 'Fase de grupos',
    venue: match.venue ?? '',
    city: match.city ?? '',
    weather_condition: match.weather_condition ?? 'Despejado',
    weather_temp_celsius: match.weather_temp_celsius ?? 22,
    home_rest_days: match.home_rest_days ?? 4,
    away_rest_days: match.away_rest_days ?? 4,
    homeStats: homeStats ?? {},
    awayStats: awayStats ?? {},
    homeForm: homeRecentMatches.slice(0, 6),
    awayForm: awayRecentMatches.slice(0, 6),
    homeInjuries: injuries
      .filter((i: any) => i.team_id === match.home_team_id && i.is_active)
      .map((i: any) => ({
        name: i.players?.short_name ?? i.players?.name ?? 'Jugador',
        position: i.players?.position ?? '—',
        impact: i.impact_score ?? 0,
      })),
    awayInjuries: injuries
      .filter((i: any) => i.team_id === match.away_team_id && i.is_active)
      .map((i: any) => ({
        name: i.players?.short_name ?? i.players?.name ?? 'Jugador',
        position: i.players?.position ?? '—',
        impact: i.impact_score ?? 0,
      })),
    prediction: {
      home_win_probability: prediction?.home_win_probability ?? 0.40,
      draw_probability: prediction?.draw_probability ?? 0.28,
      away_win_probability: prediction?.away_win_probability ?? 0.32,
      predicted_home_score: prediction?.predicted_home_score ?? 1,
      predicted_away_score: prediction?.predicted_away_score ?? 1,
      confidence_score: prediction?.confidence_score ?? 60,
    },
    bets: smartBets.map(b => ({ id: b.id, label: b.label, confidence: b.confidence, tier: b.tier })),
  }), [match.id, prediction?.id, homeStats, awayStats, homeRecentMatches, awayRecentMatches, injuries, smartBets])

  // Fallback determinístico calculado en cliente (siempre disponible)
  const fallbackAnalysis = useMemo(
    () => buildFallback(context, smartBets),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [match.id, prediction?.home_win_probability, prediction?.draw_probability,
     prediction?.away_win_probability, prediction?.confidence_score, homeStats, awayStats,
     homeRecentMatches, awayRecentMatches, injuries, smartBets]
  )

  // Fetch AI analysis
  const { data: analysis, isLoading } = useQuery<MatchAnalysis>({
    queryKey: ['match-analysis', match.id, smartBets.map(b => b.id).join(',')],
    queryFn: async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      try {
        const res = await fetch(`/api/analysis/match/${match.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Analysis failed')
        return res.json()
      } finally {
        clearTimeout(timer)
      }
    },
    staleTime: 30 * 60 * 1000,
    retry: false,
    enabled: !!prediction,
  })

  // Mientras carga → skeleton; si falla o no hay API key → fallback; si ok → AI
  const displayAnalysis: MatchAnalysis | null = isLoading ? null : (analysis ?? fallbackAnalysis)

  if (!prediction) {
    return (
      <div className="card p-8 text-center">
        <Sparkles className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">Sin predicción disponible para generar el análisis.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 1. AI Summary */}
      <AISummarySection prediction={prediction} smartBets={smartBets} match={match} />

      {/* 2. Tactical Analysis */}
      <TacticalSection match={match} analysis={displayAnalysis} isLoading={isLoading} />

      {/* 3. Form Status */}
      <FormSection
        match={match}
        homeRecentMatches={homeRecentMatches}
        awayRecentMatches={awayRecentMatches}
        homeStats={homeStats}
        awayStats={awayStats}
      />

      {/* 4. World Cup Context */}
      <ContextSection match={match} analysis={displayAnalysis} isLoading={isLoading} />

      {/* 5 + 6. Smart Bets + Value Indicator */}
      <SmartBetsSection
        smartBets={smartBets}
        analysis={displayAnalysis}
        odds={odds}
        isLoading={isLoading}
        match={match}
      />

      {/* 7. Risk Factors */}
      <RisksSection
        analysis={displayAnalysis}
        injuries={injuries}
        match={match}
        isLoading={isLoading}
      />

      {/* 8. AI Conclusion */}
      <ConclusionSection analysis={displayAnalysis} isLoading={isLoading} />
    </div>
  )
}
