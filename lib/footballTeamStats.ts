/**
 * Estadísticas de equipo de fútbol desde partidos reales (perfil de equipo).
 * Módulo puro, con empates (a diferencia del de NBA). Un equipo de fútbol
 * juega en una sola competición en nuestros datos, así que la query en la
 * página filtra por competición y respeta la regla de oro. Cero fabricado:
 * todo sale de marcadores finales.
 */

export interface FbMatch {
  id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  status: string
  kickoff_time: string
}

export interface FootballTeamStats {
  played: number
  won: number
  drawn: number
  lost: number
  points: number
  goals_for: number
  goals_against: number
  goal_diff: number
  ppg: number            // puntos por partido
  gfpg: number           // goles a favor por partido
  gapg: number           // goles en contra por partido
  homeW: number; homeD: number; homeL: number
  awayW: number; awayD: number; awayL: number
  last5: ('W' | 'D' | 'L')[]   // más reciente al final
  last10W: number; last10D: number; last10L: number
  /** Racha actual: >0 victorias, <0 derrotas, 0 empate/sin datos */
  streak: number
}

function finished(matches: FbMatch[], teamId: string): FbMatch[] {
  return matches
    .filter((m) =>
      m.status === 'finished' && m.home_score != null && m.away_score != null &&
      (m.home_team_id === teamId || m.away_team_id === teamId))
    .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time))
}

export function computeFootballTeamStats(matches: FbMatch[], teamId: string): FootballTeamStats {
  const played = finished(matches, teamId)
  const s: FootballTeamStats = {
    played: 0, won: 0, drawn: 0, lost: 0, points: 0,
    goals_for: 0, goals_against: 0, goal_diff: 0, ppg: 0, gfpg: 0, gapg: 0,
    homeW: 0, homeD: 0, homeL: 0, awayW: 0, awayD: 0, awayL: 0,
    last5: [], last10W: 0, last10D: 0, last10L: 0, streak: 0,
  }
  const results: ('W' | 'D' | 'L')[] = []

  for (const m of played) {
    const isHome = m.home_team_id === teamId
    const gf = isHome ? (m.home_score as number) : (m.away_score as number)
    const ga = isHome ? (m.away_score as number) : (m.home_score as number)
    s.played++
    s.goals_for += gf
    s.goals_against += ga
    let res: 'W' | 'D' | 'L'
    if (gf > ga) { res = 'W'; s.won++; s.points += 3; if (isHome) s.homeW++; else s.awayW++ }
    else if (gf < ga) { res = 'L'; s.lost++; if (isHome) s.homeL++; else s.awayL++ }
    else { res = 'D'; s.drawn++; s.points += 1; if (isHome) s.homeD++; else s.awayD++ }
    results.push(res)
  }

  const round1 = (v: number) => Math.round(v * 10) / 10
  const round2 = (v: number) => Math.round(v * 100) / 100
  s.goal_diff = s.goals_for - s.goals_against
  s.ppg = s.played ? round2(s.points / s.played) : 0
  s.gfpg = s.played ? round1(s.goals_for / s.played) : 0
  s.gapg = s.played ? round1(s.goals_against / s.played) : 0
  s.last5 = results.slice(-5)
  const last10 = results.slice(-10)
  s.last10W = last10.filter((r) => r === 'W').length
  s.last10D = last10.filter((r) => r === 'D').length
  s.last10L = last10.filter((r) => r === 'L').length

  // Racha: cuenta victorias/derrotas consecutivas al final (los empates la cortan)
  if (results.length) {
    const last = results[results.length - 1]
    if (last !== 'D') {
      let n = 0
      for (let i = results.length - 1; i >= 0; i--) {
        if (results[i] === last) n++
        else break
      }
      s.streak = last === 'W' ? n : -n
    }
  }
  return s
}
