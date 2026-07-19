/**
 * Prediction Engine · GENERACIÓN DE PROBABILIDADES (fútbol).
 *
 * Responsabilidad: convertir los goles esperados por equipo (lambda) en
 * probabilidades 1X2 y la matriz de marcadores exactos, resolviendo la rejilla
 * de Poisson con corrección Dixon-Coles de forma ANALÍTICA (exacta, equivalente
 * a un Montecarlo de 100.000 iteraciones pero sin muestreo → determinista).
 *
 * Lógica pura, idéntica a v1.2.0 — no cambia ningún resultado.
 */
import { ENGINE_PARAMS } from './config'
import { round4 } from './factors'

export interface Probabilities { home: number; draw: number; away: number }
export interface ExactScore { home: number; away: number; prob: number }

/** P(k goles | lambda) según la distribución de Poisson. */
function poissonPMF(k: number, lambda: number): number {
  if (k < 0 || !Number.isInteger(k)) return 0
  if (lambda < 0) return 0
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k)
}

function factorial(n: number): number {
  let res = 1
  for (let i = 2; i <= n; i++) res *= i
  return res
}

/**
 * Corrección Dixon-Coles: el Poisson independiente subestima los empates 0-0 y
 * 1-1 en fútbol real. Rho negativo infla esas celdas y deflacta 1-0/0-1.
 */
function dixonColesTau(h: number, a: number, lh: number, la: number, rho: number): number {
  if (h === 0 && a === 0) return 1 - lh * la * rho
  if (h === 0 && a === 1) return 1 + lh * rho
  if (h === 1 && a === 0) return 1 + la * rho
  if (h === 1 && a === 1) return 1 - rho
  return 1
}

/**
 * Resuelve la rejilla de Poisson (home × away) con corrección Dixon-Coles y
 * devuelve las probabilidades 1X2 y el top-10 de marcadores exactos.
 */
export function simulateMatch(
  lambdaHome: number,
  lambdaAway: number,
  rho: number = ENGINE_PARAMS.dixonColesRho,
): { probabilities: Probabilities; exactScores: ExactScore[] } {
  const maxGoals = ENGINE_PARAMS.maxGoals
  const cellProb: number[][] = []
  let totalProb = 0

  for (let h = 0; h <= maxGoals; h++) {
    cellProb[h] = []
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonPMF(h, lambdaHome) * poissonPMF(a, lambdaAway)
        * dixonColesTau(h, a, lambdaHome, lambdaAway, rho)
      cellProb[h][a] = Math.max(0, p)
      totalProb += cellProb[h][a]
    }
  }

  let home = 0, draw = 0, away = 0
  const scores: ExactScore[] = []
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = cellProb[h][a] / totalProb
      if (h > a) home += p
      else if (h < a) away += p
      else draw += p
      scores.push({ home: h, away: a, prob: p })
    }
  }

  const exactScores = scores
    .sort((x, y) => y.prob - x.prob)
    .slice(0, 10)
    .map((s) => ({ ...s, prob: round4(s.prob) }))

  return { probabilities: { home: round4(home), draw: round4(draw), away: round4(away) }, exactScores }
}
