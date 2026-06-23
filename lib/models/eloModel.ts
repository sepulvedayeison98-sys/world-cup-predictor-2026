/**
 * Modelo ELO puro.
 * Deriva probabilidades 1X2 exclusivamente del diferencial de ELO.
 * Sirve como baseline para comparar contra modelos más complejos.
 */

import { type Probabilities, normalizeELO } from '@/lib/predictionEngine'

export interface EloInput {
  homeElo: number
  awayElo: number
}

/**
 * Convierte ventaja ELO en probabilidades 1X2.
 * El empate se estima mediante la función logística centrada en 0.25.
 */
export function eloPredict(input: EloInput): Probabilities {
  const homeAdvantage = normalizeELO(input.homeElo, input.awayElo)

  // Empate inversamente proporcional a la diferencia de ELO
  const drawProb = 0.26 - Math.abs(homeAdvantage - 0.5) * 0.4
  const remaining = 1 - Math.max(0.05, drawProb)

  const home = homeAdvantage * remaining
  const away = (1 - homeAdvantage) * remaining

  return {
    home: Math.round(home * 10000) / 10000,
    draw: Math.round(Math.max(0.05, drawProb) * 10000) / 10000,
    away: Math.round(away * 10000) / 10000,
  }
}

export const MODEL_NAME = 'elo'
export const MODEL_VERSION = '1.0.0'
