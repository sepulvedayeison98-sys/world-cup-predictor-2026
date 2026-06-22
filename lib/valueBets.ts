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

// ─── Smart Bets AI ───────────────────────────────────────────────────────────

export type SmartBetTier = 'premium' | 'muy_fuerte' | 'fuerte' | 'moderada'

/** Clasifica una apuesta en uno de los 4 niveles de confianza del sistema AI. */
export function getSmartBetTier(vb: {
  grade: ValueBetGrade
  expected_value: number
  edge: number
  odds_value: number
}): SmartBetTier {
  const strong = isStrongValueBet({ expected_value: vb.expected_value, edge: vb.edge, odds_value: vb.odds_value, grade: vb.grade })
  if (vb.grade === 'high' && strong) return 'premium'
  if (vb.grade === 'high')           return 'muy_fuerte'
  if (vb.grade === 'medium' && vb.edge >= 0.06) return 'fuerte'
  return 'moderada'
}

const MARKET_LABEL_ES: Record<OddsMarket, string> = {
  home_win:           'Victoria Local',
  draw:               'Empate',
  away_win:           'Victoria Visitante',
  over_0_5:           'Más de 0.5 goles',
  over_1_5:           'Más de 1.5 goles',
  over_2_5:           'Más de 2.5 goles',
  over_3_5:           'Más de 3.5 goles',
  btts_yes:           'Ambos marcan: Sí',
  btts_no:            'Ambos marcan: No',
  clean_sheet_home:   'Portería a 0 Local',
  clean_sheet_away:   'Portería a 0 Visitante',
}

export function getMarketLabel(market: OddsMarket): string {
  return MARKET_LABEL_ES[market] ?? market
}

interface JustificationInput {
  market: OddsMarket
  grade: ValueBetGrade
  expected_value: number
  edge: number
  model_probability: number
  implied_probability: number
  odds_value: number
  prediction: any
  homeStats: any
  awayStats: any
  homeTeam: any
  awayTeam: any
}

/**
 * Genera justificacion textual y factores a favor/en contra para una apuesta de valor.
 * Logica determinista basada en los mismos inputs del motor de prediccion.
 */
export function generateSmartBetJustification(p: JustificationInput): {
  justification: string
  factors: { for: string[]; against: string[] }
} {
  const { market, expected_value, edge, model_probability, implied_probability, odds_value, prediction, homeStats, awayStats, homeTeam, awayTeam } = p

  const homeELO = homeTeam?.elo_rating ?? 1500
  const awayELO = awayTeam?.elo_rating ?? 1500
  const eloDiff = homeELO - awayELO

  const homeXG  = homeStats?.avg_xg ?? 1.0
  const awayXG  = awayStats?.avg_xg ?? 1.0
  const homeXGA = homeStats?.avg_xga ?? 1.0
  const awayXGA = awayStats?.avg_xga ?? 1.0
  const homeGoals   = homeStats?.avg_goals_scored   ?? 1.0
  const awayGoals   = awayStats?.avg_goals_scored   ?? 1.0
  const homeConceded = homeStats?.avg_goals_conceded ?? 1.0
  const awayConceded = awayStats?.avg_goals_conceded ?? 1.0

  const confidenceScore = prediction?.confidence_score ?? 50
  const predHome = prediction?.predicted_home_score ?? 1
  const predAway = prediction?.predicted_away_score ?? 1
  const totalPredGoals = predHome + predAway

  const homeName = homeTeam?.short_name ?? homeTeam?.name ?? 'Local'
  const awayName = awayTeam?.short_name ?? awayTeam?.name ?? 'Visitante'

  const modelPct   = (model_probability * 100).toFixed(1)
  const impliedPct = (implied_probability * 100).toFixed(1)
  const evPct      = (expected_value * 100).toFixed(1)
  const edgePct    = (edge * 100).toFixed(1)

  const factorsFor: string[]     = []
  const factorsAgainst: string[] = []

  factorsFor.push(`Brecha de valor: +${evPct}% sobre la cuota implícita`)

  let justification = ''

  switch (market) {
    case 'home_win': {
      justification = `El modelo asigna ${modelPct}% de probabilidad al triunfo local frente al ${impliedPct}% que refleja el mercado, generando una brecha de +${edgePct}%.`
      if (eloDiff > 100) factorsFor.push(`Ventaja ELO de +${eloDiff} puntos (${homeName} dominante)`)
      else if (eloDiff > 40) factorsFor.push(`Ligera superioridad ELO (+${eloDiff} pts)`)
      if (homeXG > awayXGA * 1.2) factorsFor.push(`xG atacante superior a xGA rival (${homeXG.toFixed(2)} vs ${awayXGA.toFixed(2)})`)
      if (homeGoals > 1.5) factorsFor.push(`${homeName} anota ${homeGoals.toFixed(1)} goles/partido de media`)
      if (awayConceded > 1.2) factorsFor.push(`${awayName} concede ${awayConceded.toFixed(1)} goles/partido`)
      if (Math.abs(eloDiff) < 50) factorsAgainst.push('Equipos de nivel ELO similar (resultado abierto)')
      if (awayXG > 1.4) factorsAgainst.push(`${awayName} genera ${awayXG.toFixed(2)} xG/partido — amenaza real`)
      if (confidenceScore < 65) factorsAgainst.push(`Confianza del modelo moderada (${confidenceScore}/100)`)
      break
    }
    case 'away_win': {
      justification = `El modelo estima ${modelPct}% para el triunfo visitante frente al ${impliedPct}% del mercado, detectando valor de +${edgePct}%.`
      if (eloDiff < -100) factorsFor.push(`Ventaja ELO visitante de ${Math.abs(eloDiff)} puntos`)
      else if (eloDiff < -40) factorsFor.push(`Ligera superioridad ELO del visitante (+${Math.abs(eloDiff)} pts)`)
      if (awayXG > homeXGA * 1.2) factorsFor.push(`xG visitante supera la xGA local (${awayXG.toFixed(2)} vs ${homeXGA.toFixed(2)})`)
      if (awayGoals > 1.5) factorsFor.push(`${awayName} promedia ${awayGoals.toFixed(1)} goles/partido`)
      if (homeConceded > 1.2) factorsFor.push(`${homeName} concede ${homeConceded.toFixed(1)} goles/partido`)
      if (Math.abs(eloDiff) < 50) factorsAgainst.push('ELO equilibrado — ventaja de local compensa')
      if (homeXG > 1.4) factorsAgainst.push(`${homeName} genera ${homeXG.toFixed(2)} xG/partido en casa`)
      if (confidenceScore < 65) factorsAgainst.push(`Confianza moderada del modelo (${confidenceScore}/100)`)
      break
    }
    case 'draw': {
      justification = `El mercado infravalora el empate: modelo calcula ${modelPct}% vs ${impliedPct}% implícitos. Diferencia de +${edgePct}%.`
      if (Math.abs(eloDiff) < 60) factorsFor.push(`ELO muy equilibrado (diferencia de ${Math.abs(eloDiff)} pts)`)
      if (Math.abs(homeXG - awayXG) < 0.3) factorsFor.push(`xG similares (${homeXG.toFixed(2)} vs ${awayXG.toFixed(2)}) — partido parejo`)
      if (homeGoals < 1.3 && awayGoals < 1.3) factorsFor.push('Baja producción ofensiva de ambos favorece empate')
      if (Math.abs(eloDiff) > 120) factorsAgainst.push(`Gran diferencia ELO (${Math.abs(eloDiff)} pts) favorece resultado decisivo`)
      if (confidenceScore < 60) factorsAgainst.push(`Modelo con incertidumbre (${confidenceScore}/100)`)
      break
    }
    case 'over_0_5':
    case 'over_1_5':
    case 'over_2_5':
    case 'over_3_5': {
      const threshold = market === 'over_0_5' ? 0.5 : market === 'over_1_5' ? 1.5 : market === 'over_2_5' ? 2.5 : 3.5
      justification = `El motor proyecta ${totalPredGoals.toFixed(1)} goles totales (${predHome}-${predAway}). El mercado cotiza @${odds_value.toFixed(2)}, mientras el modelo asigna ${modelPct}% a superar ${threshold} goles.`
      const totalXG = homeXG + awayXG
      if (totalXG > 2.8) factorsFor.push(`Alta producción ofensiva combinada (xG total: ${totalXG.toFixed(2)})`)
      if (homeGoals + awayGoals > 2.8) factorsFor.push(`Media de goles combinada: ${(homeGoals + awayGoals).toFixed(1)}/partido`)
      if (homeXGA > 1.2) factorsFor.push(`Defensa local permeable (xGA: ${homeXGA.toFixed(2)})`)
      if (awayXGA > 1.2) factorsFor.push(`Defensa visitante permeable (xGA: ${awayXGA.toFixed(2)})`)
      if (homeGoals < 1.0) factorsAgainst.push(`${homeName} anota poco (${homeGoals.toFixed(1)} goles/partido)`)
      if (awayGoals < 1.0) factorsAgainst.push(`${awayName} anota poco (${awayGoals.toFixed(1)} goles/partido)`)
      if (homeXGA < 0.8 && awayXGA < 0.8) factorsAgainst.push('Ambas defensas sólidas — techo de goles bajo')
      break
    }
    case 'btts_yes': {
      justification = `Modelo estima ${modelPct}% de probabilidad de que ambos equipos anoten. El mercado lo cotiza a ${odds_value.toFixed(2)} (${impliedPct}%).`
      if (homeGoals > 1.2) factorsFor.push(`${homeName} anota en la mayoría de partidos (${homeGoals.toFixed(1)}/p)`)
      if (awayGoals > 1.2) factorsFor.push(`${awayName} también suele marcar (${awayGoals.toFixed(1)}/p)`)
      if (homeXGA > 1.0) factorsFor.push(`${homeName} encaja con frecuencia (xGA: ${homeXGA.toFixed(2)})`)
      if (awayXGA > 1.0) factorsFor.push(`${awayName} también concede (xGA: ${awayXGA.toFixed(2)})`)
      const lowScorer = homeGoals < awayGoals ? homeName : awayName
      const lowGoals  = Math.min(homeGoals, awayGoals)
      if (lowGoals < 0.8) factorsAgainst.push(`${lowScorer} tiene baja producción ofensiva (${lowGoals.toFixed(1)}/p)`)
      break
    }
    case 'btts_no': {
      justification = `El modelo calcula ${modelPct}% de que al menos un equipo no anote, frente al ${impliedPct}% del mercado.`
      if (homeGoals < 1.0) factorsFor.push(`${homeName} tiene producción ofensiva limitada`)
      if (awayGoals < 1.0) factorsFor.push(`${awayName} raramente marca de visitante`)
      if (homeXGA < 0.8) factorsFor.push(`${homeName} mantiene su portería con regularidad`)
      if (awayXGA < 0.8) factorsFor.push(`${awayName} concede muy poco`)
      if (homeGoals > 1.5 && awayGoals > 1.5) factorsAgainst.push('Ambos equipos son consistentemente goleadores')
      break
    }
    case 'clean_sheet_home': {
      justification = `El modelo asigna ${modelPct}% a la portería a 0 del local vs el ${impliedPct}% del mercado, brecha de +${edgePct}%.`
      if (homeXGA < 0.8) factorsFor.push(`Defensa local muy sólida (xGA: ${homeXGA.toFixed(2)})`)
      if (awayXG < 0.9)  factorsFor.push(`Ataque visitante limitado (xG: ${awayXG.toFixed(2)})`)
      if (homeConceded < 0.8) factorsFor.push(`${homeName} concede solo ${homeConceded.toFixed(1)} goles/partido`)
      if (awayXG > 1.3) factorsAgainst.push(`${awayName} genera ${awayXG.toFixed(2)} xG/partido — amenaza real`)
      if (awayGoals > 1.4) factorsAgainst.push(`${awayName} promedia ${awayGoals.toFixed(1)} goles/partido`)
      break
    }
    case 'clean_sheet_away': {
      justification = `El modelo estima ${modelPct}% de que el visitante mantenga la portería a 0, frente al ${impliedPct}% implícito.`
      if (awayXGA < 0.8) factorsFor.push(`Defensa visitante compacta (xGA: ${awayXGA.toFixed(2)})`)
      if (homeXG < 0.9)  factorsFor.push(`Ataque local limitado (xG: ${homeXG.toFixed(2)})`)
      if (awayConceded < 0.8) factorsFor.push(`${awayName} concede solo ${awayConceded.toFixed(1)} goles/partido`)
      if (homeXG > 1.3) factorsAgainst.push(`${homeName} genera ${homeXG.toFixed(2)} xG/partido en casa`)
      if (homeGoals > 1.4) factorsAgainst.push(`${homeName} promedia ${homeGoals.toFixed(1)} goles de local`)
      break
    }
  }

  if (confidenceScore >= 80) factorsFor.push(`Alta confianza del motor (${confidenceScore}/100)`)
  else if (confidenceScore < 55) factorsAgainst.push(`Incertidumbre elevada del motor (${confidenceScore}/100)`)

  return {
    justification,
    factors: {
      for:     factorsFor.slice(0, 4),
      against: factorsAgainst.slice(0, 3),
    },
  }
}
