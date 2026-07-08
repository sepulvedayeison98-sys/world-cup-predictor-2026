-- ============================================================
-- Migration 049: marcador por periodo (genérico por deporte)
--
-- matches.period_scores JSONB guarda el desglose por periodo:
--   NBA  → { "home": [q1,q2,q3,q4,ot?], "away": [...] }
--   (futuro tenis → sets; fútbol no lo usa)
-- Nullable: solo lo llenan los deportes que lo tienen.
-- ============================================================

BEGIN;

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS period_scores JSONB;

COMMIT;

-- Verificación:
--   SELECT count(*) FROM matches WHERE period_scores IS NOT NULL;
