/**
 * Forma reciente de un equipo dentro de UNA competición (últimos 10
 * partidos finalizados). Compartido entre el detalle de partido y el
 * tracking de Smart Bets — evita reconstruir esta query en cada lugar
 * y garantiza el mismo blindaje anti-fuga (Regla #2: nunca mezclar
 * competiciones).
 */
import type { MatchFormEntry } from '@/lib/smartBetsEngine'

export async function fetchTeamForm(
  supabase: any,
  teamId: string,
  excludeMatchId: string,
  competitionId: string,
): Promise<MatchFormEntry[]> {
  const { data } = await supabase
    .from('matches')
    .select(`
      id, kickoff_time, home_score, away_score, home_team_id, away_team_id,
      home_team:teams!matches_home_team_id_fkey(name, short_name),
      away_team:teams!matches_away_team_id_fkey(name, short_name),
      match_statistics(team_id, shots, shots_on_target, corners, fouls,
        yellow_cards, red_cards, possession, xg, xga, big_chances)
    `)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq('status', 'finished')
    .eq('competition_id', competitionId) // solo forma DEL TORNEO actual, no amistosos previos
    .neq('id', excludeMatchId)
    .order('kickoff_time', { ascending: false })
    .limit(10)

  if (!data) return []

  return (data as any[]).map((m) => {
    const isHome    = m.home_team_id === teamId
    const teamScore = isHome ? (m.home_score ?? 0) : (m.away_score ?? 0)
    const oppScore  = isHome ? (m.away_score ?? 0) : (m.home_score ?? 0)
    const opp       = isHome ? m.away_team : m.home_team
    const stats     = (m.match_statistics ?? []).find((s: any) => s.team_id === teamId)
    const result: 'W' | 'D' | 'L' = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D'

    return {
      kickoff_time:    m.kickoff_time,
      result,
      goals_scored:    teamScore,
      goals_conceded:  oppScore,
      is_clean_sheet:  oppScore === 0,
      btts:            teamScore > 0 && oppScore > 0,
      over_2_5:        (teamScore + oppScore) > 2,
      over_1_5:        (teamScore + oppScore) > 1,
      opponent_name:   opp?.short_name ?? opp?.name ?? 'Oponente',
      xg:              stats?.xg              ?? null,
      xga:             stats?.xga             ?? null,
      shots:           stats?.shots           ?? null,
      shots_on_target: stats?.shots_on_target ?? null,
      corners:         stats?.corners         ?? null,
      yellow_cards:    stats?.yellow_cards    ?? null,
      red_cards:       stats?.red_cards       ?? null,
      fouls:           stats?.fouls           ?? null,
      possession:      stats?.possession      ?? null,
      big_chances:     stats?.big_chances     ?? null,
    } satisfies MatchFormEntry
  })
}
