-- 020_model_registry.sql
-- Registro histórico de precisión por modelo predictivo.
-- Permite comparar ELO, Poisson, xG, Monte Carlo, Mercado y Ensemble en el tiempo.

CREATE TABLE IF NOT EXISTS model_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name      TEXT NOT NULL,
  version         TEXT NOT NULL DEFAULT '1.0.0',
  predictions_evaluated INT DEFAULT 0,
  correct_predictions   INT DEFAULT 0,
  accuracy_1x2    FLOAT,   -- porcentaje de acierto 1X2
  mae_goals       FLOAT,   -- error absoluto medio en goles esperados
  brier_score     FLOAT,   -- calidad de calibración probabilística (0=perfecto)
  last_evaluated_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(model_name, version)
);

INSERT INTO model_registry (model_name, version) VALUES
  ('elo',         '1.0.0'),
  ('poisson',     '1.0.0'),
  ('xg',          '1.0.0'),
  ('monte_carlo', '1.0.0'),
  ('market',      '1.0.0'),
  ('ensemble',    '2.0.0')
ON CONFLICT (model_name, version) DO NOTHING;

GRANT SELECT ON model_registry TO anon;
-- 021_prediction_audit_log.sql
-- Trazabilidad completa de cada predicción: qué modelos se usaron, con qué datos,
-- qué pesos, qué calidad de dato y qué riesgos se detectaron.

CREATE TABLE IF NOT EXISTS prediction_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id   UUID REFERENCES predictions(id) ON DELETE CASCADE,
  match_id        UUID REFERENCES matches(id) ON DELETE CASCADE,
  triggered_by    TEXT DEFAULT 'manual',  -- 'cron' | 'manual' | 'odds_movement' | 'injury_update'
  model_results   JSONB DEFAULT '{}',     -- { elo: {home,draw,away}, poisson: {...}, ... }
  ensemble_weights JSONB DEFAULT '{}',    -- { xg: 0.40, elo: 0.25, form: 0.15, market: 0.10, news: 0.10 }
  data_quality    JSONB DEFAULT '{}',     -- { score: 87, missing: ['xg'], sources: [...], age_hours: 2 }
  risk_assessment JSONB DEFAULT '{}',     -- { uncertainty: 'high', anomalies: [...] }
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_match_id      ON prediction_audit_log(match_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_prediction_id ON prediction_audit_log(prediction_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at    ON prediction_audit_log(created_at DESC);

GRANT SELECT ON prediction_audit_log TO anon;
-- 022_market_movements.sql
-- Detección de movimientos significativos en cuotas a lo largo del tiempo.
-- Un shift > 5% en probabilidad implícita se marca como significativo.

CREATE TABLE IF NOT EXISTS market_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID REFERENCES matches(id) ON DELETE CASCADE,
  market          TEXT NOT NULL,      -- 'home_win' | 'draw' | 'away_win' | etc.
  bookmaker       TEXT NOT NULL,
  odds_before     FLOAT NOT NULL,
  odds_after      FLOAT NOT NULL,
  prob_shift_pct  FLOAT NOT NULL,     -- variación positiva = cuota baja (equipo sube)
  detected_at     TIMESTAMPTZ DEFAULT now(),
  is_significant  BOOL DEFAULT false  -- |shift| > 5%
);

CREATE INDEX IF NOT EXISTS idx_market_movements_match_id   ON market_movements(match_id);
CREATE INDEX IF NOT EXISTS idx_market_movements_detected   ON market_movements(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_movements_significant ON market_movements(is_significant) WHERE is_significant = true;

GRANT SELECT ON market_movements TO anon;
-- 023_tournament_predictions.sql
-- Predicciones de torneo: goleador, MVP, campeón, máximo amonestado, etc.
-- entity_id puede apuntar a un jugador o un equipo según prediction_type.

CREATE TABLE IF NOT EXISTS tournament_predictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID REFERENCES competitions(id) ON DELETE CASCADE,
  prediction_type TEXT NOT NULL,  -- 'top_scorer' | 'mvp' | 'champion' | 'top_cards' | 'top_corners'
  entity_type     TEXT NOT NULL,  -- 'player' | 'team'
  entity_id       UUID NOT NULL,
  probability     FLOAT NOT NULL CHECK (probability BETWEEN 0 AND 1),
  rank            INT,
  model_version   TEXT DEFAULT '1.0.0',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournament_pred_competition ON tournament_predictions(competition_id);
CREATE INDEX IF NOT EXISTS idx_tournament_pred_type        ON tournament_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_tournament_pred_entity      ON tournament_predictions(entity_id);

GRANT SELECT ON tournament_predictions TO anon;
-- 024_event_simulations.sql
-- Simulaciones evento-por-evento dentro de un partido: distribuciones de goles,
-- corners, tarjetas con percentiles P50/P80/P95.

CREATE TABLE IF NOT EXISTS event_simulations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID REFERENCES matches(id) ON DELETE CASCADE,
  simulation_run_id   UUID NOT NULL DEFAULT gen_random_uuid(),
  iterations          INT NOT NULL DEFAULT 1000,
  goal_distribution   JSONB DEFAULT '{}',    -- { home: {0:0.22,1:0.33,...}, away: {...} }
  corners_distribution JSONB DEFAULT '{}',   -- { total: {7:0.1, 8:0.2, ...} }
  cards_distribution  JSONB DEFAULT '{}',    -- { total: {2:0.3, 3:0.4, ...} }
  p50                 JSONB DEFAULT '{}',    -- { home_goals:1, away_goals:1, corners:9, cards:3 }
  p80                 JSONB DEFAULT '{}',
  p95                 JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_sims_match_id ON event_simulations(match_id);
CREATE INDEX IF NOT EXISTS idx_event_sims_run_id   ON event_simulations(simulation_run_id);

GRANT SELECT ON event_simulations TO anon;
-- 025_data_quality_and_prediction_columns.sql
-- Tabla de snapshots de calidad de datos por partido.
-- Columnas opcionales en predictions para trazabilidad.

CREATE TABLE IF NOT EXISTS data_quality_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id         UUID REFERENCES matches(id) ON DELETE CASCADE,
  quality_score    FLOAT NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  reliability_tier TEXT NOT NULL DEFAULT 'baja',  -- 'excelente' | 'alta' | 'media' | 'baja'
  fields_present   JSONB DEFAULT '{}',  -- { elo: true, xg: false, form: true, odds: true }
  data_age_hours   JSONB DEFAULT '{}',  -- { odds: 1.5, injuries: 24, form: 2 }
  sources_used     TEXT[] DEFAULT '{}',
  snapshot_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_quality_match_id    ON data_quality_snapshots(match_id);
CREATE INDEX IF NOT EXISTS idx_data_quality_snapshot_at ON data_quality_snapshots(snapshot_at DESC);

GRANT SELECT ON data_quality_snapshots TO anon;

-- Nuevas columnas en predictions (opcionales, no rompen nada existente)
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS model_breakdown     JSONB    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS data_quality_score  FLOAT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_data_sources   TEXT[]   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS data_age_hours      FLOAT    DEFAULT NULL;
