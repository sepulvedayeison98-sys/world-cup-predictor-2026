-- ============================================================
-- Migration 044: columna round (jornada) en matches
--
-- Los partidos de liga pertenecen a una jornada real (1..38) que
-- API-Football entrega como "Regular Season - N". match_number no
-- puede guardarla (UNIQUE con competition_id), así que va en su
-- propia columna. NULL para el Mundial/amistosos.
-- ============================================================

BEGIN;

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS round SMALLINT;

CREATE INDEX IF NOT EXISTS idx_matches_competition_round
  ON public.matches (competition_id, round) WHERE round IS NOT NULL;

COMMIT;

-- Verificación (tras re-correr /api/sync/leagues/ingest):
--   SELECT round, count(*) FROM matches
--   WHERE competition_id='39000000-0000-4000-8000-000000000039'
--   GROUP BY round ORDER BY round;  -- 38 jornadas de 10
