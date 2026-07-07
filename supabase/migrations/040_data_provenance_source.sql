-- ============================================================
-- Migration 040: Procedencia de datos (Semana 1 · Data First)
--
-- Regla #1/#4 del plan aprobado: todo dato visible debe declarar
-- su origen. Primera pieza: columna `source` en las dos tablas
-- donde hoy conviven datos reales con estimados.
--
--   match_statistics.source:
--     'espn'            → boxscore oficial de ESPN
--     'model_estimate'  → derivado del marcador (migraciones 036+)
--   odds.source:
--     'the_odds_api'    → cuota real (Pinnacle vía The Odds API)
--     'derived_pinnacle'→ derivada de la línea justa de Pinnacle
-- ============================================================

BEGIN;

ALTER TABLE public.match_statistics
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'model_estimate';

ALTER TABLE public.odds
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Etiquetar lo existente
UPDATE public.odds SET source = CASE
  WHEN bookmaker = 'Pinnacle' THEN 'the_odds_api'
  ELSE 'derived_pinnacle'
END WHERE source IS NULL;

COMMIT;
