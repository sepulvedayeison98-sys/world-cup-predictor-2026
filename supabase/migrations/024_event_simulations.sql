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
