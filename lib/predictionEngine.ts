/**
 * Motor de prediccion (logica pura, sin Supabase).
 * Replica la del endpoint app/api/predictions/route.ts y agrega la mezcla
 * con el mercado (de-vig de cuotas + blend) para la calibracion.
 */

export interface Weights {
  form: number; squadQuality: number; playerStatus: number; advancedStats: number
  tactical: number; elo: number; odds: number; motivation: number; external: number; h2h: number
}

export const DEFAULT_WEIGHTS: Weights = {
  form: 0.20, squadQuality: 0.15, playerStatus: 0.15, advancedStats: 0.15,
  tactical: 0.10, elo: 0.10, odds: 0.05, motivation: 0.05, external: 0.03, h2h: 0.02,
}

export interface ModelInput {
  homeElo: number; awayElo: number
  homeForm: string[]; awayForm: string[]
  homeXg: number; awayXg: number
  homeGoals: number; awayGoals: number
  homeInjuryImpact: number; awayInjuryImpact: number
}

export interface Probabilities { home: number; draw: number; away: number }

export interface ModelResult extends Probabilities {
  predictedHome: number; predictedAway: number; confidenceScore: number
}

export function normalizeELO(homeELO: number, awayELO: number): number {
  return 1 / (1 + Math.pow(10, -(homeELO - awayELO) / 400))
}

export function formToScore(form: string[]): number {
  if (!form?.length) return 0.5
  const recent = form.slice(-5)
  return recent.reduce((s, r) => s + (r === 'W' ? 1 : r === 'D' ? 0.5 : 0), 0) / recent.length
}

function xGToAdvantage(homeXG: number, awayXG: number): number {
  const total = homeXG + awayXG || 1
  return homeXG / total
}

export function computeConfidenceLevel(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 85) return 5
  if (score >= 75) return 4
  if (score >= 65) return 3
  if (score >= 55) return 2
  return 1
}

/** Probabilidad "modelo" (sin mercado): ELO + forma + xG + lesiones. */
export function computeModelPrediction(i: ModelInput, weights: Weights = DEFAULT_WEIGHTS): ModelResult {
  const normElo = normalizeELO(i.homeElo, i.awayElo)
  const inputs = {
    form: formToScore(i.homeForm) - formToScore(i.awayForm) + 0.5,
    squadQuality: normElo,
    playerStatus: Math.max(0.1, 1 - i.homeInjuryImpact / 50) - Math.max(0, 1 - i.awayInjuryImpact / 50) + 0.5,
    advancedStats: xGToAdvantage(i.homeXg, i.awayXg),
    tactical: 0.5, elo: normElo, odds: 0.5, motivation: 0.5, external: 0.5, h2h: 0.5,
  }
  const hs = Math.min(0.95, Math.max(0.05,
    inputs.form * weights.form + inputs.squadQuality * weights.squadQuality +
    inputs.playerStatus * weights.playerStatus + inputs.advancedStats * weights.advancedStats +
    inputs.tactical * weights.tactical + inputs.elo * weights.elo + inputs.odds * weights.odds +
    inputs.motivation * weights.motivation + inputs.external * weights.external + inputs.h2h * weights.h2h
  ))
  const drawBase = Math.max(0.04, 0.22 * (1 - Math.abs(hs - 0.5) * 1.8))
  const home = Math.round(hs * (1 - drawBase) * 10000) / 10000
  const draw = Math.round(drawBase * 10000) / 10000
  const away = Math.round((1 - home - draw) * 10000) / 10000

  return finalizeResult({ home, draw, away }, i.homeGoals, i.awayGoals, i.homeInjuryImpact + i.awayInjuryImpact)
}

/** Quita el margen de la casa de las cuotas 1X2 -> probabilidades de mercado. */
export function devigMarket(oddsHome: number, oddsDraw: number, oddsAway: number): Probabilities | null {
  if (!(oddsHome > 1 && oddsDraw > 1 && oddsAway > 1)) return null
  const ih = 1 / oddsHome, id = 1 / oddsDraw, ia = 1 / oddsAway
  const sum = ih + id + ia
  if (sum <= 0) return null
  return { home: ih / sum, draw: id / sum, away: ia / sum }
}

/** Mezcla modelo y mercado: alpha = peso del mercado (0..1). */
export function blend(model: Probabilities, market: Probabilities, alpha: number): Probabilities {
  const home = (1 - alpha) * model.home + alpha * market.home
  const draw = (1 - alpha) * model.draw + alpha * market.draw
  const away = (1 - alpha) * model.away + alpha * market.away
  const sum = home + draw + away || 1
  const h = Math.round((home / sum) * 10000) / 10000
  const d = Math.round((draw / sum) * 10000) / 10000
  return { home: h, draw: d, away: Math.round((1 - h - d) * 10000) / 10000 }
}

/** Recalcula marcador previsto y confianza a partir de probabilidades dadas. */
export function finalizeResult(
  p: Probabilities, homeGoals: number, awayGoals: number, totalInjuryImpact = 0,
): ModelResult {
  const predictedHome = Math.round(Math.max(0, homeGoals) * (p.home + p.draw * 0.5))
  const predictedAway = Math.round(Math.max(0, awayGoals) * (p.away + p.draw * 0.5))
  const decisiveness = Math.max(p.home, p.draw, p.away) - 1 / 3
  const confidenceScore = Math.min(95, Math.max(40, 60 + decisiveness * 90 - totalInjuryImpact * 0.5))
  return { ...p, predictedHome, predictedAway, confidenceScore: Math.round(confidenceScore * 100) / 100 }
}

/** Top-10 marcadores exactos a partir de probabilidades + marcador previsto. */
export function generateExactScores(
  homeWin: number, draw: number, awayWin: number, predHome: number, predAway: number,
): { home: number; away: number; prob: number }[] {
  const candidates: { home: number; away: number; prob: number }[] = []
  for (let h = Math.max(1, predHome - 1); h <= predHome + 2; h++)
    for (let a = 0; a < h; a++)
      candidates.push({ home: h, away: a, prob: homeWin * Math.pow(0.55, Math.abs(h - predHome) + Math.abs(a - predAway)) })
  for (let g = 0; g <= 3; g++)
    candidates.push({ home: g, away: g, prob: draw * (g === 1 ? 0.45 : g === 0 ? 0.35 : g === 2 ? 0.15 : 0.05) })
  for (let a = Math.max(1, predAway - 1); a <= predAway + 2; a++)
    for (let h = 0; h < a; h++)
      candidates.push({ home: h, away: a, prob: awayWin * Math.pow(0.55, Math.abs(h - predHome) + Math.abs(a - predAway)) })

  const total = candidates.reduce((s, c) => s + c.prob, 0) || 1
  return candidates
    .map(c => ({ ...c, prob: Math.round((c.prob / total) * 10000) / 10000 }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 10)
}
