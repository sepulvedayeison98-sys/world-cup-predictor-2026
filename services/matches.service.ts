import { createClient } from '@/lib/supabase/client'
import type { Match, MatchFilters, PaginatedResponse, MatchStatistics, Lineup } from '@/types'

const PAGE_SIZE = 15

export const matchesService = {
  async getMatchesWithPredictions(
    filters: MatchFilters & { min_confidence?: number } = {},
    page = 1,
    pageSize = PAGE_SIZE
  ): Promise<PaginatedResponse<Match & { prediction: any }>> {
    const supabase = createClient()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('matches')
      .select(
        `*, home_team:teams!matches_home_team_id_fkey(id,name,short_name,code,fifa_ranking,elo_rating,logo_url), away_team:teams!matches_away_team_id_fkey(id,name,short_name,code,fifa_ranking,elo_rating,logo_url), predictions(id,home_win_probability,draw_probability,away_win_probability,predicted_home_score,predicted_away_score,confidence_level,confidence_score)`,
        { count: 'exact' }
      )
      .range(from, to)
      .order('kickoff_time', { ascending: true })

    if (filters.status?.length) query = query.in('status', filters.status)
    if (filters.phase?.length) query = query.in('phase', filters.phase)
    if (filters.group_id) query = query.eq('group_id', filters.group_id)
    if (filters.date_from) query = query.gte('kickoff_time', filters.date_from)
    if (filters.date_to) query = query.lte('kickoff_time', filters.date_to)
    if (filters.team_id) query = query.or(`home_team_id.eq.${filters.team_id},away_team_id.eq.${filters.team_id}`)
    if (filters.search) query = query.or(`venue.ilike.%${filters.search}%,city.ilike.%${filters.search}%`)

    const { data, count, error } = await query
    if (error) throw error

    const rows = (data ?? []).map((m: any) => ({
      ...m,
      prediction: Array.isArray(m.predictions) ? (m.predictions[0] ?? null) : null,
    }))

    const filtered = filters.min_confidence
      ? rows.filter((r: any) => r.prediction?.confidence_level >= filters.min_confidence!)
      : rows

    return { data: filtered, count: count ?? 0, page, page_size: pageSize, total_pages: Math.ceil((count ?? 0) / pageSize) }
  },

  async getMatches(filters: MatchFilters = {}, page = 1, pageSize = PAGE_SIZE): Promise<PaginatedResponse<Match>> {
    const supabase = createClient()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('matches')
      .select(`*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)`, { count: 'exact' })
      .range(from, to)
      .order('kickoff_time', { ascending: true })

    if (filters.status?.length) query = query.in('status', filters.status)
    if (filters.group_id) query = query.eq('group_id', filters.group_id)
    if (filters.team_id) query = query.or(`home_team_id.eq.${filters.team_id},away_team_id.eq.${filters.team_id}`)

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
