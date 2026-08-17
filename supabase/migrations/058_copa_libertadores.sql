-- ============================================================
-- Migration 058: Copa Libertadores 2026
--
-- Copa Libertadores NO es una liga (round-robin, leagueEngine.ts):
-- es grupos + eliminación directa a doble partido, como el Mundial.
-- Reutiliza el esquema existente (groups/group_standings/matches.phase)
-- sin cambios de estructura, salvo un valor nuevo de competition_type
-- para no forzarla dentro de 'league' ni de 'champions_league' (que ya
-- está reservado para cuando se integre esa competición, hoy 'próxima'
-- en lib/sports.ts). match_phase YA tiene 'group', 'round_of_16',
-- 'quarter_final', 'semi_final', 'final' — se sembraron para el Mundial.
--
-- NOTA de aplicación: el ALTER TYPE debe ejecutarse en una llamada
-- SEPARADA y ANTES del resto (un valor de enum nuevo no puede usarse
-- en la misma transacción que lo crea).
-- ============================================================

ALTER TYPE competition_type ADD VALUE IF NOT EXISTS 'continental_cup';

-- ─── Resto (segunda llamada) ─────────────────────────────────

BEGIN;

-- Mismo patrón determinista que las ligas: {apiFootballId}{año}-0000-4000-8000-{apiFootballId}.
-- api_football_id de Copa Libertadores = 13.
INSERT INTO public.competitions
  (id, name, short_name, type, season, country, start_date, end_date, is_active, sport_id)
VALUES
  ('13002026-0000-4000-8000-000000000013', 'Copa Libertadores', 'LIB', 'continental_cup',
   '2026', 'Sudamérica', '2026-02-04', '2026-11-30', TRUE,
   (SELECT id FROM public.sports WHERE slug = 'football'))
ON CONFLICT (name, season) DO NOTHING;

INSERT INTO public.seasons (competition_id, year_start, year_end, label)
VALUES
  ('13002026-0000-4000-8000-000000000013', 2026, 2026, '2026')
ON CONFLICT (competition_id, label) DO NOTHING;

COMMIT;

-- Verificación:
--   SELECT name, season, type FROM competitions WHERE type = 'continental_cup';
