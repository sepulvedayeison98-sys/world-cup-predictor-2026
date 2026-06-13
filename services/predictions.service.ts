import { createClient } from '@/lib/supabase/client'
import type {
  Prediction,
  ExactScorePrediction,
  PredictionHistory,
  ValueBet,
  ValueBetFilters,
  DashboardKPIs,
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

  async getDashboardKPIs(): Promise<DashboardKPIs> {
    const supabase = createClient()

    const [matchesRes, predictionsRes, valueBetsRes] = await Promise.all([
      supabase.from('matches').select('id, status', { count: 'exact' }),
      supabase
        .from('predictions')
        .select('id, was_correct, is_published', { count: 'exact' })
        .eq('is_published', true),
      supabase
        .from('value_bets')
        .select('id, is_active, result, grade', { count: 'exact' })
        .eq('is_active', true),
    ])

    const totalMatches = matchesRes.count ?? 0
    const predictions = predictionsRes.data ?? []
    const totalPredictions = predictions.length
    const correctPredictions = predictions.filter((p) => p.was_correct === true).length
    const historicalAccuracy = totalPredictions > 0 ? correctPredictions / totalPredictions : 0

    const valueBets = valueBetsRes.data ?? []
    const valueBetsDetected = valueBets.length
    const valueBetsWon = valueBets.filter((b) => b.result === 'won').length

    // Analyzed = matches that have a published prediction
    const analyzedRes = await supabase
      .from('predictions')
      .select('match_id', { count: 'exact' })
      .eq('is_published', true)

    return {
      total_matches: totalMatches,
      analyzed_matches: analyzedRes.count ?? 0,
      active_picks: valueBets.filter((b) => b.result === 'pending').length,
      historical_accuracy: historicalAccuracy,
      roi: valueBetsWon > 0 ? ((valueBetsWon / Math.max(valueBetsDetected, 1)) * 100 - 100) : 0,
      correct_predictions: correctPredictions,
      total_predictions: totalPredictions,
      value_bets_detected: valueBetsDetected,
      value_bets_won: valueBetsWon,
      value_bets_pending: valueBets.filter((b) => b.result === 'pending').length,
    }
  },

  /**
   * Core prediction engine — computes probabilities from weighted inputs.
   * Weights must sum to 1.0. Returns normalized probabilities.
   */
  computePrediction(inputs: {
    formScore: number      // 0–1
    squadQuality: number   // 0–1
    playerStatus: number   // 0–1
    advancedStats: number  // 0–1 (xG/xGA ratio)
    tactical: number       // 0–1
    eloAdvantage: number   // 0–1 (normalized ELO delta)
    oddsSignal: number     // 0–1
    motivation: number     // 0–1
    external: number       // 0–1
    h2h: number            // 0–1
  }): { homeWin: number; draw: number; awayWin: number } {
    const weights = {
      form: 0.20,
      squadQuality: 0.15,
      playerStatus: 0.15,
      advancedStats: 0.15,
      tactical: 0.10,
      elo: 0.10,
      odds: 0.05,
      motivation: 0.05,
      external: 0.03,
      h2h: 0.02,
    }

    const homeStrength =
      inputs.formScore * weights.form +
      inputs.squadQuality * weights.squadQuality +
      inputs.playerStatus * weights.playerStatus +
      inputs.advancedStats * weights.advancedStats +
      inputs.tactical * weights.tactical +
      inputs.eloAdvantage * weights.elo +
      inputs.oddsSignal * weights.odds +
      inputs.motivation * weights.motivation +
      inputs.external * weights.external +
      inputs.h2h * weights.h2h

    // Convert strength score to probabilities using logistic model
    const homeWinRaw = homeStrength
    const drawRaw = 0.25 * (1 - Math.abs(homeStrength - 0.5) * 2)
    const awayWinRaw = 1 - homeWinRaw - drawRaw

    // Normalize
    const total = homeWinRaw + drawRaw + Math.max(awayWinRaw, 0.05)
    return {
      homeWin: homeWinRaw / total,
      draw: drawRaw / total,
      awayWin: Math.max(awayWinRaw, 0.05) / total,
    }
  },
}
