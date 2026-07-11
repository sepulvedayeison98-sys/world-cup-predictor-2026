-- ============================================================
-- Migration 052: feature store para el ajuste de pesos por calibración
--
-- F0 del diseño (docs/WEIGHT_TUNING_DESIGN.md): guardar el ModelInput con el
-- que se generó cada predicción, para poder reentrenar los pesos del motor
-- de forma FIEL (reproduciendo la predicción con los inputs que existían al
-- momento, no con los datos de hoy).
--
-- El writer (services/sync/recalibrate.ts) hace UPSERT solo mientras el
-- partido está scheduled/live; al finalizar deja de tocarlo, congelando el
-- snapshot en el último estado pre-partido. Así el par de entrenamiento es
-- (features pre-partido, resultado real). No cambia ninguna predicción.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.prediction_features (
  match_id        UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  competition_id  UUID NOT NULL,
  -- ModelInput serializado: elo, forma, xg/xga, disparos, goles, lesiones,
  -- marketProbabilities, isKnockout (ver lib/predictionEngine.ts:ModelInput)
  inputs          JSONB NOT NULL,
  model_version   TEXT NOT NULL,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prediction_features_competition
  ON prediction_features(competition_id);

-- RLS: acceso libre = lectura pública (rol anon). Escritura solo service-role.
ALTER TABLE public.prediction_features ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'prediction_features'
      AND policyname = 'public_read_prediction_features'
  ) THEN
    CREATE POLICY public_read_prediction_features
      ON public.prediction_features FOR SELECT TO anon USING (true);
  END IF;
END $$;

GRANT SELECT ON public.prediction_features TO anon;
