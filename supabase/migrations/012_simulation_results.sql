-- ============================================================
-- Migration 012 — Simulation Results Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.simulation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  simulation_run_id UUID NOT NULL, -- Para agrupar resultados de una misma simulación
  group_stage_advance_prob NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  round_of_16_prob NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  quarter_final_prob NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  semi_final_prob NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  final_prob NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  winner_prob NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (competition_id, team_id, simulation_run_id)
);

ALTER TABLE simulation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read simulation results" ON simulation_results FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE simulation_results;
