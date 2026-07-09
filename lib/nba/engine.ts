/**
 * Motor de predicción NBA (baloncesto) — Fase multideporte.
 *
 * A diferencia del fútbol NO hay empates: el modelo produce solo
 * probabilidad de victoria local/visitante (draw = 0) más un marcador
 * estimado en puntos. Se basa en ELO con ventaja de local y un margen
 * derivado de la diferencia de ELO; el total estimado usa el ritmo
 * anotador reciente de cada equipo.
 *
 * El backtest es walk-forward (honesto): cada partido se predice solo
 * con la información previa a jugarse; los primeros de cada equipo son
 * calentamiento y no se evalúan. Módulo puro — ver tests/nbaEngine.test.ts.
 */
// ─── Parámetros ──────────────────────────────────────────────────────────────
/**
 * Nivel de confianza 1-5 a partir del score 0-100. Mismos umbrales que
 * el motor de fútbol, definidos aquí a propósito: el dominio NBA no
 * importa NADA del motor de fútbol (barrera arquitectónica anti-
 * contaminación; ver regla no-restricted-imports en .eslintrc.json).
 */
export function nbaConfidenceLevel(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 85) return 5
  if (score >= 75) return 4
  if (score >= 65) return 3
  if (score >= 55) return 2
  return 1
}

export const NBA_ELO_BASE = 1500
export const NBA_ELO_K = 20
export const NBA_ELO_HOME_ADV = 60      // ventaja de local en puntos ELO (~+2.4 pts, ~58% local)
export const NBA_WARMUP_GAMES = 5
const POINTS_PER_ELO = 0.04             // 100 ELO ≈ 4 puntos de margen
const PRIOR_TEAM_POINTS = 113           // media anotadora NBA por equipo/partido
const ROLLING_WINDOW = 15
const SHRINK_PRIOR = 5

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface NbaEngineMatch {
  id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  status: string
  kickoff_time: string
}

export type NbaOutcome = 'home' | 'away'

export interface NbaMatchPrediction {
  match_id: string
  home_win_probability: number
  draw_probability: 0
  away_win_probability: number
  predicted_home_score: number
  predicted_away_score: number
  confidence_score: number
  pick: NbaOutcome
  actual: NbaOutcome
  correct: boolean
}

export interface NbaUpcomingPrediction {
  match_id: string
  home_win_probability: number
  draw_probability: 0
  away_win_probability: number
  predicted_home_score: number
  predicted_away_score: number
  confidence_score: number
  pick: NbaOutcome
}

export interface NbaTeamSeason {
  played: number
  won: number
  lost: number
  points_for: number
  points_against: number
  form: ('W' | 'L')[] // últimos 5, más reciente al final
  elo: number
}

export interface NbaBacktestMetrics {
  evaluated: number
  skipped: number
  correct: number
  accuracy: number
  brier: number       // 2 clases, 0 (perfecto) … 2; azar = 0.5
  log_loss: number
  mae_margin: number  // error absoluto medio del margen estimado (puntos)
}

export interface NbaBacktestResult {
  finalElo: Map<string, number>
  teamSeason: Map<string, NbaTeamSeason>
  predictions: NbaMatchPrediction[]
  upcoming: NbaUpcomingPrediction[]
  metrics: NbaBacktestMetrics
}

// ─── Estado interno ──────────────────────────────────────────────────────────
interface TeamState extends NbaTeamSeason {
  pfHist: number[]
  paHist: number[]
}
function newTeam(): TeamState {
  return { played: 0, won: 0, lost: 0, points_for: 0, points_against: 0, form: [], elo: NBA_ELO_BASE, pfHist: [], paHist: [] }
}
function rollingAvg(hist: number[], fallback: number): number {
  const w = hist.slice(-ROLLING_WINDOW)
  if (w.length === 0) return fallback
  return w.reduce((s, v) => s + v, 0) / w.length
}
function shrink(teamAvg: number, played: number, prior: number): number {
  return (teamAvg * played + prior * SHRINK_PRIOR) / (played + SHRINK_PRIOR)
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Probabilidad de victoria local por ELO (con ventaja de local). */
export function nbaExpectedHome(eloHome: number, eloAway: number): number {
  return 1 / (1 + Math.pow(10, -((eloHome + NBA_ELO_HOME_ADV - eloAway) / 400)))
}

function movMultiplier(margin: number): number {
  const d = Math.abs(margin)
  if (d <= 5) return 1
  if (d <= 10) return 1.2
  if (d <= 20) return 1.4
  return 1.6
}

interface Probs {
  home: number; away: number
  predHome: number; predAway: number
  confidence: number; pick: NbaOutcome
}
function predict(home: TeamState, away: TeamState): Probs {
  const pHome = nbaExpectedHome(home.elo, away.elo)
  const eloMargin = (home.elo + NBA_ELO_HOME_ADV - away.elo) * POINTS_PER_ELO

  // Total estimado desde el ritmo anotador reciente (con encogimiento)
  const homeOff = shrink(rollingAvg(home.pfHist, PRIOR_TEAM_POINTS), home.played, PRIOR_TEAM_POINTS)
  const awayOff = shrink(rollingAvg(away.pfHist, PRIOR_TEAM_POINTS), away.played, PRIOR_TEAM_POINTS)
  const homeDef = shrink(rollingAvg(home.paHist, PRIOR_TEAM_POINTS), home.played, PRIOR_TEAM_POINTS)
  const awayDef = shrink(rollingAvg(away.paHist, PRIOR_TEAM_POINTS), away.played, PRIOR_TEAM_POINTS)
  const expHome = (homeOff + awayDef) / 2
  const expAway = (awayOff + homeDef) / 2
  const base = expHome + expAway

  const predHome = Math.round(clamp(base / 2 + eloMargin / 2, 80, 160))
  const predAway = Math.round(clamp(base / 2 - eloMargin / 2, 80, 160))

  // Confianza: cuánto se aleja del 50% (0.5→~50, 0.85→~90)
  const confidence = Math.round(clamp(50 + Math.abs(pHome - 0.5) * 120, 50, 95) * 10) / 10

  return {
    home: Math.round(pHome * 1000) / 1000,
    away: Math.round((1 - pHome) * 1000) / 1000,
    predHome, predAway, confidence,
    pick: pHome >= 0.5 ? 'home' : 'away',
  }
}

// ─── Backtest walk-forward ───────────────────────────────────────────────────
export function runNbaBacktest(matches: NbaEngineMatch[]): NbaBacktestResult {
  const finished = matches
    .filter((m) => m.status === 'finished' && m.home_score !== null && m.away_score !== null)
    .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time) || a.id.localeCompare(b.id))

  const teams = new Map<string, TeamState>()
  const state = (id: string): TeamState => {
    let t = teams.get(id)
    if (!t) { t = newTeam(); teams.set(id, t) }
    return t
  }

  const predictions: NbaMatchPrediction[] = []
  let skipped = 0, correct = 0, brierSum = 0, logLossSum = 0, maeSum = 0

  for (const m of finished) {
    const home = state(m.home_team_id)
    const away = state(m.away_team_id)
    const hs = m.home_score as number
    const as = m.away_score as number
    const actual: NbaOutcome = hs > as ? 'home' : 'away' // sin empates en NBA

    if (home.played >= NBA_WARMUP_GAMES && away.played >= NBA_WARMUP_GAMES) {
      const p = predict(home, away)
      const isCorrect = p.pick === actual
      const pActual = actual === 'home' ? p.home : p.away
      const yHome = actual === 'home' ? 1 : 0

      predictions.push({
        match_id: m.id,
        home_win_probability: p.home,
        draw_probability: 0,
        away_win_probability: p.away,
        predicted_home_score: p.predHome,
        predicted_away_score: p.predAway,
        confidence_score: p.confidence,
        pick: p.pick, actual, correct: isCorrect,
      })
      if (isCorrect) correct++
      brierSum += (p.home - yHome) ** 2 + (p.away - (1 - yHome)) ** 2
      logLossSum += -Math.log(Math.max(pActual, 1e-9))
      maeSum += Math.abs((p.predHome - p.predAway) - (hs - as))
    } else {
      skipped++
    }

    // Actualización post-partido
    home.played++; away.played++
    home.points_for += hs; home.points_against += as
    away.points_for += as; away.points_against += hs
    home.pfHist.push(hs); home.paHist.push(as)
    away.pfHist.push(as); away.paHist.push(hs)
    if (hs > as) { home.won++; away.lost++; home.form.push('W'); away.form.push('L') }
    else { away.won++; home.lost++; away.form.push('W'); home.form.push('L') }
    home.form = home.form.slice(-5)
    away.form = away.form.slice(-5)

    const eHome = nbaExpectedHome(home.elo, away.elo)
    const scoreHome = hs > as ? 1 : 0
    const delta = NBA_ELO_K * movMultiplier(hs - as) * (scoreHome - eHome)
    home.elo += delta
    away.elo -= delta
  }

  // Predicciones para partidos programados/en vivo (estado final del modelo)
  const upcoming: NbaUpcomingPrediction[] = matches
    .filter((m) => m.status === 'scheduled' || m.status === 'live')
    .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time) || a.id.localeCompare(b.id))
    .map((m) => {
      const p = predict(state(m.home_team_id), state(m.away_team_id))
      return {
        match_id: m.id,
        home_win_probability: p.home,
        draw_probability: 0 as const,
        away_win_probability: p.away,
        predicted_home_score: p.predHome,
        predicted_away_score: p.predAway,
        confidence_score: p.confidence,
        pick: p.pick,
      }
    })

  const finalElo = new Map<string, number>()
  const teamSeason = new Map<string, NbaTeamSeason>()
  for (const [id, t] of teams) {
    finalElo.set(id, Math.round(t.elo))
    const { pfHist: _pf, paHist: _pa, ...agg } = t
    teamSeason.set(id, { ...agg, elo: Math.round(t.elo) })
  }

  const evaluated = predictions.length
  return {
    finalElo, teamSeason, predictions, upcoming,
    metrics: {
      evaluated, skipped, correct,
      accuracy: evaluated ? Math.round((correct / evaluated) * 1000) / 1000 : 0,
      brier: evaluated ? Math.round((brierSum / evaluated) * 1000) / 1000 : 0,
      log_loss: evaluated ? Math.round((logLossSum / evaluated) * 1000) / 1000 : 0,
      mae_margin: evaluated ? Math.round((maeSum / evaluated) * 10) / 10 : 0,
    },
  }
}

/** Tabla de posiciones NBA (récord W-L) calculada desde los partidos. */
export interface NbaStandingRow {
  team_id: string
  won: number
  lost: number
  win_pct: number
  points_for: number
  points_against: number
  form: ('W' | 'L')[]
}
export function computeNbaRecords(matches: NbaEngineMatch[]): Map<string, NbaStandingRow> {
  const rows = new Map<string, NbaStandingRow & { _form: ('W' | 'L')[] }>()
  const get = (id: string) => {
    let r = rows.get(id)
    if (!r) { r = { team_id: id, won: 0, lost: 0, win_pct: 0, points_for: 0, points_against: 0, form: [], _form: [] }; rows.set(id, r) }
    return r
  }
  const finished = matches
    .filter((m) => m.status === 'finished' && m.home_score !== null && m.away_score !== null)
    .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time))
  for (const m of finished) {
    const h = get(m.home_team_id), a = get(m.away_team_id)
    const hs = m.home_score as number, as = m.away_score as number
    h.points_for += hs; h.points_against += as
    a.points_for += as; a.points_against += hs
    if (hs > as) { h.won++; a.lost++; h._form.push('W'); a._form.push('L') }
    else { a.won++; h.lost++; a._form.push('W'); h._form.push('L') }
  }
  for (const r of rows.values()) {
    const total = r.won + r.lost
    r.win_pct = total ? Math.round((r.won / total) * 1000) / 1000 : 0
    r.form = r._form.slice(-5)
  }
  return rows
}
