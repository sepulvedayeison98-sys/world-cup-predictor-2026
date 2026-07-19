/**
 * Smart Bets Engine · TIPOS compartidos.
 *
 * El Smart Bets Engine CONSUME las probabilidades del Prediction Engine; nunca
 * las genera. La entrada `ModelProbabilities` es una fotografía neutra de la
 * salida del motor (o de la fila `predictions`), desacoplando el Smart Bets
 * Engine de la forma exacta de retorno del Prediction Engine.
 */
import type { SportSlug } from '@/lib/sports'

/** Fotografía de la predicción consumida (del Prediction Engine). */
export interface ModelProbabilities {
  home: number
  draw: number
  away: number
  confidenceScore: number   // 0-100, del Prediction Engine
  modelVersion: string      // versión del Prediction Engine (trazabilidad)
}

/** Cuota de una casa para un mercado (multi-proveedor). */
export interface OddsQuote {
  marketId: string
  bookmaker: string
  oddsValue: number
}

/** Contexto del partido para la recomendación y su traza. */
export interface MatchContext {
  matchId: string
  competitionId: string
  sport: SportSlug
  homeName: string
  awayName: string
  kickoff: string           // ISO
}

export type RiskTier = 'bajo' | 'medio' | 'alto'
export type RecommendationTier = 'premium' | 'fuerte' | 'moderada' | 'descartada'

/** Registro de trazabilidad — todo lo exigido para auditar una recomendación. */
export interface TraceRecord {
  date: string              // ISO de generación
  matchId: string
  market: string
  modelProbability: number  // probabilidad usada
  oddsValue: number         // cuota usada
  bookmaker: string
  expectedValue: number
  riskTier: RiskTier
  predictionEngineVersion: string
  smartBetsEngineVersion: string
  reason: string            // motivo de la recomendación
}

export interface SmartBetRecommendation {
  matchId: string
  market: string
  marketLabel: string
  sport: SportSlug
  bookmaker: string
  oddsValue: number
  modelProbability: number
  impliedProbability: number
  edge: number
  expectedValue: number
  kellyStakePct: number
  riskTier: RiskTier
  riskScore: number         // 0-100
  score: number             // score compuesto 0-100 (explicable)
  scoreBreakdown: Record<string, number>
  tier: RecommendationTier
  rank: number
  reason: string
  trace: TraceRecord
}
