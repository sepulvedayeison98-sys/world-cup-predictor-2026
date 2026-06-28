/** Factores contextuales de partido compartidos por smartBetsEngine y MonteCarloPanel. */

export interface MatchContext {
  phase:      string
  isKnockout: boolean
  isBadW:     boolean
  isHot:      boolean
  goalMult:   number   // multiplicador combinado sobre lambdas de goles
  cornersF:   number   // factor de corners (lluvia aumenta)
  homeRestF:  number   // penalización por poco descanso
  awayRestF:  number
}

const KNOCKOUT_PHASES = new Set([
  'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final', 'third_place',
])

export function getMatchContext(match?: any): MatchContext {
  const phase      = match?.phase ?? 'group'
  const isKnockout = KNOCKOUT_PHASES.has(phase)
  const weather    = (match?.weather_condition ?? '').toLowerCase()
  const isBadW     = /rain|wet|storm|wind|drizzle/i.test(weather)
  const tempC      = match?.weather_temp_celsius ?? 22
  const isHot      = tempC > 32
  const homeRest   = match?.home_rest_days ?? 7
  const awayRest   = match?.away_rest_days ?? 7

  const goalMult  = (isKnockout ? 0.92 : 1.0) * (isBadW ? 0.97 : 1.0) * (isHot ? 0.97 : 1.0)
  const cornersF  = isBadW ? 1.04 : 1.0
  const homeRestF = homeRest < 3 ? 0.95 : homeRest > 7 ? 1.02 : 1.0
  const awayRestF = awayRest < 3 ? 0.95 : awayRest > 7 ? 1.02 : 1.0

  return { phase, isKnockout, isBadW, isHot, goalMult, cornersF, homeRestF, awayRestF }
}
