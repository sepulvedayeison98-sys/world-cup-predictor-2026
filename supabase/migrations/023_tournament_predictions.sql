-- 023_tournament_predictions.sql
-- Predicciones de torneo: goleador, MVP, campeón, máximo amonestado, etc.
-- entity_id puede apuntar a un jugador o un equipo según prediction_type.

CREATE TABLE IF NOT EXISTS tournament_predictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID REFERENCES competitions(id) ON DELETE CASCADE,
  prediction_type TEXT NOT NULL,  -- 'top_scorer' | 'mvp' | 'champion' | 'top_cards' | 'top_corners'
  entity_type     TEXT NOT NULL,  -- 'player' | 'team'
  entity_id       UUID NOT NULL,
  probability     FLOAT NOT NULL CHECK (probability BETWEEN 0 AND 1),
  rank            INT,
  model_version   TEXT DEFAULT '1.0.0',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournament_pred_competition ON tournament_predictions(competition_id);
CREATE INDEX IF NOT EXISTS idx_tournament_pred_type        ON tournament_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_tournament_pred_entity      ON tournament_predictions(entity_id);

GRANT SELECT ON tournament_predictions TO anon;
