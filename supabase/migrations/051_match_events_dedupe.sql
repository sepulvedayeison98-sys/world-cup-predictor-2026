-- ============================================================
-- Migration 051: deduplicar match_events + índice único idempotente
--
-- Bug reportado: la línea de tiempo llegaba duplicada. Causa: dos requests
-- concurrentes a /api/matches/[id]/events (polling en vivo) pasaban ambos el
-- chequeo de "caché vacía" antes de que cualquiera insertara → doble insert.
-- No había constraint que lo impidiera.
--
-- Fix: borrar los duplicados existentes (conservando el id menor) y crear un
-- índice único con NULLS NOT DISTINCT (PG15+) para que un re-insert de los
-- mismos eventos sea idempotente (el sync pasa a upsert ON CONFLICT DO NOTHING).
-- ============================================================

BEGIN;

-- 1. Borrar duplicados exactos, conservando la fila de menor id
DELETE FROM match_events a
USING match_events b
WHERE a.id > b.id
  AND a.match_id     = b.match_id
  AND a.minute       IS NOT DISTINCT FROM b.minute
  AND a.minute_extra IS NOT DISTINCT FROM b.minute_extra
  AND a.type         = b.type
  AND a.player_name  IS NOT DISTINCT FROM b.player_name
  AND a.team_id      IS NOT DISTINCT FROM b.team_id;

-- 2. Índice único que impide reinsertar el mismo evento. NULLS NOT DISTINCT:
--    dos NULL (p. ej. minute_extra o player_name ausentes) cuentan como iguales.
CREATE UNIQUE INDEX IF NOT EXISTS uq_match_events_dedupe
  ON match_events (match_id, minute, minute_extra, type, player_name, team_id)
  NULLS NOT DISTINCT;

COMMIT;
