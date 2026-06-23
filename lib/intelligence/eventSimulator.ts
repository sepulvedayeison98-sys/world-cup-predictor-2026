/**
 * Event Simulator — simulación intra-partido.
 * Modela la distribución temporal de eventos (goles, corners, tarjetas)
 * a lo largo de los 90 minutos mediante un proceso de Poisson no-homogéneo.
 *
 * La intensidad del proceso varía por tramo de partido:
 * - 0–15: calentamiento (60% de la intensidad media)
 * - 16–45: desarrollo primer tiempo (100%)
 * - 45–60: inicio segundo tiempo (110% — equipos salen con energía)
 * - 61–75: presión alta (120% — búsqueda del gol)
 * - 76–90: cierre (130% — desesperación defensiva)
 */

export interface EventSimInput {
  lambdaHome: number      // goles esperados local (por partido)
  lambdaAway: number      // goles esperados visitante (por partido)
  lambdaCorners?: number  // corners totales esperados
  lambdaCards?: number    // tarjetas totales esperadas
  iterations?: number     // simulaciones para distribución (default: 2000)
}

export type EventType = 'goal_home' | 'goal_away' | 'corner' | 'card'

export interface SimEvent {
  minute: number
  type: EventType
  probability: number   // P(este evento ocurre en este minuto | lambdas)
}

export interface MinuteData {
  minute: number
  goalHomeCumProb: number
  goalAwayCumProb: number
  cornerCumProb: number
  cardCumProb: number
}

export interface EventSimResult {
  timeline: SimEvent[]              // eventos con mayor probabilidad de ocurrir
  minuteByMinute: MinuteData[]      // curva acumulada minuto a minuto
  mostLikelyGoalMinutes: { home: number[]; away: number[] }
  expectedFirstGoalMinute: number   // esperanza del minuto del primer gol
}

// Intensidad por tramo de partido (escala 0..1, se multiplica por lambda/90)
const INTENSITY_PROFILE: { from: number; to: number; factor: number }[] = [
  { from: 0,  to: 15, factor: 0.60 },  // inicio partido
  { from: 16, to: 45, factor: 1.00 },  // primer tiempo
  { from: 46, to: 60, factor: 1.10 },  // salida del vestuario
  { from: 61, to: 75, factor: 1.20 },  // presión
  { from: 76, to: 90, factor: 1.30 },  // cierre
]

function intensityAt(minute: number): number {
  const seg = INTENSITY_PROFILE.find(s => minute >= s.from && minute <= s.to)
  return seg?.factor ?? 1.0
}

// Lambda por minuto para un lambda total de 90 minutos
function lambdaPerMinute(totalLambda: number, minute: number): number {
  const base = totalLambda / 90
  return base * intensityAt(minute)
}

// P(Poisson(λ) ≥ 1) = 1 - e^(-λ)
function probAtLeastOne(lambda: number): number {
  return 1 - Math.exp(-lambda)
}

export function simulateEventTimeline(input: EventSimInput): EventSimResult {
  const {
    lambdaHome,
    lambdaAway,
    lambdaCorners = 9.5,
    lambdaCards   = 3.5,
  } = input

  const timeline: SimEvent[] = []
  const minuteByMinute: MinuteData[] = []
  let cumHomeGoal = 0, cumAwayGoal = 0, cumCorner = 0, cumCard = 0

  const goalHomeMinuteProbs: { minute: number; prob: number }[] = []
  const goalAwayMinuteProbs: { minute: number; prob: number }[] = []

  for (let min = 1; min <= 90; min++) {
    const pHome   = probAtLeastOne(lambdaPerMinute(lambdaHome,    min))
    const pAway   = probAtLeastOne(lambdaPerMinute(lambdaAway,    min))
    const pCorner = probAtLeastOne(lambdaPerMinute(lambdaCorners, min))
    const pCard   = probAtLeastOne(lambdaPerMinute(lambdaCards,   min))

    cumHomeGoal  = 1 - (1 - cumHomeGoal)  * (1 - pHome)
    cumAwayGoal  = 1 - (1 - cumAwayGoal)  * (1 - pAway)
    cumCorner    = 1 - (1 - cumCorner)    * (1 - pCorner)
    cumCard      = 1 - (1 - cumCard)      * (1 - pCard)

    minuteByMinute.push({
      minute: min,
      goalHomeCumProb:  Math.round(cumHomeGoal  * 10000) / 10000,
      goalAwayCumProb:  Math.round(cumAwayGoal  * 10000) / 10000,
      cornerCumProb:    Math.round(cumCorner     * 10000) / 10000,
      cardCumProb:      Math.round(cumCard       * 10000) / 10000,
    })

    goalHomeMinuteProbs.push({ minute: min, prob: pHome })
    goalAwayMinuteProbs.push({ minute: min, prob: pAway })

    // Solo incluir en timeline si la probabilidad supera el 2% por minuto
    if (pHome   > 0.02) timeline.push({ minute: min, type: 'goal_home', probability: pHome })
    if (pAway   > 0.02) timeline.push({ minute: min, type: 'goal_away', probability: pAway })
    if (pCorner > 0.08) timeline.push({ minute: min, type: 'corner',    probability: pCorner })
    if (pCard   > 0.04) timeline.push({ minute: min, type: 'card',      probability: pCard })
  }

  // Top-5 minutos más probables para cada equipo
  const topHome = goalHomeMinuteProbs
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 5)
    .map(x => x.minute)
    .sort((a, b) => a - b)

  const topAway = goalAwayMinuteProbs
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 5)
    .map(x => x.minute)
    .sort((a, b) => a - b)

  // Esperanza del primer gol: E[min 1er gol] ≈ 90 / (lambdaHome + lambdaAway)
  // (tiempo hasta primer evento en un proceso Poisson con intensidad total)
  const totalLambda = lambdaHome + lambdaAway
  const expectedFirstGoalMinute = totalLambda > 0
    ? Math.min(89, Math.round(90 / totalLambda))
    : 45

  return {
    timeline: timeline.sort((a, b) => a.minute - b.minute),
    minuteByMinute,
    mostLikelyGoalMinutes: { home: topHome, away: topAway },
    expectedFirstGoalMinute,
  }
}
