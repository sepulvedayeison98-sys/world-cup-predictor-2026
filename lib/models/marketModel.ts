/**
 * Modelo de Mercado.
 * Usa las probabilidades implícitas de las cuotas (ya devigueadas) como
 * estimación directa del resultado. Si hay múltiples casas, promediar.
 */

import { devigMarket, type Probabilities } from '@/lib/predictionEngine'

export interface MarketOdds {
  bookmaker: string
  oddsHome: number
  oddsDraw: number
  oddsAway: number
}

export interface MarketInput {
  oddsLines: MarketOdds[]
}

export interface MarketResult {
  probabilities: Probabilities
  bookmakerCount: number
  consensusStrength: number  // 0..1 — qué tan alineadas están las casas entre sí
  hasSufficientData: boolean
}

export function marketPredict(input: MarketInput): MarketResult | null {
  const devigged = input.oddsLines
    .map(l => devigMarket(l.oddsHome, l.oddsDraw, l.oddsAway))
    .filter((p): p is Probabilities => p !== null)

  if (devigged.length === 0) return null

  const avgHome = devigged.reduce((s, p) => s + p.home, 0) / devigged.length
  const avgDraw = devigged.reduce((s, p) => s + p.draw, 0) / devigged.length
  const avgAway = devigged.reduce((s, p) => s + p.away, 0) / devigged.length

  // Fuerza del consenso: 1 - varianza promedio entre casas
  const varHome = devigged.reduce((s, p) => s + (p.home - avgHome) ** 2, 0) / devigged.length
  const varDraw = devigged.reduce((s, p) => s + (p.draw - avgDraw) ** 2, 0) / devigged.length
  const varAway = devigged.reduce((s, p) => s + (p.away - avgAway) ** 2, 0) / devigged.length
  const consensusStrength = Math.max(0, 1 - (varHome + varDraw + varAway) * 20)

  const round4 = (x: number) => Math.round(x * 10000) / 10000

  return {
    probabilities: { home: round4(avgHome), draw: round4(avgDraw), away: round4(avgAway) },
    bookmakerCount: devigged.length,
    consensusStrength,
    hasSufficientData: devigged.length >= 2,
  }
}

export const MODEL_NAME = 'market'
export const MODEL_VERSION = '1.0.0'
