-- ============================================================
-- Migration 048: núcleo NBA (primer deporte no-fútbol)
--
-- La arquitectura multideporte (migración 041: sports/seasons/
-- competitions.sport_id) ya estaba lista. Esta migración adapta las
-- tablas compartidas para baloncesto SIN romper nada del fútbol:
--
--   1. teams.confederation → nullable (los equipos NBA no tienen
--      confederación FIFA). Las filas de fútbol conservan su valor.
--   2. teams.conference / teams.division → clasificación NBA
--      (Este/Oeste + división), nullable para el resto de deportes.
--   3. match_phase += 'regular_season', 'playoffs' (fases NBA).
--   4. Competición NBA (sport_id=basketball) + temporada 2024-25.
--
-- Los equipos y el calendario los carga services/sync/nba-ingest.ts
-- desde API-Basketball (liga 12; el plan Free cubre 2024-2025).
--
-- NOTA: los ALTER TYPE ADD VALUE van en llamadas separadas y antes del
-- resto (un valor de enum nuevo no puede usarse en su misma transacción).
-- ============================================================

ALTER TYPE match_phase ADD VALUE IF NOT EXISTS 'regular_season';
ALTER TYPE match_phase ADD VALUE IF NOT EXISTS 'playoffs';

-- ─── Resto (segunda llamada) ─────────────────────────────────

BEGIN;

ALTER TABLE public.teams ALTER COLUMN confederation DROP NOT NULL;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS conference TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS division TEXT;

-- Los promedios por partido en baloncesto (~113 pts) desbordan NUMERIC(4,2).
-- Se ensanchan a NUMERIC(6,2) — compatible con los valores de fútbol.
ALTER TABLE public.team_statistics ALTER COLUMN avg_goals_scored TYPE NUMERIC(6,2);
ALTER TABLE public.team_statistics ALTER COLUMN avg_goals_conceded TYPE NUMERIC(6,2);

INSERT INTO public.competitions
  (id, name, short_name, type, season, country, start_date, end_date, is_active, sport_id)
VALUES
  ('12000000-0000-4000-8000-000000000012', 'NBA', 'NBA', 'league',
   '2024-25', 'Estados Unidos', '2024-10-22', '2025-06-22', FALSE,
   (SELECT id FROM public.sports WHERE slug = 'basketball'))
ON CONFLICT (name, season) DO NOTHING;

INSERT INTO public.seasons (competition_id, year_start, year_end, label)
VALUES ('12000000-0000-4000-8000-000000000012', 2024, 2025, '2024-25')
ON CONFLICT (competition_id, label) DO NOTHING;

COMMIT;

-- Verificación:
--   SELECT name, sport_id FROM competitions WHERE short_name='NBA';
--   SELECT 'regular_season' IN (SELECT unnest(enum_range(NULL::match_phase))::text);
