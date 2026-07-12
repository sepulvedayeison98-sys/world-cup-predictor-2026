-- ============================================================
-- Migration 053: dominio Tennis — modelo de datos aislado
--
-- Tercer dominio de la plataforma (Fútbol · NBA · Tennis). Aislamiento
-- TOTAL: tablas exclusivas tennis_* — no se reutilizan matches/teams/
-- predictions compartidas. El deporte 'tennis' (id=3) ya existe en
-- `sports` desde la migración 041; aquí se registran las competiciones
-- ATP/WTA (contenedores de temporada, ids deterministas como NBA) y las
-- 9 tablas del dominio, todas con RLS + lectura anon (acceso libre).
--
-- Data First: esta migración NO inserta jugadores, rankings, torneos ni
-- partidos — cero datos fabricados. Los datos reales llegan por los
-- servicios de sync (Fase 4) desde fuentes ATP/WTA verificables.
-- ============================================================

BEGIN;

-- ── Competiciones contenedor (temporada calendario 2026) ─────────────
-- type='league' sigue el precedente de la NBA (048): el enum no se toca.
INSERT INTO competitions (id, name, short_name, type, season, start_date, end_date, is_active, sport_id)
VALUES
  ('20000000-0000-4000-8000-000000000020', 'ATP Tour', 'ATP', 'league', '2026', '2026-01-01', '2026-12-31', false, 3),
  ('21000000-0000-4000-8000-000000000021', 'WTA Tour', 'WTA', 'league', '2026', '2026-01-01', '2026-12-31', false, 3)
ON CONFLICT (id) DO NOTHING;

-- ── 1. Jugadores ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tennis_players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour          TEXT NOT NULL CHECK (tour IN ('ATP','WTA')),
  external_id   TEXT,                    -- id en la fuente de datos (mapeo sync)
  name          TEXT NOT NULL,
  country_code  CHAR(3),                 -- IOC/ISO-3
  birthdate     DATE,                    -- la edad se deriva, no se almacena
  plays_hand    TEXT CHECK (plays_hand IN ('R','L')),
  height_cm     SMALLINT,
  elo_rating    INTEGER NOT NULL DEFAULT 1500,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tour, external_id)
);

-- ── 2. Rankings oficiales (serie temporal) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.tennis_rankings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES tennis_players(id) ON DELETE CASCADE,
  ranking_date  DATE NOT NULL,
  position      INTEGER NOT NULL,
  points        INTEGER,
  UNIQUE (player_id, ranking_date)
);

-- ── 3. Torneos ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tennis_tournaments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour          TEXT NOT NULL CHECK (tour IN ('ATP','WTA')),
  external_id   TEXT,
  name          TEXT NOT NULL,
  level         TEXT,                    -- Grand Slam / Masters 1000 / 500 / 250 / WTA 1000...
  surface       TEXT CHECK (surface IN ('hard','clay','grass','carpet')),
  city          TEXT,
  country_code  CHAR(3),
  draw_size     SMALLINT,
  start_date    DATE,
  end_date      DATE,
  season        TEXT NOT NULL,
  UNIQUE (tour, external_id, season)
);

-- ── 4. Partidos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tennis_matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tennis_tournaments(id) ON DELETE CASCADE,
  round         TEXT,                    -- R128..R16, QF, SF, F, RR
  best_of       SMALLINT CHECK (best_of IN (3,5)),
  surface       TEXT,                    -- desnormalizada del torneo (consultas)
  p1_id         UUID REFERENCES tennis_players(id),
  p2_id         UUID REFERENCES tennis_players(id),
  winner_id     UUID REFERENCES tennis_players(id),
  score         TEXT,                    -- "6-4 3-6 7-6(5)" tal como lo da la fuente
  status        TEXT NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled','live','finished','retired','walkover','cancelled')),
  scheduled_at  TIMESTAMPTZ,
  external_id   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. Estadísticas por partido y jugador ────────────────────────────
CREATE TABLE IF NOT EXISTS public.tennis_match_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID NOT NULL REFERENCES tennis_matches(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES tennis_players(id) ON DELETE CASCADE,
  aces            SMALLINT,
  double_faults   SMALLINT,
  serve_points    SMALLINT,
  first_serve_in  SMALLINT,
  first_serve_won SMALLINT,
  second_serve_won SMALLINT,
  break_points_saved SMALLINT,
  break_points_faced SMALLINT,
  service_games   SMALLINT,
  return_games_won SMALLINT,
  UNIQUE (match_id, player_id)
);

-- ── 6. Predicciones del motor tennis-1.0 ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.tennis_predictions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id           UUID NOT NULL UNIQUE REFERENCES tennis_matches(id) ON DELETE CASCADE,
  p1_win_probability NUMERIC(5,4) NOT NULL CHECK (p1_win_probability BETWEEN 0 AND 1),
  favorite_id        UUID REFERENCES tennis_players(id),
  confidence_score   NUMERIC(5,2),
  model_version      TEXT NOT NULL,
  features           JSONB,              -- snapshot de inputs (tuning fiel, como F0 fútbol)
  was_correct        BOOLEAN,            -- null hasta resolverse
  resolved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 7. Smart Bets Tennis (independiente de fútbol/NBA) ───────────────
CREATE TABLE IF NOT EXISTS public.tennis_smart_bets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID NOT NULL REFERENCES tennis_matches(id) ON DELETE CASCADE,
  market        TEXT NOT NULL CHECK (market IN
                  ('moneyline','over_games','under_games','over_sets','under_sets',
                   'handicap_games','handicap_sets')),
  line          NUMERIC(5,2),            -- p. ej. 21.5 games, -1.5 sets
  selection_id  UUID REFERENCES tennis_players(id),
  model_probability NUMERIC(5,4),
  odds_value    NUMERIC(6,2),
  implied_probability NUMERIC(5,4),
  edge          NUMERIC(5,4),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  result        TEXT NOT NULL DEFAULT 'pending'
                CHECK (result IN ('pending','won','lost','void')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, market, line, selection_id)
);

-- ── 8. Corridas de backtesting ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tennis_backtests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version TEXT NOT NULL,
  tour          TEXT CHECK (tour IN ('ATP','WTA')),
  date_from     DATE,
  date_to       DATE,
  sample_size   INTEGER NOT NULL,
  accuracy      NUMERIC(5,4),
  brier_score   NUMERIC(6,4),
  log_loss      NUMERIC(6,4),
  roi           NUMERIC(6,4),
  yield         NUMERIC(6,4),
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 9. Métricas vivas del modelo ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tennis_model_metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version TEXT NOT NULL,
  tour          TEXT CHECK (tour IN ('ATP','WTA')),
  window_label  TEXT NOT NULL,           -- 'live' | '30d' | 'season'
  sample_size   INTEGER NOT NULL,
  accuracy      NUMERIC(5,4),
  brier_score   NUMERIC(6,4),
  log_loss      NUMERIC(6,4),
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_version, tour, window_label)
);

-- ── Índices de consulta ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tennis_players_tour        ON tennis_players(tour);
CREATE INDEX IF NOT EXISTS idx_tennis_rankings_date       ON tennis_rankings(ranking_date DESC);
CREATE INDEX IF NOT EXISTS idx_tennis_rankings_player     ON tennis_rankings(player_id);
CREATE INDEX IF NOT EXISTS idx_tennis_tournaments_season  ON tennis_tournaments(season, tour);
CREATE INDEX IF NOT EXISTS idx_tennis_matches_tournament  ON tennis_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tennis_matches_status      ON tennis_matches(status);
CREATE INDEX IF NOT EXISTS idx_tennis_matches_scheduled   ON tennis_matches(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tennis_matches_players     ON tennis_matches(p1_id, p2_id);
CREATE INDEX IF NOT EXISTS idx_tennis_stats_match         ON tennis_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_tennis_smart_bets_active   ON tennis_smart_bets(is_active) WHERE is_active;

-- ── RLS: acceso libre = lectura anon; escritura solo service-role ────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tennis_players','tennis_rankings','tennis_tournaments','tennis_matches',
    'tennis_match_stats','tennis_predictions','tennis_smart_bets',
    'tennis_backtests','tennis_model_metrics'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = 'public_read_' || t
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)',
        'public_read_' || t, t
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
