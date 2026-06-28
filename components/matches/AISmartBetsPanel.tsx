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
import type { AnalysisContext, MatchAnalysis, GroupContext } from '@/app/api/analysis/match/[id]/route'

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
  homeGroupContext?: GroupContext
  awayGroupContext?: GroupContext
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
  const home = ctx.homeTeam.name
  const away = ctx.awayTeam.name
  const hw   = Math.round(ctx.prediction.home_win_probability * 100)
  const aw   = Math.round(ctx.prediction.away_win_probability * 100)
  const dr   = Math.round(ctx.prediction.draw_probability * 100)

  // ── Stats ──
  const hXg      = ctx.homeStats?.avg_xg     ?? 1.2
  const aXg      = ctx.awayStats?.avg_xg     ?? 1.0
  const hXga     = ctx.homeStats?.avg_xga    ?? 1.1
  const aXga     = ctx.awayStats?.avg_xga    ?? 1.2
  const hShots   = ctx.homeStats?.avg_shots  ?? null
  const aShots   = ctx.awayStats?.avg_shots  ?? null
  const hCorners = ctx.homeStats?.avg_corners ?? null
  const aCorners = ctx.awayStats?.avg_corners ?? null
  const hGoalsAvg = ctx.homeStats?.avg_goals_scored ?? hXg
  const aGoalsAvg = ctx.awayStats?.avg_goals_scored ?? aXg
  const hElo     = ctx.homeTeam.elo_rating
  const aElo     = ctx.awayTeam.elo_rating
  const hRank    = ctx.homeTeam.fifa_ranking
  const aRank    = ctx.awayTeam.fifa_ranking

  // ── Form analysis ──
  const hForm = ctx.homeForm ?? []
  const aForm = ctx.awayForm ?? []
  const hN = hForm.length || 1
  const aN = aForm.length || 1
  const hWins        = hForm.filter(m => m.result === 'W').length
  const hDraws       = hForm.filter(m => m.result === 'D').length
  const hLosses      = hForm.filter(m => m.result === 'L').length
  const hCleanSheets = hForm.filter(m => m.goals_conceded === 0).length
  const aWins        = aForm.filter(m => m.result === 'W').length
  const aDraws       = aForm.filter(m => m.result === 'D').length
  const aLosses      = aForm.filter(m => m.result === 'L').length
  const aCleanSheets = aForm.filter(m => m.goals_conceded === 0).length
  const hWinRate     = hWins / hN
  const aWinRate     = aWins / aN
  const hCSRate      = hCleanSheets / hN
  const aCSRate      = aCleanSheets / aN
  const hAvgG        = hForm.length > 0 ? hForm.reduce((s, m) => s + m.goals_scored, 0) / hN : hGoalsAvg
  const aAvgG        = aForm.length > 0 ? aForm.reduce((s, m) => s + m.goals_scored, 0) / aN : aGoalsAvg

  // ── Team profiles ──
  const hIsOff   = hXg > 1.55 || (hShots !== null && hShots > 14)
  const hIsDef   = hXga < 1.0  || hCSRate > 0.45
  const hIsCntr  = !hIsOff && hWinRate > 0.5
  const hInForm  = hWins >= 4 && hN >= 5
  const aIsOff   = aXg > 1.55 || (aShots !== null && aShots > 14)
  const aIsDef   = aXga < 1.0  || aCSRate > 0.45
  const aIsCntr  = !aIsOff && aWinRate > 0.5
  const aInForm  = aWins >= 4 && aN >= 5

  const eloDiff  = hElo - aElo
  const hFavored = eloDiff > 60
  const aFavored = eloDiff < -60

  // ── Phase labels ──
  const KNOCKOUT = new Set(['round_of_32','round_of_16','quarter_final','semi_final','final','third_place'])
  const isKnockout = KNOCKOUT.has(ctx.phase)
  const phaseLabel: Record<string, string> = {
    group: 'fase de grupos', round_of_32: 'dieciseisavos de final',
    round_of_16: 'octavos de final', quarter_final: 'cuartos de final',
    semi_final: 'semifinal', third_place: 'partido por el tercer puesto', final: 'gran final',
  }
  const phaseName = phaseLabel[ctx.phase] ?? ctx.phase
  const nextRound: Record<string, string> = {
    round_of_32: 'los octavos de final', round_of_16: 'los cuartos de final',
    quarter_final: 'las semifinales', semi_final: 'la final',
    third_place: 'el tercer puesto del mundo', final: 'el título mundial',
  }
  const nextRoundName = nextRound[ctx.phase] ?? 'la siguiente fase'

  // ── Home style ──
  const hStyleBits: string[] = []
  if (hIsOff) hStyleBits.push(`ataque prolífico (${hXg.toFixed(2)} xG/pdo${hShots ? `, ${hShots.toFixed(0)} disparos/pdo` : ''})`)
  else if (hIsDef) hStyleBits.push(`solidez defensiva (${hXga.toFixed(2)} xGA/pdo, ${hCleanSheets}/${hN} porterías a cero)`)
  if (hIsCntr) hStyleBits.push('transición vertical letal')
  if (hCorners && hCorners > 6) hStyleBits.push(`presión alta generando ${hCorners.toFixed(1)} córners/pdo`)
  if (hInForm) hStyleBits.push(`en estado de forma exceptional (${hWins}V en ${hN}pj)`)
  const homeStyle = hStyleBits.length > 0
    ? `${home} sustenta su juego en ${hStyleBits.join(', ')}. ${hFavored ? `El diferencial ELO (+${eloDiff} pts) lo convierte en favorito estadístico.` : aFavored ? `Llega como underdog (ELO ${hElo}) pero con capacidad de sorprender.` : `Equilibrio ELO con ${away} (${hElo} vs ${aElo}).`}`
    : `${home} desarrolla un juego de presión alta con ${hXg.toFixed(2)} xG/pdo, priorizando el control posesional y las transiciones rápidas. ${hFavored ? `Su ventaja ELO (${hElo}) refuerza su condición de favorito.` : ''}`

  // ── Away style ──
  const aStyleBits: string[] = []
  if (aIsOff) aStyleBits.push(`potencia ofensiva (${aXg.toFixed(2)} xG/pdo${aShots ? `, ${aShots.toFixed(0)} disparos/pdo` : ''})`)
  else if (aIsDef) aStyleBits.push(`estructura defensiva sólida (${aXga.toFixed(2)} xGA/pdo, ${aCleanSheets}/${aN} porterías imbatidas)`)
  if (aIsCntr) aStyleBits.push('contragolpe efectivo y transiciones rápidas')
  if (aCorners && aCorners > 6) aStyleBits.push(`presencia en córners (${aCorners.toFixed(1)}/pdo)`)
  if (aInForm) aStyleBits.push(`sólida forma reciente (${aWins}/${aN} victorias)`)
  const awayStyle = aStyleBits.length > 0
    ? `${away} se caracteriza por ${aStyleBits.join(', ')}. ${aFavored ? `Su ventaja ELO (${aElo}) lo sitúa como favorito del modelo.` : `Buscará aprovechar cualquier descuido del local.`}`
    : `${away} apuesta por una estructura compacta concediendo ${aXga.toFixed(2)} xGA/pdo, buscando daño en el contragolpe y la pelota parada.`

  // ── Strengths ──
  const hStr: string[] = []
  if (hXg >= 1.7)       hStr.push(`poder ofensivo superior (${hXg.toFixed(2)} xG/pdo)`)
  else if (hXg >= 1.3)  hStr.push(`generación de ocasiones solvente (${hXg.toFixed(2)} xG/pdo)`)
  if (hXga <= 0.9)      hStr.push(`defensa de primer nivel (${hXga.toFixed(2)} xGA/pdo)`)
  if (hCSRate > 0.4)    hStr.push(`portería a cero en ${Math.round(hCSRate * 100)}% de partidos`)
  if (hInForm)          hStr.push(`racha ganadora exceptional (${hWins}V en ${hN}pj)`)
  if (hFavored)         hStr.push(`superioridad ELO (+${eloDiff} pts sobre ${away})`)
  if (hRank > 0 && aRank > 0 && hRank < aRank) hStr.push(`mejor rankeado FIFA (#${hRank} vs #${aRank})`)
  if (hStr.length === 0) hStr.push(`equilibrio ofensivo-defensivo (${hXg.toFixed(2)} xG / ${hXga.toFixed(2)} xGA)`)
  const homeStrengths = hStr.slice(0, 3).join('; ') + '.'

  const aStr: string[] = []
  if (aXg >= 1.7)       aStr.push(`producción ofensiva elevada (${aXg.toFixed(2)} xG/pdo)`)
  else if (aXg >= 1.3)  aStr.push(`generación de ocasiones solvente (${aXg.toFixed(2)} xG/pdo)`)
  if (aXga <= 0.9)      aStr.push(`solidez defensiva de primer nivel (${aXga.toFixed(2)} xGA/pdo)`)
  if (aCSRate > 0.4)    aStr.push(`portería imbatida en ${Math.round(aCSRate * 100)}% de partidos`)
  if (aInForm)          aStr.push(`excelente forma reciente (${aWins}/${aN} victorias)`)
  if (aFavored)         aStr.push(`ventaja ELO (${Math.abs(eloDiff)} pts sobre ${home})`)
  if (aRank > 0 && hRank > 0 && aRank < hRank) aStr.push(`mejor posición FIFA (#${aRank} vs #${hRank})`)
  if (aIsCntr)          aStr.push('efectividad letal en el contragolpe')
  if (aStr.length === 0) aStr.push(`capacidad de absorber presión y golpear en el momento oportuno`)
  const awayStrengths = aStr.slice(0, 3).join('; ') + '.'

  // ── Weaknesses ──
  const hWeak: string[] = []
  if (hXga > 1.5)     hWeak.push(`vulnerabilidad defensiva preocupante (${hXga.toFixed(2)} xGA/pdo)`)
  else if (hXga > 1.2) hWeak.push(`defensa mejorable (${hXga.toFixed(2)} xGA/pdo)`)
  if (hXg < 1.0)      hWeak.push(`escasa creación de ocasiones (${hXg.toFixed(2)} xG/pdo)`)
  if (hLosses >= 3)   hWeak.push(`inestabilidad reciente (${hLosses} derrotas en ${hN} partidos)`)
  if (hWeak.length === 0) hWeak.push(`puede sufrir si ${away} logra cerrar espacios y explotar el contragolpe con velocidad`)
  const homeWeaknesses = hWeak.slice(0, 2).join('; ') + '.'

  const aWeak: string[] = []
  if (aXga > 1.5)     aWeak.push(`defensa expuesta (${aXga.toFixed(2)} xGA/pdo)`)
  else if (aXga > 1.2) aWeak.push(`defensa permeable (${aXga.toFixed(2)} xGA/pdo)`)
  if (aXg < 1.0)      aWeak.push(`producción ofensiva insuficiente (${aXg.toFixed(2)} xG/pdo)`)
  if (aLosses >= 3)   aWeak.push(`racha negativa reciente (${aLosses} derrotas en ${aN} partidos)`)
  if (aWeak.length === 0) aWeak.push(`depende de errores del rival para crear peligro real`)
  const awayWeaknesses = aWeak.slice(0, 2).join('; ') + '.'

  // ── Key battleground ──
  let keyBattleground: string
  if (hIsOff && aIsOff) {
    keyBattleground = `Duelo de ataques: ambos equipos generan más de 1.5 xG/pdo. Con ${(hXg + aXg).toFixed(2)} xG combinados, el primero en marcar tendrá ventaja psicológica decisiva.`
  } else if (hIsDef && aIsDef) {
    keyBattleground = `Máxima contención: ambos equipos conceden menos de 1.0 xGA/pdo. Con ${hCleanSheets + aCleanSheets} porterías a cero combinadas, un error o un córner puede definirlo todo.`
  } else if (hIsOff && !aIsOff) {
    keyBattleground = `El ataque de ${home} (${hXg.toFixed(2)} xG/pdo) contra la resistencia de ${away} (${aXga.toFixed(2)} xGA/pdo). Si ${away} aguanta la primera media hora, el contragolpe puede igualar.`
  } else if (aIsOff && !hIsOff) {
    keyBattleground = `La propuesta ofensiva de ${away} (${aXg.toFixed(2)} xG/pdo) desafía la solidez de ${home} (${hXga.toFixed(2)} xGA/pdo). La gestión del marcador en los primeros 30 minutos será determinante.`
  } else if (Math.abs(eloDiff) > 100) {
    const fav2 = hFavored ? home : away
    const dog  = hFavored ? away : home
    keyBattleground = `La diferencia de nivel (${Math.abs(eloDiff)} puntos ELO) favorece a ${fav2}. ${dog} buscará el orden defensivo y el balón parado para conseguir el golpe de efecto.`
  } else {
    const cornSum = ((hCorners ?? 5) + (aCorners ?? 5)).toFixed(0)
    keyBattleground = `Partido muy equilibrado estadísticamente. El mediocampo y las segundas jugadas serán el eje de la disputa. ${Number(cornSum) > 12 ? `El juego de córners (${cornSum} promedio combinado) puede ser el detonante.` : 'La fortaleza mental y la gestión del marcador marcarán la diferencia.'}`
  }

  // ── Possession & Transition ──
  const possessionEdge: 'home' | 'away' | 'balanced' =
    hXg > aXg + 0.35 ? 'home' : aXg > hXg + 0.35 ? 'away' : 'balanced'
  const transitionEdge: 'home' | 'away' | 'balanced' =
    hIsCntr ? 'home' : aIsCntr ? 'away' : 'balanced'

  // ── Halves ──
  const firstHalf = isKnockout
    ? `Inicio tenso bajo la presión de la eliminación directa. ${hIsOff ? `${home} buscará dominar con su ataque (${hXg.toFixed(2)} xG/pdo).` : 'Los primeros 25 minutos serán de máximo estudio táctico antes de que uno tome la iniciativa.'} La mentalidad y la gestión nerviosa serán tan importantes como la táctica.`
    : `Arranque dinámico con ${home} intentando imponer su juego. ${hIsDef ? 'El local priorizará la solidez antes de arriesgar en ataque.' : `Con ${hXg.toFixed(2)} xG/partido, ${home} puede hacer daño temprano.`}`
  const secondHalf = `Mayor apertura de espacios${isKnockout ? ' ante la urgencia de decidir la eliminatoria' : ''}. ${hXg + aXg > 2.8 ? `El potencial ofensivo combinado (${(hXg + aXg).toFixed(2)} xG/pdo) sugiere que el gol puede llegar en cualquier momento.` : 'Los cambios tácticos y el desgaste físico definirán el ritmo final.'} Los últimos 20 minutos pueden ser decisivos.`

  // ── Context ──
  let homeNeed: string, awayNeed: string
  let intensityLevel: 'Muy Alta' | 'Alta' | 'Media' | 'Baja' | 'Muy Baja'
  let intensityReason: string, competitiveDescription: string

  function groupJourney(team: string, grp: GroupContext | undefined, xgVal: number, xgaVal: number): string {
    if (!grp) return ''
    const pos = grp.position === 1 ? 'primero' : grp.position === 2 ? 'segundo' : `${grp.position}º`
    const rivals = grp.otherTeams.slice(0, 2).join(' y ')
    const profile = xgVal > 1.6 ? ' mostrando un ataque potente'
      : xgaVal < 1.0 ? ' con una sólida defensa'
      : xgVal < 1.0 ? ' aunque con dudas en ataque'
      : xgaVal > 1.4 ? ' aunque con algunas dudas defensivas'
      : ''
    return `${team} llega tras terminar ${pos} en el ${grp.groupName} por delante de ${rivals}${profile} (${grp.won}V-${grp.drawn}E-${grp.lost}D, ${grp.goalsFor}:${grp.goalsAgainst}).`
  }

  if (isKnockout) {
    const hGrpText = groupJourney(home, ctx.homeGroupContext, hXg, hXga)
    const aGrpText = groupJourney(away, ctx.awayGroupContext, aXg, aXga)
    const grpNarrative = [hGrpText, aGrpText].filter(Boolean).join(' ')
    homeNeed = `${home} necesita ganar para avanzar a ${nextRoundName}. La eliminación directa convierte cada acción en un evento de máxima trascendencia.`
    awayNeed = `${away} no tiene margen de error: perder significa la eliminación del Mundial 2026. Todo el torneo se juega en estos 90 minutos.`
    intensityLevel = 'Muy Alta'
    intensityReason = `Eliminatoria directa en ${phaseName} del Mundial 2026: el perdedor queda eliminado sin segunda oportunidad. La presión, motivación y tensión competitiva alcanzan su punto máximo.`
    competitiveDescription = `${grpNarrative ? grpNarrative + ' ' : ''}En cruces eliminatorios, la presión suele reducir el número de goles y aumentar el valor de la experiencia táctica. ${home} vs ${away} en ${phaseName}${ctx.city ? ` (${ctx.city})` : ''}: la fortaleza mental pesa tanto como las estadísticas.`
  } else {
    homeNeed = hw > 60
      ? `${home} necesita la victoria para consolidar su posición en la ${phaseName} y mantener vivas las aspiraciones de clasificación.`
      : `${home} busca sumar en la ${phaseName}; un empate puede ser suficiente según la dinámica de su grupo.`
    awayNeed = aw > 60
      ? `${away} requiere los tres puntos para mantener opciones de clasificación en su grupo.`
      : `${away} intentará rescatar al menos un empate que mantenga viva su participación en el Mundial 2026.`
    intensityLevel = hw > 70 || aw > 70 ? 'Alta' : 'Media'
    intensityReason = `La posición en la tabla y las aspiraciones clasificatorias elevan la intensidad de este encuentro de ${phaseName}.`
    competitiveDescription = `Encuentro de ${phaseName} del Mundial 2026${ctx.city ? ` en ${ctx.city}` : ''}. El resultado impactará directamente en las posiciones del grupo y puede definir la clasificación al siguiente ronda.`
  }

  // ── Bet explanations ──
  const hFormStr = `${hWins}V-${hDraws}E-${hLosses}D`
  const aFormStr = `${aWins}V-${aDraws}E-${aLosses}D`
  const betExplanations: Record<string, string> = Object.fromEntries(
    bets.map(b => {
      let expl: string
      if (b.id === 'home_win') {
        expl = `${home} genera ${hXg.toFixed(2)} xG/pdo frente a ${aXga.toFixed(2)} xGA concedido por ${away}. ELO ${hElo}${hFavored ? ` (+${eloDiff} sobre ${away})` : ''}. Forma: ${hFormStr}. Probabilidad modelo: ${b.confidence}%.`
      } else if (b.id === 'away_win') {
        expl = `${away} genera ${aXg.toFixed(2)} xG/pdo vs ${hXga.toFixed(2)} xGA de ${home}. ELO ${aElo}${aFavored ? ` (+${Math.abs(eloDiff)} sobre ${home})` : ''}. Forma: ${aFormStr}. Probabilidad: ${b.confidence}%.`
      } else if (b.id === 'draw') {
        expl = `Probabilidades equilibradas (${hw}%-${dr}%-${aw}%), indicando tendencia al empate. xG combinado de ${(hXg + aXg).toFixed(2)}/pdo sin dominancia estadística clara. Confianza: ${b.confidence}%.`
      } else if (b.id.startsWith('over')) {
        const line = b.id === 'over_1_5' ? '1.5' : b.id === 'over_2_5' ? '2.5' : '3.5'
        expl = `xG combinado ${(hXg + aXg).toFixed(2)}/pdo. ${home}: ${hAvgG.toFixed(1)} goles/pdo (${hN}pj), ${away}: ${aAvgG.toFixed(1)} goles/pdo (${aN}pj). Línea: +${line} goles. Confianza: ${b.confidence}%.`
      } else if (b.id === 'btts_yes') {
        const hScoreRate = hForm.length > 0 ? Math.round((hForm.filter(m => m.goals_scored > 0).length / hN) * 100) : 60
        const aScoreRate = aForm.length > 0 ? Math.round((aForm.filter(m => m.goals_scored > 0).length / aN) * 100) : 50
        expl = `${home} marca en ${hScoreRate}% de sus partidos, ${away} en ${aScoreRate}%. xG combinado: ${(hXg + aXg).toFixed(2)}/pdo. Ambos tienen capacidad goleadora suficiente. Confianza: ${b.confidence}%.`
      } else if (b.id.includes('corners')) {
        const avgCorn = ((hCorners ?? 5.5) + (aCorners ?? 5.5)).toFixed(1)
        expl = `Promedio combinado estimado de ${avgCorn} córners/partido.${hIsOff || aIsOff ? ' El perfil ofensivo de los equipos genera mayor presión y córners asociados.' : ''} Confianza modelo: ${b.confidence}%.`
      } else {
        expl = `xG ${hXg.toFixed(2)} vs ${aXg.toFixed(2)}, ELO ${hElo} vs ${aElo}, forma ${hFormStr} vs ${aFormStr}. El modelo asigna ${b.confidence}% de confianza (tier: ${b.tier}).`
      }
      return [b.id, expl]
    })
  )

  // ── Risks ──
  const risks: string[] = []
  if (ctx.homeInjuries.length > 0) {
    const names = ctx.homeInjuries.slice(0, 2).map(i => i.name).join(', ')
    risks.push(`${home} reporta ${ctx.homeInjuries.length} baja${ctx.homeInjuries.length > 1 ? 's' : ''} activa${ctx.homeInjuries.length > 1 ? 's' : ''}: ${names}. Puede alterar la estructura táctica habitual.`)
  }
  if (ctx.awayInjuries.length > 0) {
    const names = ctx.awayInjuries.slice(0, 2).map(i => i.name).join(', ')
    risks.push(`${away} llega con ${ctx.awayInjuries.length} baja${ctx.awayInjuries.length > 1 ? 's' : ''}: ${names}.`)
  }
  if (isKnockout) {
    risks.push('La presión psicológica de la eliminación directa puede provocar rendimientos atípicos: bloqueos defensivos excesivos o impulsos ofensivos contraproducentes.')
  }
  if (ctx.weather_condition && !/despejado|clear|sun|cloudy|nublado/i.test(ctx.weather_condition)) {
    risks.push(`Condiciones climáticas (${ctx.weather_condition}, ${ctx.weather_temp_celsius}°C) pueden reducir el ritmo técnico y favorecer el juego directo.`)
  }
  if (risks.length < 3) {
    risks.push('Posibles rotaciones o cambios de alineación no reflejados en las estadísticas pueden alterar los perfiles tácticos proyectados.')
  }

  // ── Conclusion ──
  const favorStr = hw > aw
    ? `${home} emerge como favorito estadístico con ${hw}% de probabilidad, sustentado en ${hXg > aXg ? `mayor xG (${hXg.toFixed(2)} vs ${aXg.toFixed(2)})` : `ventaja ELO (${hElo})`}`
    : aw > hw
      ? `${away} es el favorito del modelo con ${aw}% de probabilidad, apoyado en ${aXg > hXg ? `xG superior (${aXg.toFixed(2)} vs ${hXg.toFixed(2)})` : `ventaja ELO (${aElo})`}`
      : `El modelo ve un partido muy equilibrado (${hw}%-${dr}%-${aw}%) entre ${home} y ${away}`
  const betStr = bets[0]
    ? ` La apuesta de mayor valor detectada es "${bets[0].label}" con ${bets[0].confidence}% de confianza (tier: ${bets[0].tier}).`
    : ' El modelo no detecta apuestas con valor diferencial claro en este partido.'
  const riskStr = isKnockout
    ? ' Advertencia: los partidos eliminatorios del Mundial generan variaciones estadísticas difíciles de predecir; la fortaleza mental puede superar las métricas.'
    : ' La variabilidad inherente al fútbol de Mundial recomienda un enfoque conservador en la gestión del riesgo.'

  return {
    tactical: {
      homeStyle, awayStyle,
      homeStrengths, awayStrengths,
      homeWeaknesses, awayWeaknesses,
      keyBattleground,
      possessionEdge,
      possessionReason: possessionEdge === 'home'
        ? `${home} domina el juego posicional con mayor xG (${hXg.toFixed(2)}) y un estilo orientado al control.`
        : possessionEdge === 'away'
          ? `${away} genera más peligro (${aXg.toFixed(2)} xG/pdo) y tiene ventaja en la circulación del balón.`
          : 'Los equipos están equilibrados en la disputa del balón según sus métricas.',
      transitionEdge,
      transitionReason: transitionEdge === 'home'
        ? `${home} es más peligroso en transición rápida, especialmente con espacios abiertos.`
        : transitionEdge === 'away'
          ? `${away} busca el contragolpe vertical como arma principal ante una defensa comprometida.`
          : 'Ambos equipos presentan capacidades de transición similares; ninguno tiene ventaja clara.',
      firstHalf, secondHalf,
    },
    context: { homeNeed, awayNeed, intensityLevel, intensityReason, competitiveDescription },
    betExplanations,
    risks: risks.slice(0, 4),
    conclusion: `${favorStr}. ${betStr}${riskStr}`,
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
  homeGroupContext,
  awayGroupContext,
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
    homeGroupContext,
    awayGroupContext,
  }), [match.id, prediction?.id, homeStats, awayStats, homeRecentMatches, awayRecentMatches, injuries, smartBets, homeGroupContext, awayGroupContext])

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
