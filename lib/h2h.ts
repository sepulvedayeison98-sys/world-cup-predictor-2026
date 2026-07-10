/**
 * Head-to-head (playbook Sofascore, mejora 10) — módulo puro.
 *
 * Historial de enfrentamientos entre dos equipos, calculado de partidos
 * reales ya jugados. Dos equipos que se enfrentan pertenecen a la misma
 * competición (selecciones vs selecciones en el Mundial; clubes vs clubes
 * en su liga), así que la query en la página filtra por competición y
 * respeta la regla de oro. Cero datos fabricados: si no hay enfrentamientos
 * en nuestros datos, `total` es 0 y la UI no inventa historia.
 */

export interface H2HMatch {
  id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  kickoff_time: string
  status: string
}

export interface H2HResult {
  total: number
  aWins: number
  bWins: number
  draws: number
  aGoals: number
  bGoals: number
  /** Enfrentamientos más recientes primero (con el marcador desde la óptica de A) */
  recent: {
    id: string
    date: string
    aScore: number
    bScore: number
    outcome: 'A' | 'B' | 'draw'
  }[]
}

/**
 * Resume los enfrentamientos entre A y B. `matches` debe venir ya filtrado
 * a partidos finalizados de la competición; se normaliza todo a la óptica
 * del equipo A.
 */
export function computeH2H(matches: H2HMatch[], teamAId: string, teamBId: string): H2HResult {
  const played = matches
    .filter((m) =>
      m.status === 'finished' && m.home_score != null && m.away_score != null &&
      ((m.home_team_id === teamAId && m.away_team_id === teamBId) ||
       (m.home_team_id === teamBId && m.away_team_id === teamAId)),
    )
    .sort((x, y) => y.kickoff_time.localeCompare(x.kickoff_time))

  const res: H2HResult = { total: 0, aWins: 0, bWins: 0, draws: 0, aGoals: 0, bGoals: 0, recent: [] }

  for (const m of played) {
    // Marcador desde la óptica de A
    const aScore = m.home_team_id === teamAId ? (m.home_score as number) : (m.away_score as number)
    const bScore = m.home_team_id === teamAId ? (m.away_score as number) : (m.home_score as number)
    res.total++
    res.aGoals += aScore
    res.bGoals += bScore
    const outcome: 'A' | 'B' | 'draw' = aScore > bScore ? 'A' : aScore < bScore ? 'B' : 'draw'
    if (outcome === 'A') res.aWins++
    else if (outcome === 'B') res.bWins++
    else res.draws++
    if (res.recent.length < 6) res.recent.push({ id: m.id, date: m.kickoff_time, aScore, bScore, outcome })
  }

  return res
}
