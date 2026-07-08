-- ============================================================
-- Migration 046: línea de tiempo de eventos + veredicto post-partido
--
-- match_events: eventos genéricos por deporte (goles, tarjetas, cambios,
--   VAR…). El esquema sirve para NBA/tenis cambiando `type`/`period`.
--   Fuente inicial: API-Football /fixtures/events (ingesta bajo demanda,
--   cacheada para siempre — 1 request por partido visitado).
--
-- match_verdicts: análisis post-partido generado una sola vez por
--   partido (resumen, factores, predicción vs realidad, aprendizaje).
--   generator = 'deterministic' o 'claude-<model>'.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.match_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  minute SMALLINT,
  minute_extra SMALLINT,          -- 90+3 → minute=90, extra=3
  period TEXT,                    -- fútbol: 1H/2H/ET/PEN · futuro: Q1..Q4, SET1..
  type TEXT NOT NULL,             -- goal · own_goal · penalty_goal · missed_penalty ·
                                  -- yellow_card · red_card · substitution · var
  player_name TEXT,
  assist_name TEXT,               -- asistente (gol) o jugador que entra (cambio)
  detail TEXT,
  source TEXT NOT NULL DEFAULT 'api_football',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_match_events_match
  ON public.match_events (match_id, minute, minute_extra);

CREATE TABLE IF NOT EXISTS public.match_verdicts (
  match_id UUID PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{title, text}]
  prediction_review TEXT NOT NULL,
  model_lesson TEXT NOT NULL,
  generator TEXT NOT NULL,
  model_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: lectura pública (datos deportivos), escritura solo service_role
ALTER TABLE public.match_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_verdicts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS match_events_public_read ON public.match_events;
CREATE POLICY match_events_public_read ON public.match_events
  FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS match_verdicts_public_read ON public.match_verdicts;
CREATE POLICY match_verdicts_public_read ON public.match_verdicts
  FOR SELECT TO anon, authenticated USING (TRUE);

GRANT SELECT ON public.match_events, public.match_verdicts TO anon, authenticated;
GRANT ALL ON public.match_events, public.match_verdicts TO service_role;

COMMIT;

-- Verificación:
--   SELECT count(*) FROM information_schema.tables
--   WHERE table_name IN ('match_events','match_verdicts');  -- 2
