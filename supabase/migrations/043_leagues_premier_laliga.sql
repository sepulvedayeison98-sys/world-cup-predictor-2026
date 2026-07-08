-- ============================================================
-- Migration 043: Fase 4 — Premier League y La Liga (opción A aprobada)
--
-- Prepara la ingesta desde API-Football:
--   1. Valor 'league' en el enum match_phase (partidos de liga no
--      tienen fase eliminatoria).
--   2. Columna api_football_id en teams y matches: clave externa
--      idempotente para upserts del collector (los datos del Mundial
--      quedan con NULL, permitido por los índices únicos).
--   3. Competiciones Premier League y La Liga (temporada 2024-25,
--      la más reciente del plan Free) + sus filas en seasons.
--
-- Todo aditivo. Las vistas del Mundial ya filtran por competition_id
-- (auditado 2026-07-08: services y páginas, sin fugas).
--
-- NOTA de aplicación: el ALTER TYPE debe ejecutarse en una llamada
-- SEPARADA y ANTES del resto (un valor de enum nuevo no puede usarse
-- en la misma transacción que lo crea).
-- ============================================================

ALTER TYPE match_phase ADD VALUE IF NOT EXISTS 'league';

-- ─── Resto (segunda llamada) ─────────────────────────────────

BEGIN;

ALTER TABLE public.teams   ADD COLUMN IF NOT EXISTS api_football_id INTEGER;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS api_football_id INTEGER;

-- Únicos no-parciales: los NULL (datos del Mundial/amistosos) no chocan.
CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_apifootball
  ON public.teams (competition_id, api_football_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_apifootball
  ON public.matches (api_football_id);

INSERT INTO public.competitions
  (id, name, short_name, type, season, country, start_date, end_date, is_active, sport_id)
VALUES
  ('39000000-0000-4000-8000-000000000039', 'Premier League', 'PL',  'league',
   '2024-25', 'Inglaterra', '2024-08-16', '2025-05-25', FALSE,
   (SELECT id FROM public.sports WHERE slug = 'football')),
  ('14000000-0000-4000-8000-000000000140', 'La Liga', 'LAL', 'league',
   '2024-25', 'España', '2024-08-15', '2025-05-25', FALSE,
   (SELECT id FROM public.sports WHERE slug = 'football'))
ON CONFLICT (name, season) DO NOTHING;

INSERT INTO public.seasons (competition_id, year_start, year_end, label)
VALUES
  ('39000000-0000-4000-8000-000000000039', 2024, 2025, '2024-25'),
  ('14000000-0000-4000-8000-000000000140', 2024, 2025, '2024-25')
ON CONFLICT (competition_id, label) DO NOTHING;

COMMIT;

-- Verificación:
--   SELECT name, season FROM competitions WHERE type='league';
--   SELECT unnest(enum_range(NULL::match_phase));  -- incluye 'league'
