-- ============================================================
-- Migration 045: Etapa 5 — completar las 5 grandes ligas
--
-- Suma Serie A, Bundesliga y Ligue 1 (temporada 2024-25, la más
-- reciente del plan Free de API-Football) a las competiciones de la
-- Fase 4. Misma infraestructura de la 043: los UUID codifican el id
-- de liga de API-Football (135, 78, 61).
--
-- Nota: Bundesliga y Ligue 1 tienen 18 equipos (34 jornadas, 306
-- partidos); Serie A tiene 20 (38 jornadas, 380).
-- ============================================================

BEGIN;

INSERT INTO public.competitions
  (id, name, short_name, type, season, country, start_date, end_date, is_active, sport_id)
VALUES
  ('13500000-0000-4000-8000-000000000135', 'Serie A', 'SA', 'league',
   '2024-25', 'Italia', '2024-08-17', '2025-05-25', FALSE,
   (SELECT id FROM public.sports WHERE slug = 'football')),
  ('78000000-0000-4000-8000-000000000078', 'Bundesliga', 'BUN', 'league',
   '2024-25', 'Alemania', '2024-08-23', '2025-05-17', FALSE,
   (SELECT id FROM public.sports WHERE slug = 'football')),
  ('61000000-0000-4000-8000-000000000061', 'Ligue 1', 'L1', 'league',
   '2024-25', 'Francia', '2024-08-16', '2025-05-17', FALSE,
   (SELECT id FROM public.sports WHERE slug = 'football'))
ON CONFLICT (name, season) DO NOTHING;

INSERT INTO public.seasons (competition_id, year_start, year_end, label)
VALUES
  ('13500000-0000-4000-8000-000000000135', 2024, 2025, '2024-25'),
  ('78000000-0000-4000-8000-000000000078', 2024, 2025, '2024-25'),
  ('61000000-0000-4000-8000-000000000061', 2024, 2025, '2024-25')
ON CONFLICT (competition_id, label) DO NOTHING;

COMMIT;

-- Verificación:
--   SELECT name, season FROM competitions WHERE type='league' ORDER BY name;  -- 5 filas
