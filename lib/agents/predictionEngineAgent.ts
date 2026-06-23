/**
 * Prediction Engine Agent.
 * Orquesta todos los modelos predictivos y devuelve una comparación completa.
 * Cada modelo se ejecuta de forma independiente; el ensemble combina los disponibles.
 */

import { eloPredict }       from '@/lib/models/eloModel'
import { poissonPredict }   from '@/lib/models/poissonModel'
import { xgPredict }        from '@/lib/models/xgModel'
import { marketPredict }    from '@/lib/models/marketModel'
import { ensembleBlend }    from '@/lib/models/ensembleModel'
import { type Probabilities, DEFAULT_WEIGHTS } from '@/lib/predictionEngine'

export interface ModelComparison {
  name: string
  label: string
  probabilities: Probabilities
  available: boolean
  note?: string
}

export interface PredictionEngineReport {
  models: ModelComparison[]
  ensemble: { probabilities: Probabilities; confidence: number; modelsUsed: number }
  agreement: number   // 0..1 — qué tan alineados están los modelos
  dominantOutcome: 'home' | 'draw' | 'away'
}

export function runPredictionEngineAgent(
  homeStats: any | null,
  awayStats: any | null,
  homeTeam: any | null,
  awayTeam: any | null,
  odds: any[],
  injuries: any[]
): PredictionEngineReport {
  const homeElo = homeTeam?.elo_rating ?? 1500
  const awayElo = awayTeam?.elo_rating ?? 1500
  const homeXg  = homeStats?.avg_xg  ?? 0
  const awayXg  = awayStats?.avg_xg  ?? 0
  const homeXga = homeStats?.avg_xga ?? 0
  const awayXga = awayStats?.avg_xga ?? 0

  // ── Modelo ELO ──────────────────────────────────────────────────────────
  const eloResult = eloPredict({ homeElo, awayElo })

  // ── Modelo Poisson ───────────────────────────────────────────────────────
  let poissonResult = null
  const hasXg = homeXg > 0 && awayXg > 0
  if (hasXg) {
    poissonResult = poissonPredict({ homeXg, awayXg, homeXga, awayXga })
  }

  // ── Modelo xG ────────────────────────────────────────────────────────────
  let xgResult = null
  if (hasXg) {
    xgResult = xgPredict({
      homeXg, awayXg, homeXga, awayXga,
      homeShotsOnTarget: homeStats?.avg_shots_on_target,
      awayShotsOnTarget: awayStats?.avg_shots_on_target,
      homeGoalsScored: homeStats?.avg_goals_scored,
      awayGoalsScored: awayStats?.avg_goals_scored,
    })
  }

  // ── Modelo Mercado ────────────────────────────────────────────────────────
  const oddsLines1x2 = odds.filter((o: any) => o.market === 'h2h' || o.market === '1x2')
  const oddsGrouped = new Map<string, { home: number; draw: number; away: number }>()
  for (const o of oddsLines1x2 as any[]) {
    if (!oddsGrouped.has(o.bookmaker)) {
      oddsGrouped.set(o.bookmaker, { home: 0, draw: 0, away: 0 })
    }
    const entry = oddsGrouped.get(o.bookmaker)!
    if (o.market_outcome === 'home' || o.name === 'home') entry.home = o.odds_value
    if (o.market_outcome === 'draw' || o.name === 'draw') entry.draw = o.odds_value
    if (o.market_outcome === 'away' || o.name === 'away') entry.away = o.odds_value
  }
  const oddsLinesParsed = Array.from(oddsGrouped.entries())
    .filter(([, v]) => v.home > 1 && v.draw > 1 && v.away > 1)
    .map(([bookmaker, v]) => ({ bookmaker, oddsHome: v.home, oddsDraw: v.draw, oddsAway: v.away }))

  const marketResult = oddsLinesParsed.length > 0
    ? marketPredict({ oddsLines: oddsLinesParsed })
    : null

  // ── Ensemble ──────────────────────────────────────────────────────────────
  const models = [
    { name: 'elo',     probabilities: eloResult,                         weight: DEFAULT_WEIGHTS.elo,    available: true },
    { name: 'poisson', probabilities: poissonResult?.probabilities ?? eloResult, weight: DEFAULT_WEIGHTS.xg * 0.5, available: !!poissonResult },
    { name: 'xg',      probabilities: xgResult?.probabilities ?? eloResult,     weight: DEFAULT_WEIGHTS.xg * 0.5, available: !!xgResult },
    { name: 'market',  probabilities: marketResult?.probabilities ?? eloResult,  weight: DEFAULT_WEIGHTS.market,  available: !!marketResult },
  ]

  const ensemble = ensembleBlend(models)

  // ── Comparación visual ────────────────────────────────────────────────────
  const comparisons: ModelComparison[] = [
    {
      name: 'elo', label: 'ELO Rating',
      probabilities: eloResult, available: true,
      note: `Δ ELO: ${homeElo - awayElo > 0 ? '+' : ''}${homeElo - awayElo}`,
    },
    {
      name: 'poisson', label: 'Poisson (xG)',
      probabilities: poissonResult?.probabilities ?? eloResult,
      available: !!poissonResult,
      note: poissonResult ? `λ ${poissonResult.lambdaHome.toFixed(2)} – ${poissonResult.lambdaAway.toFixed(2)}` : 'Sin datos xG',
    },
    {
      name: 'xg', label: 'xG Compuesto',
      probabilities: xgResult?.probabilities ?? eloResult,
      available: !!xgResult,
      note: xgResult ? `Ventaja: ${(xgResult.xgAdvantage * 100).toFixed(0)}%` : 'Sin datos xG',
    },
    {
      name: 'market', label: 'Mercado',
      probabilities: marketResult?.probabilities ?? eloResult,
      available: !!marketResult,
      note: marketResult ? `${marketResult.bookmakerCount} casa${marketResult.bookmakerCount !== 1 ? 's' : ''}` : 'Sin cuotas',
    },
    {
      name: 'ensemble', label: 'Ensemble',
      probabilities: ensemble.probabilities,
      available: true,
      note: `${ensemble.modelsUsed} modelos · conf. ${(ensemble.confidence * 100).toFixed(0)}%`,
    },
  ]

  const ep = ensemble.probabilities
  const dominantOutcome: 'home' | 'draw' | 'away' =
    ep.home >= ep.draw && ep.home >= ep.away ? 'home' :
    ep.away >= ep.home && ep.away >= ep.draw ? 'away' : 'draw'

  return {
    models: comparisons,
    ensemble: { probabilities: ensemble.probabilities, confidence: ensemble.confidence, modelsUsed: ensemble.modelsUsed },
    agreement: ensemble.confidence,
    dominantOutcome,
  }
}
