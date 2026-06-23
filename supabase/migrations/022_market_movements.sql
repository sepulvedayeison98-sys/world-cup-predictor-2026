-- 022_market_movements.sql
-- Detección de movimientos significativos en cuotas a lo largo del tiempo.
-- Un shift > 5% en probabilidad implícita se marca como significativo.

CREATE TABLE IF NOT EXISTS market_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID REFERENCES matches(id) ON DELETE CASCADE,
  market          TEXT NOT NULL,      -- 'home_win' | 'draw' | 'away_win' | etc.
  bookmaker       TEXT NOT NULL,
  odds_before     FLOAT NOT NULL,
  odds_after      FLOAT NOT NULL,
  prob_shift_pct  FLOAT NOT NULL,     -- variación positiva = cuota baja (equipo sube)
  detected_at     TIMESTAMPTZ DEFAULT now(),
  is_significant  BOOL DEFAULT false  -- |shift| > 5%
);

CREATE INDEX IF NOT EXISTS idx_market_movements_match_id   ON market_movements(match_id);
CREATE INDEX IF NOT EXISTS idx_market_movements_detected   ON market_movements(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_movements_significant ON market_movements(is_significant) WHERE is_significant = true;

GRANT SELECT ON market_movements TO anon;
