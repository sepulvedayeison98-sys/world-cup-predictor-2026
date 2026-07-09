/**
 * Carga de datos del dominio NBA para las páginas de sección.
 * Toda query filtra por NBA_COMPETITION_ID (regla de oro) y pagina
 * las tablas que superan las 1000 filas de PostgREST (temporada
 * completa ~1314 partidos; predicciones ~1236).
 */
import { NBA_COMPETITION_ID } from '@/lib/nba/constants'
import { fetchAllRows } from '@/lib/fetchAll'
import type { NbaStatsMatch } from '@/lib/nba/stats'

export interface NbaTeamRow {
  id: string
  name: string
  code: string
  logo_url: string | null
  conference: string | null
  division: string | null
  elo_rating: number | null
}

export async function fetchNbaTeams(supabase: any): Promise<NbaTeamRow[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, code, logo_url, conference, division, elo_rating')
    .eq('competition_id', NBA_COMPETITION_ID)
  if (error) console.error('[nba] equipos:', error.message)
  return (data ?? []) as NbaTeamRow[]
}

/** Temporada completa (regular + playoffs), paginada. */
export async function fetchNbaSeasonMatches(supabase: any): Promise<NbaStatsMatch[]> {
  const rows = await fetchAllRows((from, to) => supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_score, away_score, status, kickoff_time, phase, period_scores')
    .eq('competition_id', NBA_COMPETITION_ID)
    .order('kickoff_time', { ascending: true })
    .range(from, to))
  return rows as NbaStatsMatch[]
}

/** Predicciones resueltas del modelo nba-1.0, paginadas. */
export async function fetchNbaResolvedPredictions(supabase: any) {
  const rows = await fetchAllRows((from, to) => supabase
    .from('predictions')
    .select('home_win_probability, away_win_probability, was_correct, confidence_score, match:matches!inner(competition_id)')
    .eq('match.competition_id', NBA_COMPETITION_ID)
    .not('was_correct', 'is', null)
    .range(from, to))
  return rows as {
    home_win_probability: number
    away_win_probability: number
    was_correct: boolean | null
    confidence_score: number | null
  }[]
}
