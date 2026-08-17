/**
 * Motor de predicción para ligas de clubes (Fase 4).
 *
 * Modelo: fuerzas de ataque/defensa por equipo (promedios móviles con
 * encogimiento hacia la media de la liga) + inclinación por ELO, sobre
 * la MISMA rejilla Poisson + Dixon-Coles del motor del Mundial
 * (simulateMatch). Sin datos inventados: todo sale de resultados reales.
 *
 * El backtest es walk-forward (honesto): cada partido se predice SOLO
 * con la información disponible antes de jugarse, y después el resultado
 * actualiza ELO y promedios. Los primeros partidos de cada equipo
 * (calentamiento) no se evalúan.
 *
 * Módulo puro sin I/O — ver tests/leagues.test.ts.
 */
import { simulateMatch } from './predictionEngine'

// ─── Parámetros del modelo ───────────────────────────────────────────────────

export const LEAGUE_ELO_BASE = 1500
export const LEAGUE_ELO_K = 20
export const LEAGUE_ELO_HOME_ADV = 60 // puntos ELO de ventaja de local
export const LEAGUE_WARMUP_MATCHES = 5 // partidos mínimos por equipo antes de evaluar
const ROLLING_WINDOW = 10
const SHRINK_PRIOR = 5 // nº de partidos "virtuales" en la media de la liga
// Priors de goles por partido (ligas top europeas)
const PRIOR_HOME_GOALS = 1.5
const PRIOR_AWAY_GOALS = 1.2

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface LeagueEngineMatch {
  id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  status: string
  kickoff_time: string
}

export type Outcome = 'home' | 'draw' | 'away'

export interface LeagueMatchPrediction {
  match_id: string
  home_win_probability: number
  draw_probability: number
  away_win_probability: number
  predicted_home_score: number
  predicted_away_score: number
  confidence_score: number // 0-100 (probabilidad del pick)
  pick: Outcome
  actual: Outcome
  correct: boolean
  /** Partidos jugados de cada equipo AL MOMENTO de esta predicción (antes de
   *  este partido). Sirve para aislar el arranque en frío (min < calentamiento)
   *  en un análisis posterior — el backtest normal ni siquiera llega a
   *  generar estas filas, min_played siempre es >= al calentamiento usado. */
  home_played: number
  away_played: number
}

export interface TeamSeasonAggregate {
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  clean_sheets: number
  form: ('W' | 'D' | 'L')[] // últimos 5, más reciente al final
  elo: number
}

export interface LeagueBacktestMetrics {
  evaluated: number
  skipped: number // calentamiento
  correct: number
  accuracy: number // aciertos 1X2 del pick
  brier: number // multiclase, 0 (perfecto) … 2; azar ≈ 0.667
  log_loss: number // -ln(p del resultado real); azar ≈ 1.099
}

/** Predicción pre-partido de un encuentro aún no jugado. */
export interface UpcomingPrediction {
  match_id: string
  home_win_probability: number
  draw_probability: number
  away_win_probability: number
  predicted_home_score: number
  predicted_away_score: number
  confidence_score: number
  pick: Outcome
}

export interface LeagueBacktestResult {
  finalElo: Map<string, number>
  teamSeason: Map<string, TeamSeasonAggregate>
  predictions: LeagueMatchPrediction[]
  /**
   * Predicciones para partidos programados/en vivo, con el estado del
   * modelo al final de los partidos ya jugados. En pretemporada (0
   * partidos) el encogimiento las lleva a la media de la liga — honesto:
   * el modelo aún no sabe nada de los equipos.
   */
  upcoming: UpcomingPrediction[]
  metrics: LeagueBacktestMetrics
}

// ─── Estado interno por equipo ───────────────────────────────────────────────

interface TeamState extends TeamSeasonAggregate {
  gfHist: number[] // goles a favor, cronológico
  gaHist: number[]
}

function newTeamState(elo = LEAGUE_ELO_BASE): TeamState {
  return {
    played: 0, won: 0, drawn: 0, lost: 0,
    goals_for: 0, goals_against: 0, clean_sheets: 0,
    form: [], elo, gfHist: [], gaHist: [],
  }
}

/**
 * Encogimiento del ELO heredado de la temporada anterior hacia la media.
 * Una campaña nueva no empieza donde terminó la anterior —hay fichajes,
 * cambios de entrenador y un verano de por medio— pero tampoco empieza de
 * cero: el Bayern sigue siendo el Bayern en la jornada 1.
 *
 * ⚠️ NO ESTÁ EN PRODUCCIÓN — experimento RECHAZADO (2026-08-17).
 *
 * Medido por ablación pareada sobre Liga BetPlay 2024 → 2026 (168 partidos
 * evaluados, 18 de 20 equipos con ELO heredable), con regla de promoción
 * declarada antes de correr el experimento:
 *
 *   base (todos en 1500)   precisión 48,21%   Brier 0,6273
 *   k=0,50                 precisión 47,02%   Brier 0,6262
 *   k=0,75 (primario)      precisión 47,62%   Brier 0,6257
 *   k=1,00                 precisión 48,21%   Brier 0,6253
 *
 * El Brier mejora con TODA la rejilla de k, y en la ventana temprana mejoran
 * las dos métricas (precisión 45,00% → 46,67%, Brier 0,6167 → 0,6119): el
 * efecto va en la dirección esperada justo donde debía. Pero la regla exigía
 * también mejorar la precisión de la temporada completa, y no lo hace. Se
 * rechaza sin regatear la regla.
 *
 * Limitaciones que invalidarían una promoción aunque hubiera pasado: una
 * sola liga, falta la temporada 2025 en medio (la herencia llega con un año
 * de desfase) y el calentamiento de 5 partidos excluye de la evaluación
 * justo los partidos donde el arranque en frío más daña.
 *
 * Queda como módulo puro —igual que lib/tennis/fatigue.ts— para cuando haya
 * un banco de pruebas decente: las temporadas europeas 2026-27, cuando se
 * jueguen, son la validación limpia que hoy no existe.
 */
export const LEAGUE_ELO_CARRYOVER = 0.75

/** ELO de arranque de temporada a partir del ELO final de la anterior. */
export function seasonSeedElo(previousElo: number, carryover = LEAGUE_ELO_CARRYOVER): number {
  return Math.round(LEAGUE_ELO_BASE + carryover * (previousElo - LEAGUE_ELO_BASE))
}

function rollingAvg(hist: number[], fallback: number): number {
  const window = hist.slice(-ROLLING_WINDOW)
  if (window.length === 0) return fallback
  return window.reduce((s, v) => s + v, 0) / window.length
}

/** Media con encogimiento: pocos partidos → pesa más el prior de la liga. */
function shrink(teamAvg: number, leagueAvg: number, played: number): number {
  return (teamAvg * played + leagueAvg * SHRINK_PRIOR) / (played + SHRINK_PRIOR)
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Probabilidad esperada de victoria local según ELO (con ventaja de local). */
export function eloExpectedHome(eloHome: number, eloAway: number): number {
  return 1 / (1 + Math.pow(10, -((eloHome + LEAGUE_ELO_HOME_ADV - eloAway) / 400)))
}

/** Multiplicador K por diferencia de goles (estándar de ELO de fútbol). */
function goalDiffMultiplier(gd: number): number {
  const d = Math.abs(gd)
  if (d <= 1) return 1
  if (d === 2) return 1.5
  return (11 + d) / 8
}

// ─── Cálculo de una predicción a partir del estado de los equipos ────────────

interface EngineProbs {
  home: number; draw: number; away: number
  predictedHome: number; predictedAway: number
  confidence: number
  pick: Outcome
}

function predictFromStates(
  home: TeamState,
  away: TeamState,
  leagueHomeAvg: number,
  leagueAwayAvg: number,
): EngineProbs {
  const leagueGoalAvg = (leagueHomeAvg + leagueAwayAvg) / 2

  // Fuerzas relativas (1.0 = equipo promedio de la liga)
  const attackH = shrink(rollingAvg(home.gfHist, leagueGoalAvg), leagueGoalAvg, home.played) / leagueGoalAvg
  const defenseH = shrink(rollingAvg(home.gaHist, leagueGoalAvg), leagueGoalAvg, home.played) / leagueGoalAvg
  const attackA = shrink(rollingAvg(away.gfHist, leagueGoalAvg), leagueGoalAvg, away.played) / leagueGoalAvg
  const defenseA = shrink(rollingAvg(away.gaHist, leagueGoalAvg), leagueGoalAvg, away.played) / leagueGoalAvg

  // Inclinación por ELO, moderada para no contar dos veces la fuerza
  const eHome = eloExpectedHome(home.elo, away.elo)
  const lambdaHome = clamp(leagueHomeAvg * attackH * defenseA * (0.85 + 0.3 * eHome), 0.2, 4)
  const lambdaAway = clamp(leagueAwayAvg * attackA * defenseH * (0.85 + 0.3 * (1 - eHome)), 0.2, 4)

  const { probabilities, exactScores } = simulateMatch(lambdaHome, lambdaAway)
  const { home: pH, draw: pD, away: pA } = probabilities
  const top = exactScores[0] ?? { home: Math.round(lambdaHome), away: Math.round(lambdaAway) }

  return {
    home: pH, draw: pD, away: pA,
    predictedHome: top.home, predictedAway: top.away,
    confidence: Math.round(Math.max(pH, pD, pA) * 1000) / 10,
    pick: pH >= pD && pH >= pA ? 'home' : pA >= pD ? 'away' : 'draw',
  }
}

// ─── Backtest walk-forward ───────────────────────────────────────────────────

export function runLeagueBacktest(
  matches: LeagueEngineMatch[],
  /**
   * ELO de arranque por equipo (temporada anterior, ya encogido). Un equipo
   * ausente del mapa —un recién ascendido— arranca en la base: no se le
   * inventa un pasado en la categoría.
   */
  seedElo?: Map<string, number>,
  /**
   * Partidos mínimos por equipo antes de EVALUAR una predicción. Con el
   * valor por defecto (LEAGUE_WARMUP_MATCHES) el comportamiento es
   * idéntico al de siempre. Bajarlo a 0 es SOLO para medir: expone el
   * arranque en frío real (partidos 1..calentamiento) que el backtest
   * normal nunca llega a puntuar — no se usa en ningún llamador de
   * producción.
   */
  minWarmup: number = LEAGUE_WARMUP_MATCHES,
): LeagueBacktestResult {
  const finished = matches
    .filter((m) => m.status === 'finished' && m.home_score !== null && m.away_score !== null)
    .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time) || a.id.localeCompare(b.id))

  const teams = new Map<string, TeamState>()
  const state = (id: string): TeamState => {
    let t = teams.get(id)
    if (!t) { t = newTeamState(seedElo?.get(id) ?? LEAGUE_ELO_BASE); teams.set(id, t) }
    return t
  }

  // Medias de la liga acumuladas hasta el momento (arrancan en el prior)
  let sumHomeGoals = 0, sumAwayGoals = 0, matchesSeen = 0

  const predictions: LeagueMatchPrediction[] = []
  let skipped = 0, correct = 0, brierSum = 0, logLossSum = 0

  for (const m of finished) {
    const home = state(m.home_team_id)
    const away = state(m.away_team_id)
    const hs = m.home_score as number
    const as = m.away_score as number
    const actual: Outcome = hs > as ? 'home' : hs < as ? 'away' : 'draw'

    // ── 1. Predicción PRE-partido (solo si ambos pasaron el calentamiento) ──
    if (home.played >= minWarmup && away.played >= minWarmup) {
      const leagueHomeAvg = matchesSeen > 0 ? sumHomeGoals / matchesSeen : PRIOR_HOME_GOALS
      const leagueAwayAvg = matchesSeen > 0 ? sumAwayGoals / matchesSeen : PRIOR_AWAY_GOALS

      const p = predictFromStates(home, away, leagueHomeAvg, leagueAwayAvg)
      const isCorrect = p.pick === actual
      const pActual = actual === 'home' ? p.home : actual === 'draw' ? p.draw : p.away
      const yH = actual === 'home' ? 1 : 0, yD = actual === 'draw' ? 1 : 0, yA = actual === 'away' ? 1 : 0

      predictions.push({
        match_id: m.id,
        home_win_probability: p.home,
        draw_probability: p.draw,
        away_win_probability: p.away,
        predicted_home_score: p.predictedHome,
        predicted_away_score: p.predictedAway,
        confidence_score: p.confidence,
        pick: p.pick, actual, correct: isCorrect,
        home_played: home.played, away_played: away.played,
      })
      if (isCorrect) correct++
      brierSum += (p.home - yH) ** 2 + (p.draw - yD) ** 2 + (p.away - yA) ** 2
      logLossSum += -Math.log(Math.max(pActual, 1e-9))
    } else {
      skipped++
    }

    // ── 2. Actualización POST-partido (siempre) ──────────────────────────────
    sumHomeGoals += hs; sumAwayGoals += as; matchesSeen++

    home.played++; away.played++
    home.goals_for += hs; home.goals_against += as
    away.goals_for += as; away.goals_against += hs
    if (as === 0) home.clean_sheets++
    if (hs === 0) away.clean_sheets++
    home.gfHist.push(hs); home.gaHist.push(as)
    away.gfHist.push(as); away.gaHist.push(hs)

    if (hs > as) { home.won++; away.lost++; home.form.push('W'); away.form.push('L') }
    else if (hs < as) { away.won++; home.lost++; away.form.push('W'); home.form.push('L') }
    else { home.drawn++; away.drawn++; home.form.push('D'); away.form.push('D') }
    home.form = home.form.slice(-5)
    away.form = away.form.slice(-5)

    // ELO con multiplicador por diferencia de goles
    const eHome = eloExpectedHome(home.elo, away.elo)
    const score = hs > as ? 1 : hs === as ? 0.5 : 0
    const delta = LEAGUE_ELO_K * goalDiffMultiplier(hs - as) * (score - eHome)
    home.elo += delta
    away.elo -= delta
  }

  // ── Predicciones para partidos NO jugados (estado final del modelo) ──
  // Modo "en vivo" para la temporada 2026-27: tras ingerir la jornada,
  // la calibración deja lista la predicción de los próximos partidos.
  const leagueHomeAvg = matchesSeen > 0 ? sumHomeGoals / matchesSeen : PRIOR_HOME_GOALS
  const leagueAwayAvg = matchesSeen > 0 ? sumAwayGoals / matchesSeen : PRIOR_AWAY_GOALS
  const upcoming: UpcomingPrediction[] = matches
    .filter((m) => m.status === 'scheduled' || m.status === 'live')
    .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time) || a.id.localeCompare(b.id))
    .map((m) => {
      const p = predictFromStates(state(m.home_team_id), state(m.away_team_id), leagueHomeAvg, leagueAwayAvg)
      return {
        match_id: m.id,
        home_win_probability: p.home,
        draw_probability: p.draw,
        away_win_probability: p.away,
        predicted_home_score: p.predictedHome,
        predicted_away_score: p.predictedAway,
        confidence_score: p.confidence,
        pick: p.pick,
      }
    })

  const evaluated = predictions.length
  const finalElo = new Map<string, number>()
  const teamSeason = new Map<string, TeamSeasonAggregate>()
  for (const [id, t] of teams) {
    finalElo.set(id, Math.round(t.elo))
    const { gfHist: _gf, gaHist: _ga, ...agg } = t
    teamSeason.set(id, { ...agg, elo: Math.round(t.elo) })
  }

  return {
    finalElo,
    teamSeason,
    predictions,
    upcoming,
    metrics: {
      evaluated,
      skipped,
      correct,
      accuracy: evaluated > 0 ? Math.round((correct / evaluated) * 1000) / 1000 : 0,
      brier: evaluated > 0 ? Math.round((brierSum / evaluated) * 1000) / 1000 : 0,
      log_loss: evaluated > 0 ? Math.round((logLossSum / evaluated) * 1000) / 1000 : 0,
    },
  }
}
