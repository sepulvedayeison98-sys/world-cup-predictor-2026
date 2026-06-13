-- ============================================================
-- WORLD CUP PREDICTOR — Migration 001: Initial Schema
-- Run this in Supabase SQL Editor or via Supabase CLI
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search

-- ─── Enums ───────────────────────────────────────────────────

CREATE TYPE match_status AS ENUM ('scheduled', 'live', 'finished', 'postponed', 'cancelled');
CREATE TYPE match_phase AS ENUM ('group', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final');
CREATE TYPE player_position AS ENUM ('GK','CB','LB','RB','CDM','CM','CAM','LW','RW','ST','CF');
CREATE TYPE player_status AS ENUM ('available', 'doubt', 'injured', 'suspended');
CREATE TYPE injury_type AS ENUM ('muscular', 'ligament', 'fracture', 'illness', 'suspension', 'other');
CREATE TYPE value_bet_grade AS ENUM ('high', 'medium', 'low', 'none');
CREATE TYPE competition_type AS ENUM ('world_cup', 'champions_league', 'copa_america', 'euro', 'league');
CREATE TYPE form_result AS ENUM ('W', 'D', 'L');
CREATE TYPE odds_market AS ENUM (
  'home_win', 'draw', 'away_win',
  'over_0_5', 'over_1_5', 'over_2_5', 'over_3_5',
  'btts_yes', 'btts_no',
  'clean_sheet_home', 'clean_sheet_away'
);
CREATE TYPE bet_result AS ENUM ('won', 'lost', 'void', 'pending');
CREATE TYPE simulation_trigger AS ENUM ('lineup_update', 'injury_update', 'odds_movement', 'manual', 'scheduled');
CREATE TYPE confederation AS ENUM ('UEFA', 'CONMEBOL', 'CAF', 'AFC', 'CONCACAF', 'OFC');

-- ─── Users (extends Supabase Auth) ───────────────────────────

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'analyst', 'user')),
  preferences JSONB DEFAULT '{"theme":"dark","notifications":true,"defaultCompetition":null}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Competitions ─────────────────────────────────────────────

CREATE TABLE public.competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  type competition_type NOT NULL,
  season TEXT NOT NULL, -- '2026', '2025-26', etc.
  country TEXT,
  logo_url TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, season)
);

-- ─── Groups ───────────────────────────────────────────────────

CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'Group A'
  letter CHAR(1) NOT NULL, -- 'A'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, letter)
);

-- ─── Teams ────────────────────────────────────────────────────

CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  code CHAR(3) NOT NULL, -- BRA, MAR
  logo_url TEXT,
  flag_url TEXT,
  confederation confederation NOT NULL,
  fifa_ranking INTEGER NOT NULL DEFAULT 0,
  elo_rating INTEGER NOT NULL DEFAULT 1500,
  coach TEXT,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(code, competition_id)
);

-- ─── Team Statistics ──────────────────────────────────────────

CREATE TABLE public.team_statistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  matches_played INTEGER NOT NULL DEFAULT 0,
  goals_scored INTEGER NOT NULL DEFAULT 0,
  goals_conceded INTEGER NOT NULL DEFAULT 0,
  clean_sheets INTEGER NOT NULL DEFAULT 0,
  avg_goals_scored NUMERIC(4,2) NOT NULL DEFAULT 0,
  avg_goals_conceded NUMERIC(4,2) NOT NULL DEFAULT 0,
  avg_possession NUMERIC(4,1) NOT NULL DEFAULT 50,
  avg_shots NUMERIC(4,1) NOT NULL DEFAULT 0,
  avg_shots_on_target NUMERIC(4,1) NOT NULL DEFAULT 0,
  avg_corners NUMERIC(4,1) NOT NULL DEFAULT 0,
  avg_yellow_cards NUMERIC(4,2) NOT NULL DEFAULT 0,
  avg_red_cards NUMERIC(4,2) NOT NULL DEFAULT 0,
  avg_xg NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_xga NUMERIC(5,2) NOT NULL DEFAULT 0,
  form form_result[] DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, competition_id)
);

-- ─── Group Standings ─────────────────────────────────────────

CREATE TABLE public.group_standings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  drawn INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  goal_difference INTEGER GENERATED ALWAYS AS (goals_for - goals_against) STORED,
  points INTEGER GENERATED ALWAYS AS (won * 3 + drawn) STORED,
  qualification_probability NUMERIC(5,2) NOT NULL DEFAULT 0,
  top_spot_probability NUMERIC(5,2) NOT NULL DEFAULT 0,
  form form_result[] DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, team_id)
);

-- ─── Players ──────────────────────────────────────────────────

CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  number INTEGER NOT NULL,
  position player_position NOT NULL,
  nationality TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  height_cm INTEGER,
  weight_kg INTEGER,
  photo_url TEXT,
  club_name TEXT,
  market_value_euros BIGINT,
  status player_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, number)
);

-- ─── Player Statistics ────────────────────────────────────────

CREATE TABLE public.player_statistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  matches_played INTEGER NOT NULL DEFAULT 0,
  minutes_played INTEGER NOT NULL DEFAULT 0,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  shots INTEGER NOT NULL DEFAULT 0,
  shots_on_target INTEGER NOT NULL DEFAULT 0,
  key_passes INTEGER NOT NULL DEFAULT 0,
  dribbles_completed INTEGER NOT NULL DEFAULT 0,
  tackles INTEGER NOT NULL DEFAULT 0,
  interceptions INTEGER NOT NULL DEFAULT 0,
  yellow_cards INTEGER NOT NULL DEFAULT 0,
  red_cards INTEGER NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3,1) NOT NULL DEFAULT 0,
  form_score NUMERIC(3,1) NOT NULL DEFAULT 0,
  physical_condition INTEGER NOT NULL DEFAULT 100 CHECK (physical_condition BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, competition_id)
);

-- ─── Matches ─────────────────────────────────────────────────

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  phase match_phase NOT NULL,
  match_number INTEGER NOT NULL,
  status match_status NOT NULL DEFAULT 'scheduled',
  home_team_id UUID NOT NULL REFERENCES teams(id),
  away_team_id UUID NOT NULL REFERENCES teams(id),
  home_score INTEGER,
  away_score INTEGER,
  home_score_ht INTEGER,
  away_score_ht INTEGER,
  kickoff_time TIMESTAMPTZ NOT NULL,
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  referee TEXT,
  attendance INTEGER,
  weather_condition TEXT,
  weather_temp_celsius INTEGER,
  home_rest_days INTEGER,
  away_rest_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (home_team_id <> away_team_id),
  UNIQUE(competition_id, match_number)
);

-- ─── Match Statistics ─────────────────────────────────────────

CREATE TABLE public.match_statistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  possession NUMERIC(4,1),
  shots INTEGER DEFAULT 0,
  shots_on_target INTEGER DEFAULT 0,
  corners INTEGER DEFAULT 0,
  fouls INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  offsides INTEGER DEFAULT 0,
  passes INTEGER DEFAULT 0,
  pass_accuracy NUMERIC(4,1),
  xg NUMERIC(5,2),
  xga NUMERIC(5,2),
  big_chances INTEGER DEFAULT 0,
  big_chances_missed INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, team_id)
);

-- ─── Lineups ─────────────────────────────────────────────────

CREATE TABLE public.lineups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  formation TEXT NOT NULL DEFAULT '4-3-3',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, team_id)
);

CREATE TABLE public.lineup_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lineup_id UUID NOT NULL REFERENCES lineups(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position player_position NOT NULL,
  grid_x INTEGER NOT NULL CHECK (grid_x BETWEEN 1 AND 5),
  grid_y INTEGER NOT NULL CHECK (grid_y BETWEEN 1 AND 11),
  is_captain BOOLEAN NOT NULL DEFAULT FALSE,
  is_starter BOOLEAN NOT NULL DEFAULT TRUE,
  substituted_at INTEGER, -- minute
  substituted_by UUID REFERENCES players(id),
  UNIQUE(lineup_id, player_id)
);

-- ─── Injuries ─────────────────────────────────────────────────

CREATE TABLE public.injuries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  injury_type injury_type NOT NULL,
  description TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_return DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  impact_score NUMERIC(3,1) NOT NULL DEFAULT 5 CHECK (impact_score BETWEEN 0 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Predictions ─────────────────────────────────────────────

CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  home_win_probability NUMERIC(5,4) NOT NULL CHECK (home_win_probability BETWEEN 0 AND 1),
  draw_probability NUMERIC(5,4) NOT NULL CHECK (draw_probability BETWEEN 0 AND 1),
  away_win_probability NUMERIC(5,4) NOT NULL CHECK (away_win_probability BETWEEN 0 AND 1),
  predicted_home_score INTEGER NOT NULL DEFAULT 0,
  predicted_away_score INTEGER NOT NULL DEFAULT 0,
  confidence_level SMALLINT NOT NULL CHECK (confidence_level BETWEEN 1 AND 5),
  confidence_score NUMERIC(5,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  model_version TEXT NOT NULL DEFAULT '1.0.0',
  -- model weights used
  form_weight NUMERIC(3,2) NOT NULL DEFAULT 0.20,
  squad_quality_weight NUMERIC(3,2) NOT NULL DEFAULT 0.15,
  player_status_weight NUMERIC(3,2) NOT NULL DEFAULT 0.15,
  advanced_stats_weight NUMERIC(3,2) NOT NULL DEFAULT 0.15,
  tactical_weight NUMERIC(3,2) NOT NULL DEFAULT 0.10,
  elo_weight NUMERIC(3,2) NOT NULL DEFAULT 0.10,
  odds_weight NUMERIC(3,2) NOT NULL DEFAULT 0.05,
  motivation_weight NUMERIC(3,2) NOT NULL DEFAULT 0.05,
  external_factors_weight NUMERIC(3,2) NOT NULL DEFAULT 0.03,
  h2h_weight NUMERIC(3,2) NOT NULL DEFAULT 0.02,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  was_correct BOOLEAN,
  actual_outcome TEXT CHECK (actual_outcome IN ('home', 'draw', 'away')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- probabilities must sum to ~1
  CONSTRAINT probabilities_sum CHECK (
    ABS(home_win_probability + draw_probability + away_win_probability - 1) < 0.001
  ),
  UNIQUE(match_id) -- one active prediction per match
);

-- ─── Exact Score Predictions ──────────────────────────────────

CREATE TABLE public.exact_score_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  probability NUMERIC(5,4) NOT NULL,
  rank SMALLINT NOT NULL CHECK (rank BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prediction_id, rank)
);

-- ─── Prediction History ───────────────────────────────────────

CREATE TABLE public.prediction_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  home_win_probability NUMERIC(5,4) NOT NULL,
  draw_probability NUMERIC(5,4) NOT NULL,
  away_win_probability NUMERIC(5,4) NOT NULL,
  confidence_score NUMERIC(5,2) NOT NULL,
  trigger simulation_trigger NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Odds ─────────────────────────────────────────────────────

CREATE TABLE public.odds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  bookmaker TEXT NOT NULL,
  market odds_market NOT NULL,
  odds_value NUMERIC(6,2) NOT NULL CHECK (odds_value > 1),
  implied_probability NUMERIC(5,4) NOT NULL,
  margin NUMERIC(5,4),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Value Bets ───────────────────────────────────────────────

CREATE TABLE public.value_bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  market odds_market NOT NULL,
  bookmaker TEXT NOT NULL,
  odds_value NUMERIC(6,2) NOT NULL,
  implied_probability NUMERIC(5,4) NOT NULL,
  model_probability NUMERIC(5,4) NOT NULL,
  expected_value NUMERIC(6,4) NOT NULL, -- (model_prob * odds) - 1
  edge NUMERIC(5,4) NOT NULL, -- model_prob - implied_prob
  grade value_bet_grade NOT NULL,
  stake_suggestion_percent NUMERIC(4,2), -- Kelly criterion
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  result bet_result NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Simulation Results ───────────────────────────────────────

CREATE TABLE public.simulation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  input JSONB NOT NULL,
  home_win_probability NUMERIC(5,4) NOT NULL,
  draw_probability NUMERIC(5,4) NOT NULL,
  away_win_probability NUMERIC(5,4) NOT NULL,
  predicted_home_score INTEGER NOT NULL,
  predicted_away_score INTEGER NOT NULL,
  confidence_score NUMERIC(5,2) NOT NULL,
  top_scorelines JSONB NOT NULL DEFAULT '[]'::jsonb,
  delta_vs_base JSONB NOT NULL DEFAULT '{}'::jsonb,
  scenario_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_matches_competition ON matches(competition_id);
CREATE INDEX idx_matches_kickoff ON matches(kickoff_time);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_home_team ON matches(home_team_id);
CREATE INDEX idx_matches_away_team ON matches(away_team_id);
CREATE INDEX idx_matches_group ON matches(group_id);
CREATE INDEX idx_matches_phase ON matches(phase);

CREATE INDEX idx_predictions_match ON predictions(match_id);
CREATE INDEX idx_predictions_published ON predictions(is_published) WHERE is_published = TRUE;
CREATE INDEX idx_prediction_history_match ON prediction_history(match_id);
CREATE INDEX idx_prediction_history_snapshot ON prediction_history(snapshot_at);

CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_players_position ON players(position);
CREATE INDEX idx_players_status ON players(status);
CREATE INDEX idx_players_name_trgm ON players USING gin(name gin_trgm_ops);

CREATE INDEX idx_teams_competition ON teams(competition_id);
CREATE INDEX idx_teams_group ON teams(group_id);
CREATE INDEX idx_teams_code ON teams(code);

CREATE INDEX idx_odds_match ON odds(match_id);
CREATE INDEX idx_odds_market ON odds(market);
CREATE INDEX idx_odds_bookmaker ON odds(bookmaker);
CREATE INDEX idx_odds_recorded ON odds(recorded_at);

CREATE INDEX idx_value_bets_match ON value_bets(match_id);
CREATE INDEX idx_value_bets_grade ON value_bets(grade);
CREATE INDEX idx_value_bets_active ON value_bets(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_value_bets_ev ON value_bets(expected_value DESC);

CREATE INDEX idx_injuries_player ON injuries(player_id);
CREATE INDEX idx_injuries_active ON injuries(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_injuries_team ON injuries(team_id);

CREATE INDEX idx_group_standings_group ON group_standings(group_id);
CREATE INDEX idx_group_standings_points ON group_standings(points DESC);

CREATE INDEX idx_simulation_user ON simulation_results(user_id);
CREATE INDEX idx_simulation_match ON simulation_results(match_id);

-- Full text search on matches
CREATE INDEX idx_matches_venue_trgm ON matches USING gin(venue gin_trgm_ops);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_competitions BEFORE UPDATE ON competitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_teams BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_players BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_matches BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_predictions BEFORE UPDATE ON predictions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_lineups BEFORE UPDATE ON lineups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_injuries BEFORE UPDATE ON injuries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_value_bets BEFORE UPDATE ON value_bets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_team_statistics BEFORE UPDATE ON team_statistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_player_statistics BEFORE UPDATE ON player_statistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_group_standings BEFORE UPDATE ON group_standings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineup_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exact_score_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_results ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile, admins read all
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);

-- Public read for competition data (all authenticated users)
CREATE POLICY "competitions_select_authenticated" ON competitions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "competitions_insert_admin" ON competitions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "competitions_update_admin" ON competitions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'analyst'))
);

CREATE POLICY "groups_select_authenticated" ON groups FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "teams_select_authenticated" ON teams FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "team_statistics_select_authenticated" ON team_statistics FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "group_standings_select_authenticated" ON group_standings FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "players_select_authenticated" ON players FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "player_statistics_select_authenticated" ON player_statistics FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "matches_select_authenticated" ON matches FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "match_statistics_select_authenticated" ON match_statistics FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "lineups_select_authenticated" ON lineups FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "lineup_players_select_authenticated" ON lineup_players FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "injuries_select_authenticated" ON injuries FOR SELECT TO authenticated USING (TRUE);

-- Only published predictions visible to regular users
CREATE POLICY "predictions_select_authenticated" ON predictions FOR SELECT TO authenticated USING (
  is_published = TRUE
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'analyst'))
);
CREATE POLICY "exact_scores_select_authenticated" ON exact_score_predictions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "prediction_history_select_authenticated" ON prediction_history FOR SELECT TO authenticated USING (TRUE);

-- Odds and value bets: all authenticated can read
CREATE POLICY "odds_select_authenticated" ON odds FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "value_bets_select_authenticated" ON value_bets FOR SELECT TO authenticated USING (TRUE);

-- Simulations: users see only their own
CREATE POLICY "simulations_select_own" ON simulation_results FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "simulations_insert_own" ON simulation_results FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Admin write policies (apply to several tables)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['teams','players','matches','lineups','lineup_players','injuries','team_statistics','player_statistics','group_standings','match_statistics','predictions','exact_score_predictions','prediction_history','odds','value_bets'] LOOP
    EXECUTE format(
      'CREATE POLICY "%s_write_admin" ON %s FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN (''admin'', ''analyst''))
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN (''admin'', ''analyst''))
      );', tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Recalculate group standings after match result
CREATE OR REPLACE FUNCTION recalculate_group_standings(p_group_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Reset standings for this group
  UPDATE group_standings
  SET played = 0, won = 0, drawn = 0, lost = 0,
      goals_for = 0, goals_against = 0, form = '{}'
  WHERE group_id = p_group_id;

  -- Recalculate from finished matches
  WITH match_results AS (
    SELECT
      m.home_team_id AS team_id,
      m.home_score AS gf,
      m.away_score AS ga,
      CASE
        WHEN m.home_score > m.away_score THEN 'W'::form_result
        WHEN m.home_score = m.away_score THEN 'D'::form_result
        ELSE 'L'::form_result
      END AS result
    FROM matches m
    WHERE m.group_id = p_group_id AND m.status = 'finished'
    UNION ALL
    SELECT
      m.away_team_id,
      m.away_score,
      m.home_score,
      CASE
        WHEN m.away_score > m.home_score THEN 'W'::form_result
        WHEN m.away_score = m.home_score THEN 'D'::form_result
        ELSE 'L'::form_result
      END
    FROM matches m
    WHERE m.group_id = p_group_id AND m.status = 'finished'
  ),
  aggregated AS (
    SELECT
      team_id,
      COUNT(*) AS played,
      COUNT(*) FILTER (WHERE result = 'W') AS won,
      COUNT(*) FILTER (WHERE result = 'D') AS drawn,
      COUNT(*) FILTER (WHERE result = 'L') AS lost,
      SUM(gf) AS goals_for,
      SUM(ga) AS goals_against,
      array_agg(result ORDER BY result) AS form
    FROM match_results
    GROUP BY team_id
  )
  UPDATE group_standings gs
  SET
    played = a.played,
    won = a.won,
    drawn = a.drawn,
    lost = a.lost,
    goals_for = a.goals_for,
    goals_against = a.goals_against,
    form = a.form
  FROM aggregated a
  WHERE gs.team_id = a.team_id AND gs.group_id = p_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-trigger standings recalculation on match update
CREATE OR REPLACE FUNCTION trigger_standings_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'finished' AND NEW.group_id IS NOT NULL THEN
    PERFORM recalculate_group_standings(NEW.group_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER match_standings_update
AFTER UPDATE OF status ON matches
FOR EACH ROW EXECUTE FUNCTION trigger_standings_update();

-- Snapshot prediction history on probability change
CREATE OR REPLACE FUNCTION snapshot_prediction()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.home_win_probability <> NEW.home_win_probability
  OR OLD.draw_probability <> NEW.draw_probability
  OR OLD.away_win_probability <> NEW.away_win_probability THEN
    INSERT INTO prediction_history (
      prediction_id, match_id, home_win_probability,
      draw_probability, away_win_probability, confidence_score, trigger
    ) VALUES (
      NEW.id, NEW.match_id, NEW.home_win_probability,
      NEW.draw_probability, NEW.away_win_probability,
      NEW.confidence_score, 'manual'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prediction_snapshot
AFTER UPDATE ON predictions
FOR EACH ROW EXECUTE FUNCTION snapshot_prediction();
