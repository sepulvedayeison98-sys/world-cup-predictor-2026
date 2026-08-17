import { createClient } from '@/lib/supabase/client'
import { activeCompetitionIdsOfSport } from '@/lib/sports'
import type { Match, MatchFilters, PaginatedResponse, MatchStatistics, Lineup } from '@/types'

const PAGE_SIZE = 15

// UUID v4 (para validar ids que vienen de la URL antes de usarlos en un filtro).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Limpia texto de búsqueda antes de inyectarlo en un filtro PostgREST `.or()`:
// quita los caracteres con significado en la sintaxis de filtros (coma,
// paréntesis, asterisco, dos puntos, %, backslash) y acota la longitud.
function sanitizeSearch(s: string): string {
  return s.replace(/[,()*:%\\]/g, ' ').trim().slice(0, 60)
}

/**
 * Competiciones que ve una consulta de agenda. Sin acotar son las ACTIVAS de
 * fútbol: el Mundial pasó a histórico y dejar aquí su id como valor por
 * defecto vaciaba la agenda: ese torneo no tiene un solo partido programado.
 * Regla de oro multi-competición: siempre se filtra, nunca se consulta suelto.
 */
function competitionScope(filters: MatchFilters): string[] {
  const active = activeCompetitionIdsOfSport('futbol')
  // `competition_id` llega de la URL: se acepta solo si es un UUID conocido.
  // Un valor inventado no acota a nada — devuelve el ámbito completo en vez
  // de una consulta con sintaxis de filtro colada dentro.
  if (filters.competition_id && UUID_RE.test(filters.competition_id)) {
    return active.includes(filters.competition_id) ? [filters.competition_id] : active
  }
  if (filters.competition_ids?.length) {
    return filters.competition_ids.filter((id) => UUID_RE.test(id))
  }
  return active
}

export const matchesService = {
  async getMatchesWithPredictions(
    filters: MatchFilters & { min_confidence?: number } = {},
    page = 1,
    pageSize = PAGE_SIZE
  ): Promise<PaginatedResponse<Match & { prediction: any }>> {
    const supabase = createClient()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Con min_confidence el join a predictions debe ser INNER y el filtro va
    // en la query: filtrar despues de paginar rompia el count y las paginas.
    const predCols = 'id,home_win_probability,draw_probability,away_win_probability,predicted_home_score,predicted_away_score,confidence_level,confidence_score'
    const predJoin = filters.min_confidence ? `predictions!inner(${predCols})` : `predictions(${predCols})`

    let query = supabase
      .from('matches')
      .select(
        `*, home_team:teams!matches_home_team_id_fkey(id,name,short_name,code,fifa_ranking,elo_rating,logo_url,team_statistics(matches_played)), away_team:teams!matches_away_team_id_fkey(id,name,short_name,code,fifa_ranking,elo_rating,logo_url,team_statistics(matches_played)), ${predJoin}`,
        { count: 'exact' }
      )
      .in('competition_id', competitionScope(filters))
      .range(from, to)
      .order('kickoff_time', { ascending: true })

    if (filters.min_confidence) query = query.gte('predictions.confidence_level', filters.min_confidence)
    if (filters.status?.length) query = query.in('status', filters.status)
    if (filters.phase?.length) query = query.in('phase', filters.phase)
    if (filters.group_id) query = query.eq('group_id', filters.group_id)
    if (filters.date_from) query = query.gte('kickoff_time', filters.date_from)
    if (filters.date_to) query = query.lte('kickoff_time', filters.date_to)
    if (filters.team_id && UUID_RE.test(filters.team_id)) query = query.or(`home_team_id.eq.${filters.team_id},away_team_id.eq.${filters.team_id}`)
    if (filters.search) {
      const s = sanitizeSearch(filters.search)
      if (s) query = query.or(`venue.ilike.%${s}%,city.ilike.%${s}%`)
    }

    const { data, count, error } = await query
    if (error) throw error

    const rows = (data ?? []).map((m: any) => ({
      ...m,
      // PostgREST devuelve `predictions` como OBJETO (relacion 1-a-1 por
      // UNIQUE(match_id)), no como array. Manejamos ambos casos.
      prediction: Array.isArray(m.predictions) ? (m.predictions[0] ?? null) : (m.predictions ?? null),
    }))

    return { data: rows, count: count ?? 0, page, page_size: pageSize, total_pages: Math.ceil((count ?? 0) / pageSize) }
  },

  async getMatches(filters: MatchFilters = {}, page = 1, pageSize = PAGE_SIZE): Promise<PaginatedResponse<Match>> {
    const supabase = createClient()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('matches')
      .select(`*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)`, { count: 'exact' })
      .in('competition_id', competitionScope(filters))
      .range(from, to)
      .order('kickoff_time', { ascending: true })

    if (filters.status?.length) query = query.in('status', filters.status)
    if (filters.group_id) query = query.eq('group_id', filters.group_id)
    if (filters.team_id && UUID_RE.test(filters.team_id)) query = query.or(`home_team_id.eq.${filters.team_id},away_team_id.eq.${filters.team_id}`)

    const { data, count, error } = await query
    if (error) throw error

    return { data: (data as Match[]) ?? [], count: count ?? 0, page, page_size: pageSize, total_pages: Math.ceil((count ?? 0) / pageSize) }
  },

  async getMatchById(id: string): Promise<any | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('matches')
      .select(`*, home_team:teams!matches_home_team_id_fkey(*, team_statistics(*)), away_team:teams!matches_away_team_id_fkey(*, team_statistics(*)), predictions(*), match_statistics(*)`)
      .eq('id', id)
      .single()

    if (error) return null
    return data
  },

  async getMatchStatistics(matchId: string): Promise<MatchStatistics[]> {
    const supabase = createClient()
    const { data, error } = await supabase.from('match_statistics').select('*').eq('match_id', matchId)
    if (error) throw error
    return (data as MatchStatistics[]) ?? []
  },

  async getMatchLineups(matchId: string): Promise<any[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('lineups')
      .select(`*, players:lineup_players(*, player:players(*))`)
      .eq('match_id', matchId)
    if (error) throw error
    return data ?? []
  },

  async getUpcomingMatches(limit = 5): Promise<any[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('matches')
      .select(`*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*), predictions(*)`)
      .in('competition_id', competitionScope({}))
      .in('status', ['scheduled', 'live'])
      .gte('kickoff_time', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
      .order('kickoff_time', { ascending: true })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async getLiveMatches(): Promise<any[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('matches')
      .select(`*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)`)
      .in('competition_id', competitionScope({}))
      .eq('status', 'live')
      .order('kickoff_time', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async getPredictionHistory(matchId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('prediction_history')
      .select('*')
      .eq('match_id', matchId)
      .order('snapshot_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },
}
