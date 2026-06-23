-- 020_model_registry.sql
-- Registro histórico de precisión por modelo predictivo.
-- Permite comparar ELO, Poisson, xG, Monte Carlo, Mercado y Ensemble en el tiempo.

CREATE TABLE IF NOT EXISTS model_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name      TEXT NOT NULL,
  version         TEXT NOT NULL DEFAULT '1.0.0',
  predictions_evaluated INT DEFAULT 0,
  correct_predictions   INT DEFAULT 0,
  accuracy_1x2    FLOAT,   -- porcentaje de acierto 1X2
  mae_goals       FLOAT,   -- error absoluto medio en goles esperados
  brier_score     FLOAT,   -- calidad de calibración probabilística (0=perfecto)
  last_evaluated_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(model_name, version)
);

INSERT INTO model_registry (model_name, version) VALUES
  ('elo',         '1.0.0'),
  ('poisson',     '1.0.0'),
  ('xg',          '1.0.0'),
  ('monte_carlo', '1.0.0'),
  ('market',      '1.0.0'),
  ('ensemble',    '2.0.0')
ON CONFLICT (model_name, version) DO NOTHING;

GRANT SELECT ON model_registry TO anon;
