-- ============================================================
-- Migration 059: reconciliación de `players` + plantilla/entrenador
-- de Copa Libertadores.
--
-- `players` en producción ya tenía api_football_id, position_raw, age,
-- source y el índice único (team_id, api_football_id) — quedaron aplicados
-- en una sesión anterior sin migración que los registrara (deuda técnica,
-- ver HANDOFF §8). Esta migración documenta ese estado real con
-- IF NOT EXISTS: es un no-op contra producción, pero deja el repo
-- reflejando lo que hay.
--
-- `position_raw` existe precisamente porque API-Football solo da 4
-- categorías (Goalkeeper/Defender/Midfielder/Attacker) y nuestro enum
-- `player_position` pide 11 (GK/CB/LB/RB/CDM/CM/CAM/LW/RW/ST/CF) — mapear
-- "Defender" a "CB" sería inventar una posición táctica que la fuente no
-- da. La ingesta llena `position_raw` con el dato real y deja `position`
-- en NULL en vez de fabricar precisión que no existe.
-- ============================================================

BEGIN;

ALTER TABLE public.players
  ALTER COLUMN short_name DROP NOT NULL,
  ALTER COLUMN number DROP NOT NULL,
  ALTER COLUMN position DROP NOT NULL,
  ALTER COLUMN nationality DROP NOT NULL,
  ALTER COLUMN date_of_birth DROP NOT NULL;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS api_football_id INTEGER,
  ADD COLUMN IF NOT EXISTS position_raw TEXT,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_team_id_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS players_team_api_football_id_key
  ON public.players (team_id, api_football_id);

COMMIT;

-- Verificación:
--   SELECT column_name FROM information_schema.columns WHERE table_name='players' AND column_name IN ('api_football_id','position_raw','age','source');
