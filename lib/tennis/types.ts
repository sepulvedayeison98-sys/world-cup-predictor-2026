/**
 * DOMINIO TENNIS — tipos del dominio (espejo del schema tennis_* de la
 * migración 053). Fuente de verdad tipada para servicios, motor y UI.
 * Sin lógica: solo contratos de datos.
 */
import type { Tour, Surface } from './constants'

export interface TennisPlayer {
  id: string
  tour: Tour
  external_id: string | null
  name: string
  country_code: string | null
  birthdate: string | null      // ISO date; la edad se deriva al mostrar
  plays_hand: 'R' | 'L' | null
  height_cm: number | null
  elo_rating: number
}

export interface TennisRanking {
  id: string
  player_id: string
  ranking_date: string
  position: number
  points: number | null
}

export interface TennisTournament {
  id: string
  tour: Tour
  external_id: string | null
  name: string
  level: string | null          // Grand Slam / Masters 1000 / 500 / 250 / WTA 1000…
  surface: Surface | null
  city: string | null
  country_code: string | null
  draw_size: number | null
  start_date: string | null
  end_date: string | null
  season: string
}

export type TennisMatchStatus =
  | 'scheduled' | 'live' | 'finished' | 'retired' | 'walkover' | 'cancelled'

export interface TennisMatch {
  id: string
  tournament_id: string | null
  round: string | null
  best_of: 3 | 5 | null
  surface: Surface | null
  p1_id: string | null
  p2_id: string | null
  winner_id: string | null
  score: string | null          // tal como lo entrega la fuente ("6-4 3-6 7-6(5)")
  status: TennisMatchStatus
  scheduled_at: string | null
  external_id: string | null
}

export interface TennisMatchStats {
  id: string
  match_id: string
  player_id: string
  aces: number | null
  double_faults: number | null
  serve_points: number | null
  first_serve_in: number | null
  first_serve_won: number | null
  second_serve_won: number | null
  break_points_saved: number | null
  break_points_faced: number | null
  service_games: number | null
  return_games_won: number | null
}

export interface TennisPrediction {
  id: string
  match_id: string
  p1_win_probability: number
  favorite_id: string | null
  confidence_score: number | null
  model_version: string
  features: Record<string, unknown> | null
  was_correct: boolean | null
  resolved_at: string | null
}

export type TennisMarket =
  | 'moneyline'
  | 'over_games' | 'under_games'
  | 'over_sets' | 'under_sets'
  | 'handicap_games' | 'handicap_sets'

export interface TennisSmartBet {
  id: string
  match_id: string
  market: TennisMarket
  line: number | null
  selection_id: string | null
  model_probability: number | null
  odds_value: number | null
  implied_probability: number | null
  edge: number | null
  is_active: boolean
  result: 'pending' | 'won' | 'lost' | 'void'
}

export interface TennisBacktest {
  id: string
  model_version: string
  tour: Tour | null
  date_from: string | null
  date_to: string | null
  sample_size: number
  accuracy: number | null
  brier_score: number | null
  log_loss: number | null
  roi: number | null
  yield: number | null
  metadata: Record<string, unknown> | null
}
