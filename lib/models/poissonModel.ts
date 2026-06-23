/**
 * Modelo Poisson puro.
 * Usa xG ofensivo y defensivo para estimar lambdas de goles y
 * resuelve la rejilla de Poisson analíticamente.
 * Re-exporta simulateMatch de predictionEngine para uso directo.
 */

import {
  simulateMatch,
  type Probabilities,
  type ExactScore,
} from '@/lib/predictionEngine'

export interface PoissonInput {
  homeXg: number
  awayXg: number
  homeXga: number
  awayXga: number
}

export interface PoissonResult {
  probabilities: Probabilities
  exactScores: ExactScore[]
  lambdaHome: number
  lambdaAway: number
}

export function poissonPredict(input: PoissonInput): PoissonResult {
  const lambdaHome = Math.max(0.2, (input.homeXg + input.awayXga) / 2)
  const lambdaAway = Math.max(0.2, (input.awayXg + input.homeXga) / 2)

  const { probabilities, exactScores } = simulateMatch(
    Math.min(lambdaHome, 5),
    Math.min(lambdaAway, 5)
  )

  return { probabilities, exactScores, lambdaHome, lambdaAway }
}

export { simulateMatch }
export const MODEL_NAME = 'poisson'
export const MODEL_VERSION = '1.0.0'
