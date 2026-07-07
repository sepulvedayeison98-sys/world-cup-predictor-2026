import { simulateMatch, type ExactScore } from './predictionEngine'

/**
 * Motor de escenarios "qué pasaría si" del simulador (/simulation).
 * Extraído de components/simulation/SimulationEngine.tsx (auditoría:
 * duplicaba lógica y fabricaba marcadores a mano). Ahora los marcadores
 * y las probabilidades salen de la MISMA rejilla de Poisson del motor
 * oficial (simulateMatch), garantizando coherencia con el resto de la app.
 */

export interface SimScenario {
  home_injuries: string[]
  away_injuries: string[]
  home_suspensions: string[]
  away_suspensions: string[]
  weather: string
  home_formation: string
  away_formation: string
  scenario_name: string
}

export interface SimResult {
  home_win_probability: number
  draw_probability: number
  away_win_probability: number
  predicted_home_score: number
  predicted_away_score: number
  confidence_score: number
  delta: { home: number; draw: number; away: number }
  top_scorelines: ExactScore[]
}

const WEATHER_PENALTY: Record<string, number> = {
  Clear: 0, Cloudy: 0.02, Rain: 0.05, HeavyRain: 0.09,
  Wind: 0.06, Extreme: 0.15,
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

export function applyScenario(
  basePrediction: any,
  scenario: SimScenario,
  homeTeam: any,
  awayTeam: any,
  activeInjuries: any[],
): SimResult {
  if (!basePrediction) {
    return {
      home_win_probability: 0.33,
      draw_probability: 0.34,
      away_win_probability: 0.33,
      predicted_home_score: 1,
      predicted_away_score: 1,
      confidence_score: 40,
      delta: { home: 0, draw: 0, away: 0 },
      top_scorelines: [],
    }
  }

  let homeAdj = 1.0
  let awayAdj = 1.0

  // Lesiones simuladas: cada una resta fuerza según su impact_score
  for (const pid of scenario.home_injuries) {
    const existing = activeInjuries.find(i => i.player_id === pid)
    homeAdj -= ((existing?.impact_score ?? 6.0) / 10) * 0.12
  }
  for (const pid of scenario.away_injuries) {
    const existing = activeInjuries.find(i => i.player_id === pid)
    awayAdj -= ((existing?.impact_score ?? 6.0) / 10) * 0.12
  }

  // Suspensiones: penalización plana
  homeAdj -= scenario.home_suspensions.length * 0.08
  awayAdj -= scenario.away_suspensions.length * 0.08

  // Clima: castiga más al equipo de mayor calidad (disrupción de estilo)
  const weatherImpact = WEATHER_PENALTY[scenario.weather] ?? 0
  if (homeTeam.fifa_ranking < awayTeam.fifa_ranking) {
    homeAdj -= weatherImpact * 0.6
  } else {
    awayAdj -= weatherImpact * 0.6
  }

  homeAdj = clamp(homeAdj, 0.5, 1.2)
  awayAdj = clamp(awayAdj, 0.5, 1.2)

  // Fuerzas ajustadas → lambdas → rejilla de Poisson del motor oficial.
  // El total de goles baja con mal clima (partidos trabados).
  const hw0 = basePrediction.home_win_probability ?? 0.4
  const aw0 = basePrediction.away_win_probability ?? 0.3
  const hs = clamp((hw0 * homeAdj) / Math.max(hw0 * homeAdj + aw0 * awayAdj, 1e-6), 0.2, 0.8)
  const baseTotal = clamp(
    (basePrediction.predicted_home_score ?? 1) + (basePrediction.predicted_away_score ?? 1) || 2.4,
    1.6, 4.2,
  )
  const total = baseTotal * (1 - weatherImpact * 0.5)

  const { probabilities, exactScores } = simulateMatch(
    clamp(total * hs, 0.15, 5),
    clamp(total * (1 - hs), 0.15, 5),
  )

  // La confianza cae con cada modificación al escenario base
  const mods = scenario.home_injuries.length + scenario.away_injuries.length +
               scenario.home_suspensions.length + scenario.away_suspensions.length
  const confidence = Math.max(30, (basePrediction.confidence_score ?? 60) - mods * 5)

  return {
    home_win_probability: probabilities.home,
    draw_probability: probabilities.draw,
    away_win_probability: probabilities.away,
    predicted_home_score: exactScores[0]?.home ?? 1,
    predicted_away_score: exactScores[0]?.away ?? 1,
    confidence_score: confidence,
    delta: {
      home: probabilities.home - (basePrediction.home_win_probability ?? 0),
      draw: probabilities.draw - (basePrediction.draw_probability ?? 0),
      away: probabilities.away - (basePrediction.away_win_probability ?? 0),
    },
    top_scorelines: exactScores.slice(0, 6),
  }
}
