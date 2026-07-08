/**
 * Tabla de posiciones de una liga, calculada al vuelo desde matches.
 * (Las ligas no usan group_standings, que es específico del Mundial.)
 */

export interface LeagueTeamInfo {
  id: string
  name: string
  code: string
  logo_url: string | null
}

export interface LeagueMatchRow {
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  status: string
  kickoff_time: string
}

export interface LeagueStandingRow {
  position: number
  team: LeagueTeamInfo
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  form: ('W' | 'D' | 'L')[] // últimos 5, el más reciente al final
}

export function computeLeagueStandings(
  teams: LeagueTeamInfo[],
  matches: LeagueMatchRow[],
): LeagueStandingRow[] {
  const rows = new Map<string, Omit<LeagueStandingRow, 'position' | 'team'> & { team: LeagueTeamInfo }>()
  for (const t of teams) {
    rows.set(t.id, {
      team: t, played: 0, won: 0, drawn: 0, lost: 0,
      goals_for: 0, goals_against: 0, goal_difference: 0, points: 0, form: [],
    })
  }

  const finished = matches
    .filter((m) => m.status === 'finished' && m.home_score !== null && m.away_score !== null)
    .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time))

  for (const m of finished) {
    const home = rows.get(m.home_team_id)
    const away = rows.get(m.away_team_id)
    if (!home || !away) continue
    const hs = m.home_score as number
    const as = m.away_score as number

    home.played++; away.played++
    home.goals_for += hs; home.goals_against += as
    away.goals_for += as; away.goals_against += hs

    if (hs > as) { home.won++; away.lost++; home.points += 3; home.form.push('W'); away.form.push('L') }
    else if (hs < as) { away.won++; home.lost++; away.points += 3; away.form.push('W'); home.form.push('L') }
    else { home.drawn++; away.drawn++; home.points++; away.points++; home.form.push('D'); away.form.push('D') }
  }

  const list = [...rows.values()].map((r) => ({
    ...r,
    goal_difference: r.goals_for - r.goals_against,
    form: r.form.slice(-5) as ('W' | 'D' | 'L')[],
  }))

  // Orden liga: puntos → diferencia de gol → goles a favor → nombre
  list.sort((a, b) =>
    b.points - a.points ||
    b.goal_difference - a.goal_difference ||
    b.goals_for - a.goals_for ||
    a.team.name.localeCompare(b.team.name),
  )

  return list.map((r, i) => ({ ...r, position: i + 1 }))
}
