/**
 * Modelo xG puro.
 * Combina xG, xGA y eficiencia de conversión para derivar ventaja relativa
 * y estimar probabilidades 1X2 sin depender de ELO ni forma reciente.
 */

import { simulateMatch, type Probabilities, type ExactScore } from '@/lib/predictionEngine'

export interface XgInput {
  homeXg: number
  awayXg: number
  homeXga: number
  awayXga: number
  homeShotsOnTarget?: number
  awayShotsOnTarget?: number
  homeGoalsScored?: number
  awayGoalsScored?: number
}

export interface XgResult {
  probabilities: Probabilities
  exactScores: ExactScore[]
  xgAdvantage: number   // 0..1, ventaja local por xG
  lambdaHome: number
  lambdaAway: number
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

export function xgPredict(input: XgInput): XgResult {
  const attack   = input.homeXg  / Math.max(input.homeXg  + input.awayXg,  0.01)
  const defense  = input.awayXga / Math.max(input.homeXga + input.awayXga, 0.01)

  const homeConv = (input.homeGoalsScored ?? input.homeXg) / Math.max(input.homeShotsOnTarget ?? 4, 1)
  const awayConv = (input.awayGoalsScored ?? input.awayXg) / Math.max(input.awayShotsOnTarget ?? 4, 1)
  const conversion = homeConv / Math.max(homeConv + awayConv, 0.01)

  const xgAdvantage = clamp((attack + defense + conversion) / 3, 0.05, 0.95)

  const totalGoals   = clamp((input.homeXg + input.awayXga) / 2 + (input.awayXg + input.homeXga) / 2, 1, 6)
  const lambdaHome   = clamp(totalGoals * xgAdvantage, 0.15, 5)
  const lambdaAway   = clamp(totalGoals * (1 - xgAdvantage), 0.15, 5)

  const { probabilities, exactScores } = simulateMatch(lambdaHome, lambdaAway)

  return { probabilities, exactScores, xgAdvantage, lambdaHome, lambdaAway }
}

export const MODEL_NAME = 'xg'
export const MODEL_VERSION = '1.0.0'
