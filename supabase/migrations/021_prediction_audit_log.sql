-- 021_prediction_audit_log.sql
-- Trazabilidad completa de cada predicción: qué modelos se usaron, con qué datos,
-- qué pesos, qué calidad de dato y qué riesgos se detectaron.

CREATE TABLE IF NOT EXISTS prediction_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id   UUID REFERENCES predictions(id) ON DELETE CASCADE,
  match_id        UUID REFERENCES matches(id) ON DELETE CASCADE,
  triggered_by    TEXT DEFAULT 'manual',  -- 'cron' | 'manual' | 'odds_movement' | 'injury_update'
  model_results   JSONB DEFAULT '{}',     -- { elo: {home,draw,away}, poisson: {...}, ... }
  ensemble_weights JSONB DEFAULT '{}',    -- { xg: 0.40, elo: 0.25, form: 0.15, market: 0.10, news: 0.10 }
  data_quality    JSONB DEFAULT '{}',     -- { score: 87, missing: ['xg'], sources: [...], age_hours: 2 }
  risk_assessment JSONB DEFAULT '{}',     -- { uncertainty: 'high', anomalies: [...] }
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_match_id      ON prediction_audit_log(match_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_prediction_id ON prediction_audit_log(prediction_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at    ON prediction_audit_log(created_at DESC);

GRANT SELECT ON prediction_audit_log TO anon;
