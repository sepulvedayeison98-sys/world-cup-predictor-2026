import { createClient } from '@/lib/supabase/client'
import type { Team, TeamStatistics, GroupStanding, Player, PlayerStatistics, PlayerFilters } from '@/types'

export const teamsService = {
  async getTeams(competitionId: string): Promise<Team[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('competition_id', competitionId)
      .order('fifa_ranking', { ascending: true })

    if (error) throw error
    return (data as Team[]) ?? []
  },

  async getTeamById(id: string): Promise<Team | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('teams')
      .select('*, team_statistics(*)')
      .eq('id', id)
      .single()

    if (error) return null
    return data as Team
  },

  async getTeamStatistics(teamId: string, competitionId: string): Promise<TeamStatistics | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('team_statistics')
      .select('*')
      .eq('team_id', teamId)
      .eq('competition_id', competitionId)
      .single()

    if (error) return null
    return data as TeamStatistics
  },

  async getGroupStandings(groupId: string): Promise<GroupStanding[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('group_standings')
      .select('*, team:teams(*)')
      .eq('group_id', groupId)
      .order('points', { ascending: false })
      .order('goal_difference', { ascending: false })
      .order('goals_for', { ascending: false })

    if (error) throw error
    return (data as GroupStanding[]) ?? []
  },

  async getAllGroupsWithStandings(competitionId: string) {
    const supabase = createClient()
    const { data: groups, error } = await supabase
      .from('groups')
      .select(
        `
        *,
        group_standings(
          *,
          team:teams(*)
        )
      `
      )
      .eq('competition_id', competitionId)
      .order('letter', { ascending: true })

    if (error) throw error
    return groups ?? []
  },
}

export const playersService = {
  async getPlayers(
    competitionId: string,
    filters: PlayerFilters = {}
  ): Promise<Player[]> {
    const supabase = createClient()
    let query = supabase
      .from('players')
      .select('*, team:teams(*), player_statistics(*)')
      .order('name', { ascending: true })

    if (filters.team_id) {
      query = query.eq('team_id', filters.team_id)
    }
    if (filters.position?.length) {
      query = query.in('position', filters.position)
    }
    if (filters.status?.length) {
      query = query.in('status', filters.status)
    }
    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return (data as Player[]) ?? []
  },

  async getPlayerById(id: string): Promise<Player | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('players')
      .select('*, team:teams(*), player_statistics(*)')
      .eq('id', id)
      .single()

    if (error) return null
    return data as Player
  },

  async getPlayerStatistics(playerId: string, competitionId: string): Promise<PlayerStatistics | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('player_statistics')
      .select('*')
      .eq('player_id', playerId)
      .eq('competition_id', competitionId)
      .single()

    if (error) return null
    return data as PlayerStatistics
  },

  async getInjuredPlayers(competitionId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('injuries')
      .select('*, player:players(*, team:teams(*))')
      .eq('competition_id', competitionId)
      .eq('is_active', true)
      .order('impact_score', { ascending: false })

    if (error) throw error
    return data ?? []
  },
}
