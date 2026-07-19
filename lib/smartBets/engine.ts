/**
 * Smart Bets Engine · ORQUESTADOR.
 *
 * Pipeline (cada paso es un módulo de responsabilidad única):
 *   ingesta/validación → prob. del modelo por mercado (del Prediction Engine)
 *   → comparación de cuotas (multi-casa) → valor esperado → riesgo → scoring
 *   → clasificación → deduplicación → prioridad → recomendaciones con trazabilidad.
 *
 * PRINCIPIO: nunca genera probabilidades. `probabilityFrom` del registro de
 * mercados solo hace álgebra sobre las probabilidades que YA produjo el
 * Prediction Engine. Determinista: misma entrada → mismas recomendaciones.
 *
 * Módulo puro: no toca Supabase, ni el Prediction Engine, ni el Dashboard.
 */
import type { ModelProbabilities, OddsQuote, MatchContext, SmartBetRecommendation, RecommendationTier } from './types'
import { getMarket } from './markets'
import { compareModelVsOdds, bestQuote } from './value'
import { assessRisk } from './risk'
import { scoreRecommendation } from './scoring'
import { validateInputs } from './validate'
import { SMART_BETS_ENGINE_VERSION } from './version'

export interface GenerateOptions {
  minScore?: number      // score mínimo para recomendar (def. 40)
  maxPerMatch?: number   // tope de recomendaciones por partido (def. 5)
  now?: string           // ISO inyectable (determinismo en tests)
}

export interface GenerateInput {
  match: MatchContext
  model: ModelProbabilities
  quotes: OddsQuote[]
  options?: GenerateOptions
}

/** Orden determinista: score desc, luego EV desc, luego id de mercado asc. */
function compareRec(a: SmartBetRecommendation, b: SmartBetRecommendation): number {
  return (b.score - a.score) || (b.expectedValue - a.expectedValue)
    || (a.market < b.market ? -1 : a.market > b.market ? 1 : 0)
}

function classify(score: number, ev: number, minScore: number): RecommendationTier {
  if (ev <= 0 || score < minScore) return 'descartada'
  if (score >= 70) return 'premium'
  if (score >= 55) return 'fuerte'
  return 'moderada'
}

export function generateSmartBets(input: GenerateInput): SmartBetRecommendation[] {
  const { match, model, quotes } = input
  const minScore = input.options?.minScore ?? 40
  const maxPerMatch = input.options?.maxPerMatch ?? 5
  const now = input.options?.now ?? new Date().toISOString()

  // 1. Validación: entrada incoherente → sin recomendaciones (Data First).
  if (!validateInputs(model, quotes).ok) return []

  // 2. Agrupar cuotas por mercado (multi-casa por mercado).
  const byMarket = new Map<string, OddsQuote[]>()
  for (const q of quotes) {
    const list = byMarket.get(q.marketId)
    if (list) list.push(q)
    else byMarket.set(q.marketId, [q])
  }

  // 3. Construir candidatos por mercado activo del deporte del partido.
  const candidates: SmartBetRecommendation[] = []
  for (const [marketId, qs] of byMarket) {
    const def = getMarket(marketId)
    if (!def || !def.active || !def.probabilityFrom) continue
    if (def.sport !== match.sport) continue // aislamiento por deporte

    const best = bestQuote(qs)
    if (!best) continue
    const modelProb = def.probabilityFrom(model)
    if (modelProb <= 0) continue

    const cmp = compareModelVsOdds(modelProb, best)
    const risk = assessRisk({ oddsValue: best.oddsValue, confidenceScore: model.confidenceScore, edge: cmp.edge })
    const sc = scoreRecommendation({
      expectedValue: cmp.expectedValue, edge: cmp.edge,
      confidenceScore: model.confidenceScore, riskScore: risk.score,
    })
    const tier = classify(sc.score, cmp.expectedValue, minScore)
    const reason = `Modelo ${(modelProb * 100).toFixed(1)}% vs mercado ${(cmp.impliedProbability * 100).toFixed(1)}% `
      + `(${best.bookmaker} @${best.oddsValue.toFixed(2)}): EV ${(cmp.expectedValue * 100).toFixed(1)}%, riesgo ${risk.tier}`

    candidates.push({
      matchId: match.matchId, market: marketId, marketLabel: def.label, sport: match.sport,
      bookmaker: best.bookmaker, oddsValue: best.oddsValue, modelProbability: modelProb,
      impliedProbability: cmp.impliedProbability, edge: cmp.edge, expectedValue: cmp.expectedValue,
      kellyStakePct: cmp.kellyStakePct, riskTier: risk.tier, riskScore: risk.score,
      score: sc.score, scoreBreakdown: sc.breakdown, tier, rank: 0, reason,
      trace: {
        date: now, matchId: match.matchId, market: marketId, modelProbability: modelProb,
        oddsValue: best.oddsValue, bookmaker: best.bookmaker, expectedValue: cmp.expectedValue,
        riskTier: risk.tier, predictionEngineVersion: model.modelVersion,
        smartBetsEngineVersion: SMART_BETS_ENGINE_VERSION, reason,
      },
    })
  }

  // 4. Filtrar descartadas.
  const kept = candidates.filter((c) => c.tier !== 'descartada')

  // 5. Deduplicar por FAMILIA (evita señales correlacionadas, p. ej. victoria
  //    local + doble oportunidad 1X): se conserva la de mayor score.
  const byFamily = new Map<string, SmartBetRecommendation>()
  for (const c of [...kept].sort(compareRec)) {
    const fam = getMarket(c.market)!.family
    if (!byFamily.has(fam)) byFamily.set(fam, c)
  }

  // 6. Prioridad + tope por partido + rango.
  const ranked = [...byFamily.values()].sort(compareRec).slice(0, maxPerMatch)
  ranked.forEach((c, i) => { c.rank = i + 1 })
  return ranked
}
