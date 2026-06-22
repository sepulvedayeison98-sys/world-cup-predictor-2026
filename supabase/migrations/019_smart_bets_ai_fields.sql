-- ============================================================
-- WORLD CUP PREDICTOR — Migration 019: Smart Bets AI fields
--
-- Agrega dos columnas opcionales a value_bets para cachear la
-- justificacion generada por el motor AI y los factores a favor/
-- en contra. Si estas columnas no estan pobladas, la aplicacion
-- las computa en tiempo real en el frontend.
--
-- Idempotente: usa IF NOT EXISTS.
-- ============================================================

BEGIN;

ALTER TABLE public.value_bets
  ADD COLUMN IF NOT EXISTS ai_justification TEXT,
  ADD COLUMN IF NOT EXISTS ai_factors JSONB DEFAULT '{"for":[],"against":[]}'::jsonb;

COMMIT;
