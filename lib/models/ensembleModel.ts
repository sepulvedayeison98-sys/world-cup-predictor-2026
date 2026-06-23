/**
 * Modelo Ensemble.
 * Combina los outputs de ELO, Poisson, xG, Monte Carlo y Mercado con pesos
 * ajustables. Cada modelo puede estar ausente — el ensemble se normaliza
 * automáticamente a los modelos disponibles.
 */

import { type Probabilities } from '@/lib/predictionEngine'

export interface ModelSnapshot {
  name: string
  probabilities: Probabilities
  weight: number    // peso relativo (se normaliza internamente)
  available: boolean
}

export interface EnsembleResult {
  probabilities: Probabilities
  modelWeights: Record<string, number>   // pesos normalizados finales
  modelsUsed: number
  confidence: number                     // 0..1 basado en acuerdo entre modelos
}

export function ensembleBlend(models: ModelSnapshot[]): EnsembleResult {
  const active = models.filter(m => m.available)
  if (active.length === 0) {
    return {
      probabilities: { home: 0.333, draw: 0.333, away: 0.334 },
      modelWeights: {},
      modelsUsed: 0,
      confidence: 0,
    }
  }

  const totalWeight = active.reduce((s, m) => s + m.weight, 0)
  const normalizedWeights: Record<string, number> = {}
  active.forEach(m => { normalizedWeights[m.name] = m.weight / totalWeight })

  let home = 0, draw = 0, away = 0
  for (const m of active) {
    const w = normalizedWeights[m.name]
    home += m.probabilities.home * w
    draw += m.probabilities.draw * w
    away += m.probabilities.away * w
  }

  // Acuerdo entre modelos: 1 - desviación estándar promedio de las probabilidades
  const stdHome = Math.sqrt(active.reduce((s, m) => s + (m.probabilities.home - home) ** 2, 0) / active.length)
  const stdDraw = Math.sqrt(active.reduce((s, m) => s + (m.probabilities.draw - draw) ** 2, 0) / active.length)
  const stdAway = Math.sqrt(active.reduce((s, m) => s + (m.probabilities.away - away) ** 2, 0) / active.length)
  const confidence = Math.max(0, 1 - (stdHome + stdDraw + stdAway) * 3)

  const round4 = (x: number) => Math.round(x * 10000) / 10000

  return {
    probabilities: { home: round4(home), draw: round4(draw), away: round4(away) },
    modelWeights: normalizedWeights,
    modelsUsed: active.length,
    confidence,
  }
}

export const MODEL_NAME = 'ensemble'
export const MODEL_VERSION = '2.0.0'
