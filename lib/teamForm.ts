/**
 * Forma reciente de un equipo dentro de UNA competición (últimos 10
 * partidos finalizados). Compartido entre el detalle de partido y el
 * tracking de Smart Bets — evita reconstruir esta query en cada lugar
 * y garantiza el mismo blindaje anti-fuga (Regla #2: nunca mezclar
 * competiciones).
 *
 * Dos formas de pedirla, mismo resultado:
 *   - fetchTeamForm            → un equipo (detalle de partido).
 *   - fetchCompetitionForms    → TODOS los equipos de una competición de
 *     una sola pasada, para procesos masivos. Pedir equipo por equipo
 *     costaba dos consultas por partido programado.
 */
import type { MatchFormEntry } from '@/lib/smartBetsEngine'
import { fetchAllRows } from '@/lib/fetchAll'

/** Ventana de forma: los 10 partidos finalizados más recientes. */
export const FORM_WINDOW = 10

/** Columnas mínimas para construir una entrada de forma. */
const FORM_COLUMNS = `
  id, kickoff_time, home_score, away_score, home_team_id, away_team_id,
  home_team:teams!matches_home_team_id_fkey(name, short_name),
  away_team:teams!matches_away_team_id_fkey(name, short_name),
  match_statistics(team_id, shots, shots_on_target, corners, fouls,
    yellow_cards, red_cards, possession, xg, xga, big_chances)
`

/** Un partido finalizado, visto desde uno de los dos equipos. */
export function toFormEntry(m: any, teamId: string): MatchFormEntry {
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
}

export async function fetchTeamForm(
  supabase: any,
  teamId: string,
  excludeMatchId: string,
  competitionId: string,
): Promise<MatchFormEntry[]> {
  const { data } = await supabase
    .from('matches')
    .select(FORM_COLUMNS)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq('status', 'finished')
    .eq('competition_id', competitionId) // solo forma DEL TORNEO actual, no amistosos previos
    .neq('id', excludeMatchId)
    .order('kickoff_time', { ascending: false })
    .order('id', { ascending: true }) // desempate estable entre partidos de la misma hora
    .limit(FORM_WINDOW)

  if (!data) return []

  return (data as any[]).map((m) => toFormEntry(m, teamId))
}

/**
 * Agrupa partidos finalizados —ya ordenados del más reciente al más
 * antiguo— en la forma de cada equipo. Cada partido alimenta a los dos
 * equipos que lo jugaron, y cada equipo se corta en la ventana de forma.
 */
export function groupFormsByTeam(rows: any[]): Map<string, MatchFormEntry[]> {
  const out = new Map<string, MatchFormEntry[]>()
  for (const m of rows) {
    for (const teamId of [m.home_team_id, m.away_team_id]) {
      if (!teamId) continue
      const list = out.get(teamId)
      if (!list) out.set(teamId, [toFormEntry(m, teamId)])
      else if (list.length < FORM_WINDOW) list.push(toFormEntry(m, teamId))
    }
  }
  return out
}

/**
 * Forma de TODOS los equipos de una competición con una sola consulta
 * (paginada). Equivale a llamar a fetchTeamForm por equipo salvo por la
 * exclusión de `excludeMatchId`: quien la usa parte de partidos que aún no
 * se han jugado, y un partido no finalizado nunca entra en esta lista.
 */
export async function fetchCompetitionForms(
  supabase: any,
  competitionId: string,
): Promise<Map<string, MatchFormEntry[]>> {
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from('matches')
      .select(FORM_COLUMNS)
      .eq('status', 'finished')
      .eq('competition_id', competitionId)
      .order('kickoff_time', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
  )
  return groupFormsByTeam(rows)
}
