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
import { generateFallbackAnalysis, type AnalysisContext, type MatchAnalysis, type GroupContext } from '@/lib/matchAnalysisFallback'
import {
  AISummarySection, TacticalSection, FormSection, ContextSection,
  SmartBetsSection, RisksSection, ConclusionSection,
} from './smart-bets/sections'


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


// ─── Client-side fallback (mirrors server generateFallbackAnalysis) ──────────


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
    () => generateFallbackAnalysis(context),
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

