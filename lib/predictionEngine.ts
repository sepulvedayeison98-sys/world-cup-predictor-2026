/**
 * Motor de predicción de fútbol — FACHADA y ORQUESTACIÓN (lógica pura, sin
 * Supabase). ÚNICA FUENTE DE VERDAD de las predicciones de fútbol: la usan
 * services/sync/recalibrate.ts, app/api/predictions/route.ts, lib/simulationEngine
 * y el detalle de partido. No duplicar esta lógica en otros archivos.
 *
 * Estructura modular (Fase 5 — responsabilidades desacopladas):
 *   - lib/prediction/config.ts   → parámetros y versión (perillas del modelo)
 *   - lib/prediction/factors.ts  → señales → factores 0..1 + utilidades
 *   - lib/prediction/poisson.ts  → lambdas → probabilidades (Poisson/Dixon-Coles)
 *   - este archivo               → orquesta los 5 factores y compone la salida
 *
 * Este módulo re-exporta el API público estable; los consumidores siguen
 * importando desde '@/lib/predictionEngine' sin cambios.
 *
 * Modelo híbrido de 5 factores ponderados (ver config.DEFAULT_WEIGHTS):
 *   1. xG y capacidad ofensiva/defensiva  — 40%
 *   2. ELO Rating                          — 25%
 *   3. Forma reciente (últimos 10)          — 15%
 *   4. Mercado de apuestas (cuotas devig)   — 10%
 *   5. Noticias / lesiones / bajas          — 10%
 *
 * Las probabilidades 1X2 y la matriz de marcadores se derivan analíticamente de
 * la rejilla de Poisson: determinista y repetible (misma entrada → misma salida).
 */
import { ENGINE_PARAMS, DEFAULT_WEIGHTS, type Weights } from './prediction/config'
import {
  clamp, clamp01, round4, normalizeELO, formToScore, computeXgFactor, computeConfidenceLevel,
} from './prediction/factors'
import { simulateMatch, type Probabilities, type ExactScore } from './prediction/poisson'

// ─── Re-exportación del API público estable ──────────────────────────────────
export { ENGINE_VERSION, DEFAULT_WEIGHTS } from './prediction/config'
export type { Weights } from './prediction/config'
export { normalizeELO, formToScore, computeConfidenceLevel } from './prediction/factors'
export { simulateMatch } from './prediction/poisson'
export type { Probabilities, ExactScore } from './prediction/poisson'

// ─── Tipos del motor ──────────────────────────────────────────────────────────
export interface ModelInput {
  homeElo: number; awayElo: number
  homeForm: string[]; awayForm: string[]
  homeXg: number; awayXg: number
  homeXga: number; awayXga: number
  homeShotsOnTarget?: number; awayShotsOnTarget?: number
  homeGoalsScored?: number; awayGoalsScored?: number
  homeInjuryImpact: number; awayInjuryImpact: number
  marketProbabilities?: Probabilities // cuotas 1X2 ya "devigueadas" (suman 1)
  isKnockout?: boolean // eliminatoria directa: menos goles por juego conservador
}

export interface ModelResult extends Probabilities {
  predictedHome: number
  predictedAway: number
  confidenceScore: number
  exactScores: ExactScore[]
}

/**
 * Probabilidad de clasificación en un cruce eliminatorio. El 1X2 de 90' sigue
 * siendo válido como mercado, pero el empate no es un resultado final: ~50% de
 * los empates se deciden en prórroga (donde la ventaja ELO opera amortiguada) y
 * ~50% en penales (moneda al aire).
 */
export function computeKnockoutAdvance(
  probs: Probabilities,
  homeElo: number,
  awayElo: number,
): { home: number; away: number } {
  const eloEdge = normalizeELO(homeElo, awayElo)
  const etEdge = 0.5 + (eloEdge - 0.5) * ENGINE_PARAMS.knockoutExtraTimeDamping
  const pDrawToHome = 0.5 * etEdge + 0.5 * 0.5
  const home = clamp01(probs.home + probs.draw * pDrawToHome)
  return { home: round4(home), away: round4(1 - home) }
}

/** Quita el margen de la casa de las cuotas 1X2 → probabilidades de mercado. */
export function devigMarket(oddsHome: number, oddsDraw: number, oddsAway: number): Probabilities | null {
  if (!(oddsHome > 1 && oddsDraw > 1 && oddsAway > 1)) return null
  const ih = 1 / oddsHome, id = 1 / oddsDraw, ia = 1 / oddsAway
  const sum = ih + id + ia
  if (sum <= 0) return null
  return { home: ih / sum, draw: id / sum, away: ia / sum }
}

/**
 * Probabilidad del modelo a partir de los 5 factores ponderados. Construye una
 * distribución de goles esperados por equipo (lambda) y resuelve la rejilla de
 * Poisson para obtener las probabilidades 1X2 y los marcadores exactos.
 */
export function computeModelPrediction(i: ModelInput, weights: Weights = DEFAULT_WEIGHTS): ModelResult {
  const P = ENGINE_PARAMS

  // 1. Factores (0..1, ventaja local)
  const xgScore = computeXgFactor(i)
  const eloScore = normalizeELO(i.homeElo, i.awayElo)
  const formScore = clamp01(formToScore(i.homeForm) - formToScore(i.awayForm) + 0.5)
  const marketScore = i.marketProbabilities
    ? clamp01(i.marketProbabilities.home / Math.max(i.marketProbabilities.home + i.marketProbabilities.away, 0.0001))
    : 0.5
  // Simétrico: mismo piso para ambos equipos.
  const homeFit = Math.max(0, 1 - i.homeInjuryImpact / P.injuryScale)
  const awayFit = Math.max(0, 1 - i.awayInjuryImpact / P.injuryScale)
  const newsScore = clamp01(homeFit - awayFit + 0.5)

  // 2. Fuerza local combinada (reparte el total de goles esperados)
  const hs = clamp(
    xgScore * weights.xg + eloScore * weights.elo + formScore * weights.form +
    marketScore * weights.market + newsScore * weights.news,
    P.homeStrengthClamp[0], P.homeStrengthClamp[1],
  )

  // 3. Goles esperados por equipo (lambda)
  const baseHomeGoals = Math.max(P.minBaseGoals, (i.homeXg + i.awayXga) / 2)
  const baseAwayGoals = Math.max(P.minBaseGoals, (i.awayXg + i.homeXga) / 2)
  const knockoutDamping = i.isKnockout ? P.knockoutDamping : 1
  const totalGoals = clamp((baseHomeGoals + baseAwayGoals) * knockoutDamping, P.totalGoalsClamp[0], P.totalGoalsClamp[1])
  const lambdaHome = clamp(totalGoals * hs, P.lambdaClamp[0], P.lambdaClamp[1])
  const lambdaAway = clamp(totalGoals * (1 - hs), P.lambdaClamp[0], P.lambdaClamp[1])

  // 4. Probabilidades desde la rejilla de Poisson/Dixon-Coles
  const { probabilities: gridProbs, exactScores } = simulateMatch(lambdaHome, lambdaAway)

  // 5. Mezcla con el mercado a nivel de probabilidad (rescata la señal del empate)
  let probabilities = gridProbs
  if (i.marketProbabilities) {
    const mp = i.marketProbabilities
    const { model: mw, market: ow } = P.marketBlend
    const bh = gridProbs.home * mw + mp.home * ow
    const bd = gridProbs.draw * mw + mp.draw * ow
    const ba = gridProbs.away * mw + mp.away * ow
    const sum = bh + bd + ba
    probabilities = { home: round4(bh / sum), draw: round4(bd / sum), away: round4(ba / sum) }
  }

  // 6. Confianza del resultado (0-100)
  const decisiveness = Math.max(probabilities.home, probabilities.draw, probabilities.away) - 1 / 3
  const totalInjury = i.homeInjuryImpact + i.awayInjuryImpact
  const confidenceScore = clamp(
    P.confidence.base + decisiveness * P.confidence.decisivenessCoef - totalInjury * P.confidence.injuryPenalty,
    P.confidence.clamp[0], P.confidence.clamp[1],
  )

  return {
    ...probabilities,
    // Marcador estimado = moda de la matriz (nunca contradice la tabla de exactos)
    predictedHome: exactScores[0]?.home ?? Math.round(lambdaHome),
    predictedAway: exactScores[0]?.away ?? Math.round(lambdaAway),
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    exactScores,
  }
}
