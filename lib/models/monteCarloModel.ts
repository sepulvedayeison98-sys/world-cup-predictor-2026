/**
 * Modelo Monte Carlo mejorado.
 * Extiende la rejilla Poisson analítica con:
 * - Intervalos de confianza P50 / P80 / P95
 * - Distribuciones completas de goles, corners y tarjetas
 * - Variables de entrada: lesiones, descanso, fase, clima
 *
 * La rejilla analítica es equivalente a 100.000 iteraciones MC —
 * aquí añadimos las distribuciones de eventos adicionales mediante
 * simulación estocástica ligera (1K – 10K iteraciones configurables).
 */

import { simulateMatch } from '@/lib/predictionEngine'
import type { Probabilities } from '@/lib/predictionEngine'

export interface MCInput {
  lambdaHome: number           // goles esperados local
  lambdaAway: number           // goles esperados visitante
  lambdaCorners?: number       // corners totales esperados (default: 9.5)
  lambdaCards?: number         // tarjetas totales esperadas (default: 3.5)
  lambdaShotsOT?: number       // tiros a puerta totales (default: 6.5)
  iterations?: number          // 1.000 – 10.000 (default: 3.000)
  // Factores contextuales (ya deben estar aplicados a los lambdas de entrada,
  // pero se documentan aquí para trazabilidad)
  phase?: string
  weatherCondition?: string
  homeRestDays?: number
  awayRestDays?: number
}

export interface Distribution {
  [value: number]: number   // valor → probabilidad acumulada
}

export interface Percentile {
  homeGoals: number
  awayGoals: number
  totalGoals: number
  corners: number
  cards: number
  shotsOnTarget: number
}

export interface MCResult {
  probabilities: Probabilities
  exactScores: { home: number; away: number; prob: number }[]

  // Distribuciones de probabilidad
  goalDistributionHome: Distribution
  goalDistributionAway: Distribution
  totalGoalsDistribution: Distribution
  cornersDistribution: Distribution
  cardsDistribution: Distribution
  shotsOTDistribution: Distribution

  // Percentiles
  p50: Percentile
  p80: Percentile
  p95: Percentile

  // Meta
  iterationsUsed: number
  expectedGoalsHome: number
  expectedGoalsAway: number
  expectedCorners: number
  expectedCards: number
}

// ─── Utilidades ────────────────────────────────────────────────────────────────

function samplePoisson(lambda: number): number {
  const L = Math.exp(-lambda)
  let k = 0, p = 1
  do { k++; p *= Math.random() } while (p > L)
  return k - 1
}

function percentileFromSamples(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b)
  const idx = Math.ceil(p * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function buildDistribution(samples: number[]): Distribution {
  const counts: Record<number, number> = {}
  for (const v of samples) counts[v] = (counts[v] ?? 0) + 1
  const total = samples.length
  const dist: Distribution = {}
  for (const [k, c] of Object.entries(counts)) {
    dist[Number(k)] = Math.round((c / total) * 10000) / 10000
  }
  return dist
}

// ─── Motor Monte Carlo ──────────────────────────────────────────────────────────

export function runMonteCarloModel(input: MCInput): MCResult {
  const {
    lambdaHome,
    lambdaAway,
    lambdaCorners  = 9.5,
    lambdaCards    = 3.5,
    lambdaShotsOT  = 6.5,
    iterations     = 3000,
  } = input

  // La rejilla analítica da las probabilidades 1X2 y marcadores exactos
  // con precisión equivalente a 100K simulaciones — la usamos directamente.
  const { probabilities, exactScores } = simulateMatch(
    Math.min(lambdaHome, 5),
    Math.min(lambdaAway, 5)
  )

  // Muestras para distribuciones de eventos adicionales
  const samplesHomeGoals: number[] = []
  const samplesAwayGoals: number[] = []
  const samplesTotalGoals: number[] = []
  const samplesCorners: number[] = []
  const samplesCards: number[] = []
  const samplesShotsOT: number[] = []

  for (let i = 0; i < iterations; i++) {
    const hg = samplePoisson(lambdaHome)
    const ag = samplePoisson(lambdaAway)
    const c  = samplePoisson(lambdaCorners)
    const ca = samplePoisson(lambdaCards)
    const s  = samplePoisson(lambdaShotsOT)

    samplesHomeGoals.push(hg)
    samplesAwayGoals.push(ag)
    samplesTotalGoals.push(hg + ag)
    samplesCorners.push(c)
    samplesCards.push(ca)
    samplesShotsOT.push(s)
  }

  const p50: Percentile = {
    homeGoals:    percentileFromSamples(samplesHomeGoals,  0.50),
    awayGoals:    percentileFromSamples(samplesAwayGoals,  0.50),
    totalGoals:   percentileFromSamples(samplesTotalGoals, 0.50),
    corners:      percentileFromSamples(samplesCorners,    0.50),
    cards:        percentileFromSamples(samplesCards,      0.50),
    shotsOnTarget: percentileFromSamples(samplesShotsOT,  0.50),
  }

  const p80: Percentile = {
    homeGoals:    percentileFromSamples(samplesHomeGoals,  0.80),
    awayGoals:    percentileFromSamples(samplesAwayGoals,  0.80),
    totalGoals:   percentileFromSamples(samplesTotalGoals, 0.80),
    corners:      percentileFromSamples(samplesCorners,    0.80),
    cards:        percentileFromSamples(samplesCards,      0.80),
    shotsOnTarget: percentileFromSamples(samplesShotsOT,  0.80),
  }

  const p95: Percentile = {
    homeGoals:    percentileFromSamples(samplesHomeGoals,  0.95),
    awayGoals:    percentileFromSamples(samplesAwayGoals,  0.95),
    totalGoals:   percentileFromSamples(samplesTotalGoals, 0.95),
    corners:      percentileFromSamples(samplesCorners,    0.95),
    cards:        percentileFromSamples(samplesCards,      0.95),
    shotsOnTarget: percentileFromSamples(samplesShotsOT,  0.95),
  }

  return {
    probabilities,
    exactScores,
    goalDistributionHome: buildDistribution(samplesHomeGoals),
    goalDistributionAway: buildDistribution(samplesAwayGoals),
    totalGoalsDistribution: buildDistribution(samplesTotalGoals),
    cornersDistribution: buildDistribution(samplesCorners),
    cardsDistribution: buildDistribution(samplesCards),
    shotsOTDistribution: buildDistribution(samplesShotsOT),
    p50,
    p80,
    p95,
    iterationsUsed: iterations,
    expectedGoalsHome: Math.round(lambdaHome * 100) / 100,
    expectedGoalsAway: Math.round(lambdaAway * 100) / 100,
    expectedCorners: lambdaCorners,
    expectedCards: lambdaCards,
  }
}

export const MODEL_NAME = 'monte_carlo'
export const MODEL_VERSION = '2.0.0'
