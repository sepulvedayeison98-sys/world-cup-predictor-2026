-- ============================================================
-- Migration 047: historial de aciertos de Smart Bets AI
--
-- Registra el top-5 de recomendaciones que el motor genera para un
-- partido ANTES de que se juegue (snapshot mientras status='scheduled'),
-- y las resuelve cuando el partido termina. Evita el sesgo retrospectivo:
-- nunca se reconstruye "qué habría recomendado" después del resultado.
--
-- gradable=false para mercados que necesitan estadísticas que no existen
-- (córners/tarjetas en partidos sin match_statistics) — no cuentan en
-- el % de efectividad, se muestran aparte como "sin datos para evaluar".
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.smart_bet_picks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id       UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  market_id      TEXT NOT NULL,      -- 'home_win' · 'over_2_5' · 'btts_yes' · 'cs_home' · 'corners_9_5' ...
  category       TEXT NOT NULL,      -- 'resultado' · 'goles' · 'porteria' · 'corners' · 'tarjetas' · 'combinada'
  label          TEXT NOT NULL,
  rank           SMALLINT NOT NULL CHECK (rank BETWEEN 1 AND 5),
  confidence     NUMERIC(5,2) NOT NULL,
  snapshot_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved       BOOLEAN NOT NULL DEFAULT FALSE,
  gradable       BOOLEAN NOT NULL DEFAULT TRUE,
  correct        BOOLEAN,            -- NULL hasta resolver o si no es gradable
  actual_detail  TEXT,               -- p.ej. "2-1" o "sin estadísticas oficiales"
  resolved_at    TIMESTAMPTZ,
  UNIQUE (match_id, market_id)
);

CREATE INDEX IF NOT EXISTS idx_smart_bet_picks_pending
  ON public.smart_bet_picks (resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_smart_bet_picks_competition
  ON public.smart_bet_picks (competition_id, resolved_at DESC);

ALTER TABLE public.smart_bet_picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS smart_bet_picks_public_read ON public.smart_bet_picks;
CREATE POLICY smart_bet_picks_public_read ON public.smart_bet_picks
  FOR SELECT TO anon, authenticated USING (TRUE);

GRANT SELECT ON public.smart_bet_picks TO anon, authenticated;
GRANT ALL ON public.smart_bet_picks TO service_role;

COMMIT;

-- Verificación:
--   SELECT count(*) FROM information_schema.tables WHERE table_name='smart_bet_picks';  -- 1
