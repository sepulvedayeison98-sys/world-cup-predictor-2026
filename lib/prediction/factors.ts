/**
 * Prediction Engine · FACTORES y utilidades numéricas (fútbol).
 *
 * Responsabilidad: transformar las señales crudas (ELO, forma, xG) en factores
 * normalizados 0..1, más los helpers matemáticos compartidos. Lógica pura,
 * idéntica a v1.2.0 — no cambia ningún resultado.
 */
import { ENGINE_PARAMS } from './config'

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

export function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

export function round4(x: number): number {
  return Math.round(x * 10000) / 10000
}

/** Probabilidad logística de victoria local por diferencia de ELO. */
export function normalizeELO(homeELO: number, awayELO: number): number {
  return 1 / (1 + Math.pow(10, -(homeELO - awayELO) / 400))
}

/** Puntaje de forma 0..1 (W=1, D=0.5, L=0) sobre los últimos `lookback` partidos. */
export function formToScore(form: string[], lookback = ENGINE_PARAMS.formLookback): number {
  if (!form?.length) return 0.5
  const recent = form.slice(-lookback)
  return recent.reduce((s, r) => s + (r === 'W' ? 1 : r === 'D' ? 0.5 : 0), 0) / recent.length
}

export interface XgFactorInput {
  homeXg: number; awayXg: number
  homeXga: number; awayXga: number
  homeShotsOnTarget?: number; awayShotsOnTarget?: number
  homeGoalsScored?: number; awayGoalsScored?: number
}

/**
 * Factor xG/capacidad ofensiva (0..1, ventaja local): combina ataque (xG a
 * favor), solidez defensiva (xG en contra del rival) y eficiencia de conversión
 * (goles / tiros a puerta) cuando hay datos disponibles.
 */
export function computeXgFactor(i: XgFactorInput): number {
  const attack = i.homeXg / Math.max(i.homeXg + i.awayXg, 0.01)
  const defense = i.awayXga / Math.max(i.homeXga + i.awayXga, 0.01)

  const homeConv = (i.homeGoalsScored ?? i.homeXg) / Math.max(i.homeShotsOnTarget ?? 4, 1)
  const awayConv = (i.awayGoalsScored ?? i.awayXg) / Math.max(i.awayShotsOnTarget ?? 4, 1)
  const conversion = homeConv / Math.max(homeConv + awayConv, 0.01)

  return clamp01((attack + defense + conversion) / 3)
}

export function computeConfidenceLevel(score: number): 1 | 2 | 3 | 4 | 5 {
  const t = ENGINE_PARAMS.confidenceLevels
  if (score >= t.l5) return 5
  if (score >= t.l4) return 4
  if (score >= t.l3) return 3
  if (score >= t.l2) return 2
  return 1
}
