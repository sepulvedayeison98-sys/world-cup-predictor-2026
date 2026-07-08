import { createClient } from '@/lib/supabase/client'
import type {
  Prediction,
  ExactScorePrediction,
  PredictionHistory,
  ValueBet,
  ValueBetFilters,
} from '@/types'

export const predictionsService = {
  async getPredictionByMatchId(matchId: string): Promise<Prediction | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('match_id', matchId)
      .eq('is_published', true)
      .single()

    if (error) return null
    return data as Prediction
  },

  async getExactScores(predictionId: string): Promise<ExactScorePrediction[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('exact_score_predictions')
      .select('*')
      .eq('prediction_id', predictionId)
      .order('rank', { ascending: true })

    if (error) throw error
    return (data as ExactScorePrediction[]) ?? []
  },

  async getPredictionHistory(matchId: string): Promise<PredictionHistory[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('prediction_history')
      .select('*')
      .eq('match_id', matchId)
      .order('snapshot_at', { ascending: true })

    if (error) throw error
    return (data as PredictionHistory[]) ?? []
  },

  async getValueBets(filters: ValueBetFilters = {}): Promise<ValueBet[]> {
    const supabase = createClient()
    let query = supabase
      .from('value_bets')
      .select(
        `
        *,
        match:matches(
          *,
          home_team:teams!matches_home_team_id_fkey(*),
          away_team:teams!matches_away_team_id_fkey(*)
        )
      `
      )
      .order('expected_value', { ascending: false })

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }
    if (filters.grade?.length) {
      query = query.in('grade', filters.grade)
    }
    if (filters.market?.length) {
      query = query.in('market', filters.market)
    }
    if (filters.min_ev !== undefined) {
      query = query.gte('expected_value', filters.min_ev)
    }

    const { data, error } = await query
    if (error) throw error
    return (data as ValueBet[]) ?? []
  },

  // getDashboardKPIs se eliminó (2026-07-08): era código muerto sin filtro
  // de competición — el dashboard calcula sus KPIs en app/dashboard/page.tsx.
}
