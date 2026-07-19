/**
 * Smart Bets Engine · SISTEMA DE SCORING (explicable y reproducible).
 *
 * Puntuación 0-100 construida solo con información objetiva: valor esperado y
 * ventaja (del mercado real), confianza (del Prediction Engine) y riesgo (del
 * módulo risk). Pesos EXPLÍCITOS que suman 1; cada componente se normaliza con
 * un tope documentado. Determinista: misma entrada → mismo score.
 */
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const round2 = (x: number) => Math.round(x * 100) / 100

/** Pesos del score compuesto (suman 1). */
export const SCORE_WEIGHTS = { ev: 0.40, edge: 0.25, confidence: 0.20, risk: 0.15 }

/** Topes de normalización (documentados, no arbitrarios). */
export const SCORE_CAPS = { ev: 0.20, edge: 0.12 }

export interface ScoreResult {
  score: number
  breakdown: Record<string, number>
}

export function scoreRecommendation(input: {
  expectedValue: number
  edge: number
  confidenceScore: number   // 0-100
  riskScore: number         // 0-100 (mayor = más riesgo)
}): ScoreResult {
  const evN = clamp(input.expectedValue / SCORE_CAPS.ev, 0, 1)
  const edgeN = clamp(input.edge / SCORE_CAPS.edge, 0, 1)
  const confN = clamp(input.confidenceScore / 100, 0, 1)
  const riskN = 1 - clamp(input.riskScore / 100, 0, 1) // menos riesgo → más score

  const breakdown = {
    ev: round2(SCORE_WEIGHTS.ev * evN * 100),
    edge: round2(SCORE_WEIGHTS.edge * edgeN * 100),
    confidence: round2(SCORE_WEIGHTS.confidence * confN * 100),
    risk: round2(SCORE_WEIGHTS.risk * riskN * 100),
  }
  const score = round2(breakdown.ev + breakdown.edge + breakdown.confidence + breakdown.risk)
  return { score, breakdown }
}
