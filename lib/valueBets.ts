/**
 * Logica pura de value bets: probabilidad del modelo por mercado, valor
 * esperado (EV), grado y fraccion de Kelly. Compartida entre la ruta
 * /api/odds y el sync de cuotas (services/sync/odds.ts).
 */

export type OddsMarket =
  | 'home_win' | 'draw' | 'away_win'
  | 'over_0_5' | 'over_1_5' | 'over_2_5' | 'over_3_5'
  | 'btts_yes' | 'btts_no'
  | 'clean_sheet_home' | 'clean_sheet_away'

export type ValueBetGrade = 'high' | 'medium' | 'low' | 'none'

export function gradeEV(ev: number): ValueBetGrade {
  if (ev >= 0.10) return 'high'
  if (ev >= 0.04) return 'medium'
  if (ev >= 0.01) return 'low'
  return 'none'
}

/** Quarter Kelly, tope 5%. Devuelve fraccion (0..0.05). */
export function kellyFraction(modelProb: number, odds: number): number {
  const b = odds - 1
  if (b <= 0) return 0
  const q = 1 - modelProb
  const k = (modelProb * b - q) / b
  return Math.max(0, Math.min(k * 0.25, 0.05))
}

/** Probabilidad del modelo para un mercado, derivada de la prediccion. */
export function getModelProbForMarket(market: OddsMarket, prediction: any): number {
  const homeWin = prediction?.home_win_probability ?? 0.33
  const draw    = prediction?.draw_probability ?? 0.33
  const awayWin = prediction?.away_win_probability ?? 0.33
  const predH   = prediction?.predicted_home_score ?? 1
  const predA   = prediction?.predicted_away_score ?? 1
  const totalGoals = predH + predA

  switch (market) {
    case 'home_win': return homeWin
    case 'draw':     return draw
    case 'away_win': return awayWin
    case 'over_0_5': return Math.min(0.98, 0.75 + totalGoals * 0.07)
    case 'over_1_5': return Math.min(0.95, 0.50 + totalGoals * 0.12)
    case 'over_2_5': return Math.min(0.90, 0.25 + totalGoals * 0.15)
    case 'over_3_5': return Math.min(0.70, 0.05 + totalGoals * 0.12)
    case 'btts_yes': return Math.min(0.80, 0.20 + (Math.min(predH, 1) + Math.min(predA, 1)) * 0.20)
    case 'btts_no':  return 1 - Math.min(0.80, 0.20 + (Math.min(predH, 1) + Math.min(predA, 1)) * 0.20)
    case 'clean_sheet_home': return Math.max(0.10, 0.60 - predA * 0.20)
    case 'clean_sheet_away': return Math.max(0.10, 0.45 - predH * 0.18)
    default: return 0.33
  }
}

// Umbrales de calidad: evitan marcar longshots/ruido como "valor".
// Los topes superiores (MAX_EV/MAX_EDGE) descartan discrepancias absurdas
// con el mercado, que con nuestro ELO estimado son error del modelo, no valor.
export const VALUE_BET_MIN_EV = 0.05    // 5% de valor esperado minimo
export const VALUE_BET_MAX_EV = 0.25    // por encima = error del modelo, no valor real
export const VALUE_BET_MIN_EDGE = 0.03  // 3% de ventaja sobre la cuota implicita
export const VALUE_BET_MAX_EDGE = 0.15
export const VALUE_BET_MIN_ODDS = 1.3
export const VALUE_BET_MAX_ODDS = 6.0   // descarta longshots (modelo poco fiable ahi)

/** True si el value bet cae en el rango de calidad (ni ruido ni discrepancia absurda). */
export function isStrongValueBet(vb: {
  expected_value: number; edge: number; odds_value: number; grade: ValueBetGrade
}): boolean {
  return (
    vb.grade !== 'none' &&
    vb.expected_value >= VALUE_BET_MIN_EV &&
    vb.expected_value <= VALUE_BET_MAX_EV &&
    vb.edge >= VALUE_BET_MIN_EDGE &&
    vb.edge <= VALUE_BET_MAX_EDGE &&
    vb.odds_value >= VALUE_BET_MIN_ODDS &&
    vb.odds_value <= VALUE_BET_MAX_ODDS
  )
}

/** Construye un value bet completo a partir de una cuota y la prediccion. */
export function buildValueBet(
  market: OddsMarket,
  oddsValue: number,
  prediction: any,
) {
  const impliedProb = 1 / oddsValue
  const modelProb = getModelProbForMarket(market, prediction)
  const ev = modelProb * oddsValue - 1
  const edge = modelProb - impliedProb
  return {
    market,
    odds_value: oddsValue,
    implied_probability: impliedProb,
    model_probability: modelProb,
    expected_value: ev,
    edge,
    grade: gradeEV(ev),
    stake_suggestion_percent: kellyFraction(modelProb, oddsValue) * 100,
  }
}
