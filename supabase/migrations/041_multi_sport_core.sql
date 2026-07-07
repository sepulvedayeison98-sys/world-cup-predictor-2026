-- ============================================================
-- Migration 041: Esquema núcleo multi-deporte (plan §7, Fase 4-prep)
--
-- SIN big-bang: todo es aditivo. Las tablas del Mundial siguen
-- intactas y operando; se añaden:
--   1. sports + competitions.sport_id + seasons  (taxonomía)
--   2. data_provenance                           (Regla #4: trazabilidad)
--   3. data_health                               (Data Health Center)
--   4. jobs                                      (cola de eventos p/ pipelines)
--   5. events_v / participants_v                 (vistas de compatibilidad:
--      la futura capa multi-deporte lee la interfaz genérica desde YA,
--      mientras fútbol sigue escribiendo en matches/teams)
-- ============================================================

BEGIN;

-- ─── 1. Taxonomía de deportes ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sports (
  id   SMALLSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,          -- football · basketball · tennis
  name TEXT NOT NULL
);
INSERT INTO public.sports (slug, name) VALUES
  ('football',   'Fútbol'),
  ('basketball', 'Baloncesto'),
  ('tennis',     'Tenis')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS sport_id SMALLINT REFERENCES public.sports(id);
UPDATE public.competitions
  SET sport_id = (SELECT id FROM public.sports WHERE slug = 'football')
  WHERE sport_id IS NULL;

CREATE TABLE IF NOT EXISTS public.seasons (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  year_start     SMALLINT NOT NULL,
  year_end       SMALLINT NOT NULL,
  label          TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (competition_id, label)
);
INSERT INTO public.seasons (competition_id, year_start, year_end, label)
SELECT id, 2026, 2026, '2026' FROM public.competitions
ON CONFLICT (competition_id, label) DO NOTHING;

-- ─── 2. Trazabilidad por dato (Regla #4) ─────────────────────
CREATE TABLE IF NOT EXISTS public.data_provenance (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity            TEXT NOT NULL,          -- 'match' · 'match_statistics' · 'odds' · 'injury' …
  entity_id         UUID NOT NULL,
  field_scope       TEXT NOT NULL DEFAULT '*',
  source            TEXT NOT NULL,          -- 'espn' · 'the_odds_api' · 'api_football' …
  source_tier       SMALLINT NOT NULL DEFAULT 3,  -- jerarquía de fuentes del plan (1-4)
  endpoint          TEXT,
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence        NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  validation_status TEXT NOT NULL DEFAULT 'single_source',  -- single_source · validated · conflict
  second_source     TEXT,
  validated_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_provenance_entity ON public.data_provenance (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_provenance_source ON public.data_provenance (source, fetched_at DESC);

-- ─── 3. Salud de fuentes (Data Health Center) ────────────────
CREATE TABLE IF NOT EXISTS public.data_health (
  source       TEXT PRIMARY KEY,
  last_ok_at   TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  latency_ms   INTEGER,
  error_rate   NUMERIC(4,3) NOT NULL DEFAULT 0,
  coverage_pct NUMERIC(5,2),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. Cola de trabajos (comunicación entre pipelines) ──────
CREATE TABLE IF NOT EXISTS public.jobs (
  id         BIGSERIAL PRIMARY KEY,
  kind       TEXT NOT NULL,            -- 'recompute_predictions' · 'refresh_smart_bets' · 'fire_alerts' …
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  status     TEXT NOT NULL DEFAULT 'pending',   -- pending · running · done · failed
  run_after  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts   SMALLINT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_jobs_pending ON public.jobs (run_after) WHERE status = 'pending';

-- ─── 5. Vistas de compatibilidad (interfaz genérica) ─────────
-- security_invoker: la vista respeta las políticas RLS de las tablas base
-- (matches/teams ya tienen lectura pública anon).
CREATE OR REPLACE VIEW public.events_v
WITH (security_invoker = on) AS
SELECT
  m.id,
  'football'::text            AS sport,
  m.competition_id,
  m.phase::text               AS phase,
  m.kickoff_time              AS starts_at,
  m.status::text              AS status,
  m.venue,
  m.city,
  m.country,
  m.home_team_id              AS participant_a,
  m.away_team_id              AS participant_b,
  m.home_score                AS score_a,
  m.away_score                AS score_b,
  jsonb_build_object(
    'penalties_a', m.home_penalties,
    'penalties_b', m.away_penalties,
    'match_number', m.match_number
  )                           AS score_detail
FROM public.matches m;

CREATE OR REPLACE VIEW public.participants_v
WITH (security_invoker = on) AS
SELECT
  t.id,
  'football'::text  AS sport,
  'team'::text      AS kind,
  t.name,
  t.code,
  t.name            AS country,  -- selecciones: el equipo ES el país
  t.elo_rating      AS elo,
  t.competition_id,
  jsonb_build_object(
    'fifa_ranking', t.fifa_ranking,
    'confederation', t.confederation,
    'group_id', t.group_id
  )                 AS meta
FROM public.teams t;

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.sports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_health     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs            ENABLE ROW LEVEL SECURITY;

-- Taxonomía: lectura pública (como el resto de datos deportivos)
DROP POLICY IF EXISTS sports_public_read ON public.sports;
CREATE POLICY sports_public_read  ON public.sports  FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS seasons_public_read ON public.seasons;
CREATE POLICY seasons_public_read ON public.seasons FOR SELECT TO anon, authenticated USING (TRUE);
-- provenance/data_health/jobs: SOLO service role (sin políticas anon)

GRANT SELECT ON public.sports, public.seasons, public.events_v, public.participants_v TO anon, authenticated;
GRANT ALL ON public.data_provenance, public.data_health, public.jobs TO service_role;

COMMIT;

-- Verificación:
--   SELECT slug FROM sports;                          -- 3 deportes
--   SELECT count(*) FROM seasons;                     -- 1 por competición
--   SELECT count(*) FROM events_v WHERE sport='football';   -- = count(matches)
--   SELECT count(*) FROM participants_v;              -- = count(teams)
