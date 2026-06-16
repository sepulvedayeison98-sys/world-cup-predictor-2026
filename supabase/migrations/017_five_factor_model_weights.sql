-- ============================================================
-- WORLD CUP PREDICTOR — Migration 017: modelo de prediccion de 5 factores
--
-- Sustituye el motor de 10 variables ponderadas por el modelo hibrido
-- especificado: xG y capacidad ofensiva (40%), ELO Rating (25%),
-- forma reciente (15%), mercado de apuestas (10%), noticias/lesiones (10%).
-- Ver lib/predictionEngine.ts (unica fuente de verdad del motor).
--
-- Reemplaza las columnas de pesos de `predictions`: se eliminan las de los
-- factores que ya no existen y se agregan xg_weight, market_weight y
-- news_weight. elo_weight y form_weight se conservan (cambian sus valores
-- por defecto).
-- ============================================================

BEGIN;

ALTER TABLE public.predictions
  ADD COLUMN xg_weight NUMERIC(3,2) NOT NULL DEFAULT 0.40,
  ADD COLUMN market_weight NUMERIC(3,2) NOT NULL DEFAULT 0.10,
  ADD COLUMN news_weight NUMERIC(3,2) NOT NULL DEFAULT 0.10;

ALTER TABLE public.predictions
  ALTER COLUMN elo_weight SET DEFAULT 0.25,
  ALTER COLUMN form_weight SET DEFAULT 0.15;

-- Las predicciones existentes (generadas con el modelo anterior) quedan
-- marcadas con los pesos del nuevo modelo; sus probabilidades se recalculan
-- en la siguiente corrida de /api/sync/recalibrate.
UPDATE public.predictions SET
  xg_weight = 0.40,
  elo_weight = 0.25,
  form_weight = 0.15,
  market_weight = 0.10,
  news_weight = 0.10;

ALTER TABLE public.predictions
  DROP COLUMN squad_quality_weight,
  DROP COLUMN player_status_weight,
  DROP COLUMN advanced_stats_weight,
  DROP COLUMN tactical_weight,
  DROP COLUMN odds_weight,
  DROP COLUMN motivation_weight,
  DROP COLUMN external_factors_weight,
  DROP COLUMN h2h_weight;

COMMIT;
