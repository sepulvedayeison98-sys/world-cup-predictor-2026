/**
 * Smart Bets Engine — API público (barrel).
 *
 * Motor INDEPENDIENTE que consume las probabilidades del Prediction Engine y las
 * transforma en recomendaciones con valor esperado, riesgo, score explicable y
 * trazabilidad completa. Dependencia: Prediction Engine → Smart Bets → Dashboard
 * → IA. Nunca a la inversa; nunca genera probabilidades por sí mismo.
 *
 * Ver docs/SMART_BETS_ENGINE.md.
 */
export { SMART_BETS_ENGINE_VERSION } from './version'
export { generateSmartBets } from './engine'
export type { GenerateInput, GenerateOptions } from './engine'
export { MARKET_REGISTRY, marketsForSport, getMarket } from './markets'
export type { MarketDef } from './markets'
export { compareModelVsOdds, bestQuote } from './value'
export type { OddsComparison } from './value'
export { assessRisk, RISK_WEIGHTS } from './risk'
export type { RiskAssessment } from './risk'
export { scoreRecommendation, SCORE_WEIGHTS, SCORE_CAPS } from './scoring'
export type { ScoreResult } from './scoring'
export { validateInputs } from './validate'
export type { ValidationResult } from './validate'
export type {
  ModelProbabilities, OddsQuote, MatchContext, TraceRecord,
  SmartBetRecommendation, RiskTier, RecommendationTier,
} from './types'
