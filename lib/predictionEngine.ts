/**
 * Motor de prediccion (logica pura, sin Supabase). Unica fuente de verdad:
 * la usan services/sync/recalibrate.ts, app/api/predictions/route.ts y
 * lib/simulationEngine.ts. No duplicar esta logica en otros archivos.
 *
 * Modelo hibrido de 5 factores ponderados:
 *   1. xG y capacidad ofensiva/defensiva  — 40%
 *   2. ELO Rating                          — 25%
 *   3. Forma reciente (ultimos 10 partidos) — 15%
 *   4. Mercado de apuestas (cuotas devig)   — 10%
 *   5. Noticias / lesiones / bajas          — 10%
 *
 * Las probabilidades 1X2 y la matriz de marcadores exactos no salen de una
 * heuristica directa: se derivan de una distribucion de goles esperados
 * (lambda por equipo) resuelta analiticamente sobre la rejilla de Poisson.
 * Esto equivale al resultado de una simulacion de Montecarlo de 100,000
 * iteraciones (la rejilla analitica es exacta, no aproximada por muestreo),
 * por lo que se usa como motor de la "simulacion Montecarlo" del modelo.
 */

export interface Weights {
  xg: number
  elo: number
  form: number
  market: number
  news: number
}

export const DEFAULT_WEIGHTS: Weights = {
  xg: 0.40,
  elo: 0.25,
  form: 0.15,
  market: 0.10,
  news: 0.10,
}

export interface ModelInput {
  homeElo: number; awayElo: number
  homeForm: string[]; awayForm: string[]
  homeXg: number; awayXg: number
  homeXga: number; awayXga: number
  homeShotsOnTarget?: number; awayShotsOnTarget?: number
  homeGoalsScored?: number; awayGoalsScored?: number
  homeInjuryImpact: number; awayInjuryImpact: number
  marketProbabilities?: Probabilities // cuotas 1X2 ya "devigueadas" (suman 1)
}

export interface Probabilities { home: number; draw: number; away: number }

export interface ExactScore { home: number; away: number; prob: number }

export interface ModelResult extends Probabilities {
  predictedHome: number
  predictedAway: number
  confidenceScore: number
  exactScores: ExactScore[]
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000
}

export function normalizeELO(homeELO: number, awayELO: number): number {
  return 1 / (1 + Math.pow(10, -(homeELO - awayELO) / 400))
}

/** Puntaje de forma 0..1 (W=1, D=0.5, L=0) sobre los ultimos `lookback` partidos. */
export function formToScore(form: string[], lookback = 10): number {
  if (!form?.length) return 0.5
  const recent = form.slice(-lookback)
  return recent.reduce((s, r) => s + (r === 'W' ? 1 : r === 'D' ? 0.5 : 0), 0) / recent.length
}

/**
 * Factor xG/capacidad ofensiva (0..1, ventaja local): combina ataque (xG a
 * favor), solidez defensiva (xG en contra del rival) y eficiencia de
 * conversion (goles / tiros a puerta) cuando hay datos disponibles.
 */
function computeXgFactor(i: ModelInput): number {
  const attack = i.homeXg / Math.max(i.homeXg + i.awayXg, 0.01)
  const defense = i.awayXga / Math.max(i.homeXga + i.awayXga, 0.01)

  const homeConv = (i.homeGoalsScored ?? i.homeXg) / Math.max(i.homeShotsOnTarget ?? 4, 1)
  const awayConv = (i.awayGoalsScored ?? i.awayXg) / Math.max(i.awayShotsOnTarget ?? 4, 1)
  const conversion = homeConv / Math.max(homeConv + awayConv, 0.01)

  return clamp01((attack + defense + conversion) / 3)
}

export function computeConfidenceLevel(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 85) return 5
  if (score >= 75) return 4
  if (score >= 65) return 3
  if (score >= 55) return 2
  return 1
}

/** P(k goles | lambda) segun la distribucion de Poisson. */
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
 * Resuelve la rejilla de Poisson (home x away) y devuelve las probabilidades
 * 1X2 y el top-10 de marcadores exactos. Equivalente al resultado de una
 * simulacion de Montecarlo de 100,000 iteraciones sobre los mismos lambdas.
 */
export function simulateMatch(lambdaHome: number, lambdaAway: number): {
  probabilities: Probabilities; exactScores: ExactScore[]
} {
  const maxGoals = 8
  const cellProb: number[][] = []
  let totalProb = 0

  for (let h = 0; h <= maxGoals; h++) {
    cellProb[h] = []
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonPMF(h, lambdaHome) * poissonPMF(a, lambdaAway)
      cellProb[h][a] = p
      totalProb += p
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

/**
 * Probabilidad de clasificación en un cruce eliminatorio. El 1X2 de 90'
 * sigue siendo válido como mercado, pero el empate no es un resultado final:
 * ~50% de los empates se deciden en prórroga (donde la ventaja ELO opera
 * amortiguada, x0.6) y ~50% en penales (moneda al aire).
 */
export function computeKnockoutAdvance(
  probs: Probabilities,
  homeElo: number,
  awayElo: number,
): { home: number; away: number } {
  const eloEdge = normalizeELO(homeElo, awayElo)
  const etEdge = 0.5 + (eloEdge - 0.5) * 0.6
  const pDrawToHome = 0.5 * etEdge + 0.5 * 0.5
  const home = clamp01(probs.home + probs.draw * pDrawToHome)
  return { home: round4(home), away: round4(1 - home) }
}

/** Quita el margen de la casa de las cuotas 1X2 -> probabilidades de mercado. */
export function devigMarket(oddsHome: number, oddsDraw: number, oddsAway: number): Probabilities | null {
  if (!(oddsHome > 1 && oddsDraw > 1 && oddsAway > 1)) return null
  const ih = 1 / oddsHome, id = 1 / oddsDraw, ia = 1 / oddsAway
  const sum = ih + id + ia
  if (sum <= 0) return null
  return { home: ih / sum, draw: id / sum, away: ia / sum }
}

/**
 * Probabilidad del modelo a partir de los 5 factores ponderados. Construye
 * una distribucion de goles esperados por equipo y resuelve la simulacion
 * (rejilla de Poisson, ver `simulateMatch`) para obtener probabilidades 1X2
 * y la matriz de marcadores exactos.
 */
export function computeModelPrediction(i: ModelInput, weights: Weights = DEFAULT_WEIGHTS): ModelResult {
  const xgScore = computeXgFactor(i)
  const eloScore = normalizeELO(i.homeElo, i.awayElo)
  const formScore = clamp01(formToScore(i.homeForm) - formToScore(i.awayForm) + 0.5)
  const marketScore = i.marketProbabilities
    ? clamp01(i.marketProbabilities.home / Math.max(i.marketProbabilities.home + i.marketProbabilities.away, 0.0001))
    : 0.5
  const newsScore = clamp01(
    Math.max(0.1, 1 - i.homeInjuryImpact / 50) - Math.max(0, 1 - i.awayInjuryImpact / 50) + 0.5
  )

  // Fuerza local combinada (0.05..0.95): reparte el total de goles esperados.
  const hs = clamp(
    xgScore * weights.xg + eloScore * weights.elo + formScore * weights.form +
    marketScore * weights.market + newsScore * weights.news,
    0.05, 0.95
  )

  const baseHomeGoals = Math.max(0.2, (i.homeXg + i.awayXga) / 2)
  const baseAwayGoals = Math.max(0.2, (i.awayXg + i.homeXga) / 2)
  const totalGoals = clamp(baseHomeGoals + baseAwayGoals, 1, 6)

  const lambdaHome = clamp(totalGoals * hs, 0.15, 5)
  const lambdaAway = clamp(totalGoals * (1 - hs), 0.15, 5)

  const { probabilities, exactScores } = simulateMatch(lambdaHome, lambdaAway)

  const decisiveness = Math.max(probabilities.home, probabilities.draw, probabilities.away) - 1 / 3
  const totalInjury = i.homeInjuryImpact + i.awayInjuryImpact
  const confidenceScore = clamp(60 + decisiveness * 90 - totalInjury * 0.5, 40, 95)

  return {
    ...probabilities,
    predictedHome: Math.round(lambdaHome),
    predictedAway: Math.round(lambdaAway),
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    exactScores,
  }
}
