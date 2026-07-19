/**
 * Smart Bets Engine · INGESTA / VALIDACIÓN.
 *
 * Verifica la coherencia de la entrada antes de recomendar. Detecta
 * inconsistencias (probabilidades fuera de rango o que no suman ~1, cuotas
 * inválidas, versión del modelo ausente). Si la entrada es incoherente, el motor
 * no recomienda (Data First: mejor nada que una recomendación sin base).
 */
import type { ModelProbabilities, OddsQuote } from './types'

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

export function validateInputs(model: ModelProbabilities, quotes: OddsQuote[]): ValidationResult {
  const errors: string[] = []

  const sum = model.home + model.draw + model.away
  if (Math.abs(sum - 1) > 0.05) errors.push(`Probabilidades 1X2 no suman ~1 (Σ=${sum.toFixed(3)})`)
  for (const [k, v] of [['home', model.home], ['draw', model.draw], ['away', model.away]] as const) {
    if (v < 0 || v > 1) errors.push(`Probabilidad ${k} fuera de [0,1]: ${v}`)
  }
  if (model.confidenceScore < 0 || model.confidenceScore > 100) {
    errors.push(`confidenceScore fuera de [0,100]: ${model.confidenceScore}`)
  }
  if (!model.modelVersion) errors.push('Falta la versión del Prediction Engine')

  for (const q of quotes) {
    if (!(q.oddsValue > 1)) errors.push(`Cuota inválida (${q.marketId}@${q.bookmaker}): ${q.oddsValue}`)
  }

  return { ok: errors.length === 0, errors }
}
