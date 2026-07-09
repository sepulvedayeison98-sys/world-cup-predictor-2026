/**
 * Estadísticas reales de temporada NBA — módulo puro del dominio baloncesto.
 *
 * TODO dato sale de partidos jugados de verdad (marcadores finales y
 * puntos por cuarto de la BD). No se calculan métricas que exigirían
 * datos de posesión que no tenemos (ORtg/DRtg/Pace/eFG% requieren
 * tiros, rebotes ofensivos y pérdidas — ver backlog en PROGRESS_REPORT):
 * antes que fabricar una aproximación, no se publica la métrica.
 *
 * Módulo puro, sin I/O — ver tests/nbaStats.test.ts.
 */

export interface NbaStatsMatch {
  id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  status: string
  kickoff_time: string
  phase?: string | null
  period_scores?: { home: number[]; away: number[] } | null
}

export interface NbaTeamSeasonStats {
  team_id: string
  played: number
  won: number
  lost: number
  win_pct: number
  home_won: number
  home_lost: number
  away_won: number
  away_lost: number
  points_for: number
  points_against: number
  ppg: number            // puntos por partido
  papg: number           // puntos permitidos por partido
  margin: number         // diferencial medio
  last5: ('W' | 'L')[]   // más reciente al final
  last10Won: number
  last10Lost: number
  /** Racha actual: >0 victorias seguidas, <0 derrotas seguidas */
  streak: number
  /** Promedio de puntos anotados por cuarto (Q1-Q4), solo partidos con dato */
  quarterAvgFor: number[]
  quarterAvgAgainst: number[]
  /** Partidos con prórroga y récord en ellos */
  otPlayed: number
  otWon: number
  /** Partidos cerrados (margen final ≤5) y récord en ellos */
  closePlayed: number
  closeWon: number
}

export interface NbaLeagueStats {
  games: number
  avgTotalPoints: number
  homeWinPct: number
  otGames: number
  /** Promedio liga de puntos por cuarto (ambos equipos sumados) */
  quarterAvgTotal: number[]
  highestScoring: { match_id: string; total: number } | null
}

function finished(matches: NbaStatsMatch[]): NbaStatsMatch[] {
  return matches
    .filter((m) => m.status === 'finished' && m.home_score != null && m.away_score != null)
    .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time))
}

/** Estadísticas de temporada por equipo, calculadas de partidos reales. */
export function computeNbaSeasonStats(matches: NbaStatsMatch[]): Map<string, NbaTeamSeasonStats> {
  const played = finished(matches)
  const acc = new Map<string, NbaTeamSeasonStats & {
    _results: ('W' | 'L')[]
    _qForSum: number[]; _qAgSum: number[]; _qGames: number
  }>()

  const get = (id: string) => {
    let t = acc.get(id)
    if (!t) {
      t = {
        team_id: id, played: 0, won: 0, lost: 0, win_pct: 0,
        home_won: 0, home_lost: 0, away_won: 0, away_lost: 0,
        points_for: 0, points_against: 0, ppg: 0, papg: 0, margin: 0,
        last5: [], last10Won: 0, last10Lost: 0, streak: 0,
        quarterAvgFor: [], quarterAvgAgainst: [],
        otPlayed: 0, otWon: 0, closePlayed: 0, closeWon: 0,
        _results: [], _qForSum: [0, 0, 0, 0], _qAgSum: [0, 0, 0, 0], _qGames: 0,
      }
      acc.set(id, t)
    }
    return t
  }

  for (const m of played) {
    const hs = m.home_score as number
    const as = m.away_score as number
    const home = get(m.home_team_id)
    const away = get(m.away_team_id)
    const homeWon = hs > as
    const isOt = (m.period_scores?.home?.length ?? 4) > 4
    const isClose = Math.abs(hs - as) <= 5

    home.played++; away.played++
    home.points_for += hs; home.points_against += as
    away.points_for += as; away.points_against += hs
    if (homeWon) { home.won++; home.home_won++; away.lost++; away.away_lost++ }
    else { away.won++; away.away_won++; home.lost++; home.home_lost++ }
    home._results.push(homeWon ? 'W' : 'L')
    away._results.push(homeWon ? 'L' : 'W')
    if (isOt) {
      home.otPlayed++; away.otPlayed++
      if (homeWon) home.otWon++; else away.otWon++
    }
    if (isClose) {
      home.closePlayed++; away.closePlayed++
      if (homeWon) home.closeWon++; else away.closeWon++
    }
    // Cuartos Q1-Q4 (la prórroga no entra al perfil por cuarto)
    const ps = m.period_scores
    if (ps && ps.home.length >= 4 && ps.away.length >= 4) {
      home._qGames++; away._qGames++
      for (let q = 0; q < 4; q++) {
        home._qForSum[q] += ps.home[q]; home._qAgSum[q] += ps.away[q]
        away._qForSum[q] += ps.away[q]; away._qAgSum[q] += ps.home[q]
      }
    }
  }

  const out = new Map<string, NbaTeamSeasonStats>()
  for (const [id, t] of acc) {
    const r = t._results
    const last10 = r.slice(-10)
    let streak = 0
    for (let i = r.length - 1; i >= 0; i--) {
      if (r[i] === r[r.length - 1]) streak++
      else break
    }
    const round1 = (v: number) => Math.round(v * 10) / 10
    out.set(id, {
      team_id: id,
      played: t.played, won: t.won, lost: t.lost,
      win_pct: t.played ? t.won / t.played : 0,
      home_won: t.home_won, home_lost: t.home_lost,
      away_won: t.away_won, away_lost: t.away_lost,
      points_for: t.points_for, points_against: t.points_against,
      ppg: t.played ? round1(t.points_for / t.played) : 0,
      papg: t.played ? round1(t.points_against / t.played) : 0,
      margin: t.played ? round1((t.points_for - t.points_against) / t.played) : 0,
      last5: r.slice(-5),
      last10Won: last10.filter((x) => x === 'W').length,
      last10Lost: last10.filter((x) => x === 'L').length,
      streak: r.length === 0 ? 0 : (r[r.length - 1] === 'W' ? streak : -streak),
      quarterAvgFor: t._qGames ? t._qForSum.map((s) => round1(s / t._qGames)) : [],
      quarterAvgAgainst: t._qGames ? t._qAgSum.map((s) => round1(s / t._qGames)) : [],
      otPlayed: t.otPlayed, otWon: t.otWon,
      closePlayed: t.closePlayed, closeWon: t.closeWon,
    })
  }
  return out
}

/** Agregados de toda la liga, de partidos reales. */
export function computeNbaLeagueStats(matches: NbaStatsMatch[]): NbaLeagueStats {
  const played = finished(matches)
  let totalPoints = 0
  let homeWins = 0
  let otGames = 0
  let highest: { match_id: string; total: number } | null = null
  const qSum = [0, 0, 0, 0]
  let qGames = 0

  for (const m of played) {
    const total = (m.home_score as number) + (m.away_score as number)
    totalPoints += total
    if ((m.home_score as number) > (m.away_score as number)) homeWins++
    if ((m.period_scores?.home?.length ?? 4) > 4) otGames++
    if (!highest || total > highest.total) highest = { match_id: m.id, total }
    const ps = m.period_scores
    if (ps && ps.home.length >= 4 && ps.away.length >= 4) {
      qGames++
      for (let q = 0; q < 4; q++) qSum[q] += ps.home[q] + ps.away[q]
    }
  }

  const round1 = (v: number) => Math.round(v * 10) / 10
  return {
    games: played.length,
    avgTotalPoints: played.length ? round1(totalPoints / played.length) : 0,
    homeWinPct: played.length ? homeWins / played.length : 0,
    otGames,
    quarterAvgTotal: qGames ? qSum.map((s) => round1(s / qGames)) : [],
    highestScoring: highest,
  }
}

/**
 * Calibración honesta del modelo: agrupa predicciones resueltas por
 * probabilidad del favorito y compara con la tasa de acierto real.
 * Un modelo calibrado acierta ~X% cuando dice X%.
 */
export interface NbaCalibrationBucket {
  label: string
  from: number
  to: number
  total: number
  correct: number
  hitRate: number       // acierto real observado
  expectedRate: number  // punto medio del rango (lo que "promete" el modelo)
}

export function computeNbaCalibration(
  predictions: { home_win_probability: number; away_win_probability: number; was_correct: boolean | null }[],
): NbaCalibrationBucket[] {
  const edges = [0.5, 0.6, 0.7, 0.8, 1.0001]
  const buckets: NbaCalibrationBucket[] = []
  for (let i = 0; i < edges.length - 1; i++) {
    buckets.push({
      label: i === edges.length - 2
        ? `${Math.round(edges[i] * 100)}%+`
        : `${Math.round(edges[i] * 100)}–${Math.round(edges[i + 1] * 100)}%`,
      from: edges[i], to: edges[i + 1], total: 0, correct: 0, hitRate: 0,
      expectedRate: i === edges.length - 2 ? (edges[i] + 0.9) / 2 : (edges[i] + edges[i + 1]) / 2,
    })
  }
  for (const p of predictions) {
    if (p.was_correct == null) continue
    const fav = Math.max(Number(p.home_win_probability), Number(p.away_win_probability))
    const b = buckets.find((x) => fav >= x.from && fav < x.to)
    if (!b) continue
    b.total++
    if (p.was_correct) b.correct++
  }
  for (const b of buckets) b.hitRate = b.total ? b.correct / b.total : 0
  return buckets
}
