/**
 * Smart Bets Engine · COMPARACIÓN DE CUOTAS y VALOR ESPERADO.
 *
 * Reutiliza las primitivas financieras neutras del proyecto (`gradeEV`,
 * `kellyFraction`) para NO duplicar lógica. (Viven hoy en lib/valueBets; son
 * matemática de apuestas neutra, no de fútbol — su reubicación a un módulo
 * neutro es deuda menor documentada.) EV/edge/implícita son identidades
 * estándar. Multi-proveedor: `bestQuote` elige la mejor cuota entre casas.
 */
import { gradeEV, kellyFraction, type ValueBetGrade } from '@/lib/valueBets'
import type { OddsQuote } from './types'

export interface OddsComparison {
  oddsValue: number
  bookmaker: string
  impliedProbability: number
  edge: number
  expectedValue: number
  grade: ValueBetGrade
  kellyStakePct: number
}

/** Compara la probabilidad del modelo (del Prediction Engine) con una cuota. */
export function compareModelVsOdds(
  modelProb: number,
  quote: { oddsValue: number; bookmaker: string },
): OddsComparison {
  const impliedProbability = 1 / quote.oddsValue
  const edge = modelProb - impliedProbability
  const expectedValue = modelProb * quote.oddsValue - 1
  return {
    oddsValue: quote.oddsValue,
    bookmaker: quote.bookmaker,
    impliedProbability,
    edge,
    expectedValue,
    grade: gradeEV(expectedValue),
    kellyStakePct: kellyFraction(modelProb, quote.oddsValue) * 100,
  }
}

/**
 * Mejor cuota (la más alta = mejor para el apostador) entre varias casas.
 * Determinista: ante empate de cuota, desempata por nombre de casa (asc).
 */
export function bestQuote(quotes: OddsQuote[]): OddsQuote | null {
  if (!quotes.length) return null
  return quotes.reduce((best, q) => {
    if (q.oddsValue > best.oddsValue) return q
    if (q.oddsValue === best.oddsValue && q.bookmaker < best.bookmaker) return q
    return best
  })
}
