-- 025_data_quality_and_prediction_columns.sql
-- Tabla de snapshots de calidad de datos por partido.
-- Columnas opcionales en predictions para trazabilidad.

CREATE TABLE IF NOT EXISTS data_quality_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id         UUID REFERENCES matches(id) ON DELETE CASCADE,
  quality_score    FLOAT NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  reliability_tier TEXT NOT NULL DEFAULT 'baja',  -- 'excelente' | 'alta' | 'media' | 'baja'
  fields_present   JSONB DEFAULT '{}',  -- { elo: true, xg: false, form: true, odds: true }
  data_age_hours   JSONB DEFAULT '{}',  -- { odds: 1.5, injuries: 24, form: 2 }
  sources_used     TEXT[] DEFAULT '{}',
  snapshot_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_quality_match_id    ON data_quality_snapshots(match_id);
CREATE INDEX IF NOT EXISTS idx_data_quality_snapshot_at ON data_quality_snapshots(snapshot_at DESC);

GRANT SELECT ON data_quality_snapshots TO anon;

-- Nuevas columnas en predictions (opcionales, no rompen nada existente)
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS model_breakdown     JSONB    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS data_quality_score  FLOAT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_data_sources   TEXT[]   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS data_age_hours      FLOAT    DEFAULT NULL;
