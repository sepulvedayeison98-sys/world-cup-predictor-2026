// ============================================================
// WORLD CUP PREDICTOR — Core TypeScript Types
// ============================================================

// ─── Enums ───────────────────────────────────────────────────

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'
export type MatchPhase = 'group' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place' | 'final' | 'league'
export type PlayerPosition = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST' | 'CF'
export type PlayerStatus = 'available' | 'doubt' | 'injured' | 'suspended'
export type InjuryType = 'muscular' | 'ligament' | 'fracture' | 'illness' | 'suspension' | 'other'
export type ValueBetGrade = 'high' | 'medium' | 'low' | 'none'
export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5
export type CompetitionType = 'world_cup' | 'champions_league' | 'copa_america' | 'euro' | 'league'
export type FormResult = 'W' | 'D' | 'L'
export type OddsMarket =
  | 'home_win'
  | 'draw'
  | 'away_win'
  | 'over_0_5'
  | 'over_1_5'
  | 'over_2_5'
  | 'over_3_5'
  | 'btts_yes'
  | 'btts_no'
  | 'clean_sheet_home'
  | 'clean_sheet_away'

// ─── Competition ─────────────────────────────────────────────

export interface Competition {
  id: string
  name: string
  short_name: string
  type: CompetitionType
  season: string
  country?: string
  logo_url?: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Group ───────────────────────────────────────────────────

export interface Group {
  id: string
  competition_id: string
  name: string // "Group A", "Group B", etc.
  letter: string // "A", "B", etc.
  created_at: string
}

export interface GroupStanding {
  id: string
  group_id: string
  team_id: string
  team: Team
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  qualification_probability: number
  top_spot_probability: number
  form: FormResult[]
  updated_at: string
}

// ─── Team ────────────────────────────────────────────────────

export interface Team {
  id: string
  name: string
  short_name: string
  code: string // BRA, MAR, ARG, etc.
  logo_url?: string
  flag_url?: string
  confederation: 'UEFA' | 'CONMEBOL' | 'CAF' | 'AFC' | 'CONCACAF' | 'OFC'
  fifa_ranking: number
  elo_rating: number
  coach?: string
  competition_id: string
  group_id?: string
  created_at: string
  updated_at: string
}

export interface TeamStatistics {
  id: string
  team_id: string
  competition_id: string
  matches_played: number
  goals_scored: number
  goals_conceded: number
  clean_sheets: number
  avg_goals_scored: number
  avg_goals_conceded: number
  avg_possession: number
  avg_shots: number
  avg_shots_on_target: number
  avg_corners: number
  avg_yellow_cards: number
  avg_red_cards: number
  avg_xg: number
  avg_xga: number
  form: FormResult[] // last 5
  updated_at: string
}

// ─── Player ──────────────────────────────────────────────────

export interface Player {
  id: string
  team_id: string
  team?: Team
  name: string
  short_name: string
  number: number
  position: PlayerPosition
  nationality: string
  date_of_birth: string
  age?: number  // calculado en cliente; no existe en la BD
  height_cm?: number
  weight_kg?: number
  photo_url?: string
  club_name?: string
  market_value_euros?: number
  status: PlayerStatus
  created_at: string
  updated_at: string
}

export interface PlayerStatistics {
  id: string
  player_id: string
  competition_id: string
  player?: Player
  matches_played: number
  minutes_played: number
  goals: number
  assists: number
  shots: number
  shots_on_target: number
  key_passes: number
  dribbles_completed: number
  tackles: number
  interceptions: number
  yellow_cards: number
  red_cards: number
  avg_rating: number
  form_score: number // 0–10 rolling form
  physical_condition: number // 0–100
  updated_at: string
}

// ─── Match ───────────────────────────────────────────────────

export interface Match {
  id: string
  competition_id: string
  group_id?: string
  phase: MatchPhase
  match_number: number
  status: MatchStatus
  home_team_id: string
  away_team_id: string
  home_team?: Team
  away_team?: Team
  home_score?: number
  away_score?: number
  home_score_ht?: number // half time
  away_score_ht?: number
  kickoff_time: string
  venue: string
  city: string
  country: string
  referee?: string
  attendance?: number
  weather_condition?: string
  weather_temp_celsius?: number
  home_rest_days?: number
  away_rest_days?: number
  created_at: string
  updated_at: string
}

export interface MatchStatistics {
  id: string
  match_id: string
  team_id: string
  possession: number
  shots: number
  shots_on_target: number
  corners: number
  fouls: number
  yellow_cards: number
  red_cards: number
  offsides: number
  passes: number
  pass_accuracy: number
  xg: number
  xga: number
  big_chances: number
  big_chances_missed: number
  saves: number
  created_at: string
}

// ─── Lineup ──────────────────────────────────────────────────

export interface Lineup {
  id: string
  match_id: string
  team_id: string
  is_confirmed: boolean // false = probable, true = official
  formation: string // '4-3-3', '4-2-3-1', etc.
  players: LineupPlayer[]
  created_at: string
  updated_at: string
}

export interface LineupPlayer {
  id: string
  lineup_id: string
  player_id: string
  player?: Player
  position: PlayerPosition
  grid_x: number // 1–11 for display
  grid_y: number
  is_captain: boolean
  is_starter: boolean
  substituted_at?: number // minute
  substituted_by?: string // player_id
}

// ─── Injury ──────────────────────────────────────────────────

export interface Injury {
  id: string
  player_id: string
  player?: Player
  team_id: string
  competition_id: string
  injury_type: InjuryType
  description?: string
  reported_at: string
  expected_return?: string
  is_active: boolean
  impact_score: number // 0–10 how much this affects team
  created_at: string
  updated_at: string
}

// ─── Prediction ──────────────────────────────────────────────

export interface Prediction {
  id: string
  match_id: string
  match?: Match
  home_win_probability: number // 0–1
  draw_probability: number
  away_win_probability: number
  predicted_home_score: number
  predicted_away_score: number
  confidence_level: ConfidenceLevel
  confidence_score: number // 0–100
  model_version: string
  // Pesos del modelo de 5 factores usados
  xg_weight: number
  elo_weight: number
  form_weight: number
  market_weight: number
  news_weight: number
  // Metadata
  is_published: boolean
  was_correct?: boolean
  actual_outcome?: 'home' | 'draw' | 'away'
  created_at: string
  updated_at: string
}

export interface ExactScorePrediction {
  id: string
  prediction_id: string
  home_score: number
  away_score: number
  probability: number
  rank: number
  created_at: string
}

export interface PredictionHistory {
  id: string
  prediction_id: string
  match_id: string
  snapshot_at: string
  home_win_probability: number
  draw_probability: number
  away_win_probability: number
  confidence_score: number
  trigger: 'lineup_update' | 'injury_update' | 'odds_movement' | 'manual' | 'scheduled'
  created_at: string
}

// ─── Odds ────────────────────────────────────────────────────

export interface Odds {
  id: string
  match_id: string
  bookmaker: string
  market: OddsMarket
  odds_value: number
  implied_probability: number // 1 / odds
  margin: number // overround
  recorded_at: string
  created_at: string
}

// ─── Value Bet ───────────────────────────────────────────────

export interface ValueBet {
  id: string
  match_id: string
  prediction_id: string
  match?: Match
  prediction?: Prediction
  market: OddsMarket
  bookmaker: string
  odds_value: number
  implied_probability: number
  model_probability: number
  expected_value: number // (model_prob * odds) - 1
  edge: number // model_prob - implied_prob
  grade: ValueBetGrade
  stake_suggestion_percent: number // Kelly fraction
  is_active: boolean
  result?: 'won' | 'lost' | 'void' | 'pending'
  created_at: string
  updated_at: string
}

// ─── Simulation ──────────────────────────────────────────────

export interface SimulationInput {
  match_id: string
  override_home_injuries: string[] // player ids
  override_away_injuries: string[] // player ids
  override_home_formation?: string
  override_away_formation?: string
  override_home_suspensions?: string[]
  override_away_suspensions?: string[]
  weather_override?: string
  scenario_name?: string
}

export interface SimulationResult {
  id: string
  match_id: string
  user_id: string
  input: SimulationInput
  home_win_probability: number
  draw_probability: number
  away_win_probability: number
  predicted_home_score: number
  predicted_away_score: number
  confidence_score: number
  top_scorelines: Array<{ home: number; away: number; probability: number }>
  delta_vs_base: {
    home_win: number
    draw: number
    away_win: number
  }
  created_at: string
}

// ─── Dashboard KPIs ──────────────────────────────────────────

export interface ROIDataPoint {
  date: string
  roi: number
  cumulative_roi: number
  bets_placed: number
}

export interface AccuracyDataPoint {
  phase: string
  accuracy: number
  sample_size: number
}

// ─── API Response wrappers ────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export type ApiResponse<T> = { data: T; error: null } | { data: null; error: ApiError }

// ─── Filter types ────────────────────────────────────────────

export interface MatchFilters {
  status?: MatchStatus[]
  phase?: MatchPhase[]
  group_id?: string
  team_id?: string
  date_from?: string
  date_to?: string
  min_confidence?: number
  search?: string
  /** Por defecto el Mundial 2026; se puede pasar otra para no mezclar torneos. */
  competition_id?: string
}

export interface PlayerFilters {
  team_id?: string
  position?: PlayerPosition[]
  status?: PlayerStatus[]
  search?: string
}

export interface ValueBetFilters {
  grade?: ValueBetGrade[]
  market?: OddsMarket[]
  is_active?: boolean
  min_ev?: number
}
