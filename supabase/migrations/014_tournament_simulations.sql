-- ============================================================
-- WORLD CUP PREDICTOR — Migration 014: tabla de simulación Monte Carlo
--
-- El feature Monte Carlo (/api/simulate, SimulationResultsWidget,
-- TournamentPathTracker) escribía/leía columnas que no existían. La tabla
-- `simulation_results` (migración 001) es OTRA cosa (what-if por partido,
-- por usuario). Esta tabla nueva guarda las probabilidades por equipo y fase
-- de cada corrida de simulación del torneo.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tournament_simulations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  simulation_run_id UUID NOT NULL,
  group_stage_advance_prob NUMERIC(5,4) NOT NULL DEFAULT 0,
  round_of_16_prob NUMERIC(5,4) NOT NULL DEFAULT 0,
  quarter_final_prob NUMERIC(5,4) NOT NULL DEFAULT 0,
  semi_final_prob NUMERIC(5,4) NOT NULL DEFAULT 0,
  final_prob NUMERIC(5,4) NOT NULL DEFAULT 0,
  winner_prob NUMERIC(5,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_sim_run ON tournament_simulations(simulation_run_id);
CREATE INDEX IF NOT EXISTS idx_tournament_sim_created ON tournament_simulations(created_at DESC);

ALTER TABLE tournament_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_sim_public_read" ON tournament_simulations
  FOR SELECT TO anon, authenticated USING (TRUE);

GRANT SELECT ON tournament_simulations TO anon, authenticated;
GRANT ALL ON tournament_simulations TO service_role;

-- Realtime para que los widgets se actualicen al terminar una corrida
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_simulations;
