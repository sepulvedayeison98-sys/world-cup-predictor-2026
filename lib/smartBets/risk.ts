/**
 * Smart Bets Engine · ANÁLISIS DE RIESGO.
 *
 * Score de riesgo 0-100 (mayor = más riesgo), determinista y explicable. Sin
 * valores arbitrarios: cada componente tiene un peso justificado que suma 100.
 *   · Cuota (varianza)         45  — cuanto más alta la cuota, más varianza.
 *   · Confianza del modelo     35  — a menor confianza del Prediction Engine, más riesgo.
 *   · Ventaja sobre el mercado 20  — un edge ajustado es señal débil.
 */
import type { RiskTier } from './types'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export const RISK_WEIGHTS = { odds: 45, confidence: 35, edge: 20 }

export interface RiskAssessment {
  tier: RiskTier
  score: number
  reasons: string[]
}

export function assessRisk(input: {
  oddsValue: number
  confidenceScore: number   // 0-100, del Prediction Engine
  edge: number
}): RiskAssessment {
  const reasons: string[] = []

  // Cuota: 0 en 1.30, 1 en 6.00 (rango de calidad del proyecto).
  const oddsRisk = clamp((input.oddsValue - 1.3) / (6 - 1.3), 0, 1)
  if (input.oddsValue >= 3.5) reasons.push('Cuota alta: mayor varianza')

  // Confianza: 0 si conf ≥ 75; sube al bajar hasta 25.
  const confRisk = clamp((75 - input.confidenceScore) / 50, 0, 1)
  if (input.confidenceScore < 60) reasons.push('Confianza del modelo moderada o baja')

  // Edge: 0 si edge ≥ 0.05; sube al acercarse a 0.
  const edgeRisk = clamp((0.05 - input.edge) / 0.05, 0, 1)
  if (input.edge < 0.03) reasons.push('Ventaja ajustada sobre el mercado')

  const score = Math.round(clamp(
    oddsRisk * RISK_WEIGHTS.odds + confRisk * RISK_WEIGHTS.confidence + edgeRisk * RISK_WEIGHTS.edge,
    0, 100,
  ))
  const tier: RiskTier = score < 33 ? 'bajo' : score < 66 ? 'medio' : 'alto'
  return { tier, score, reasons }
}
