-- ============================================================
-- Migration 057: estadio y año de fundación del equipo
--
-- Fase 1 de la evolución del perfil de equipo (arquitectura de entidades:
-- el equipo como entidad independiente de la competición). API-Football
-- devuelve `venue {name, city, capacity, image}` y `founded` dentro de la
-- MISMA respuesta de /teams que la ingesta de ligas ya pide (2 peticiones
-- por liga, ya pagadas) — hasta ahora se descartaba. Cuota adicional: CERO.
--
-- Entrenador de clubes, presidente y palmarés NO entran en esta migración:
-- no hay fuente verificable en el plan actual (ver HANDOFF §6, "Bloqueado
-- por fuente de datos"). No se fabrican columnas para datos que no se van
-- a poder llenar con datos reales.
-- ============================================================

BEGIN;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS venue_name     TEXT,
  ADD COLUMN IF NOT EXISTS venue_city     TEXT,
  ADD COLUMN IF NOT EXISTS venue_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS venue_image_url TEXT,
  ADD COLUMN IF NOT EXISTS founded_year   SMALLINT;

COMMENT ON COLUMN public.teams.venue_name IS 'Estadio del club, de API-Football /teams (venue.name). NULL para selecciones nacionales.';
COMMENT ON COLUMN public.teams.venue_capacity IS 'Aforo del estadio. NULL si la fuente no lo trae para ese club.';
COMMENT ON COLUMN public.teams.founded_year IS 'Año de fundación del club, de API-Football /teams (founded). NULL para selecciones nacionales.';

COMMIT;

-- Verificación:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='teams' AND column_name IN
--     ('venue_name','venue_city','venue_capacity','venue_image_url','founded_year');
--   -- 5 filas
