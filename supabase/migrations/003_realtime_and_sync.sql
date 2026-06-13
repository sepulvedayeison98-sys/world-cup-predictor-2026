-- ============================================================
-- Migration 003 — Enable Realtime + Data Sync Helpers
-- ============================================================

-- Enable Supabase Realtime on key tables
-- (Run in Supabase Dashboard → Database → Replication if not done via CLI)

ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE predictions;
ALTER PUBLICATION supabase_realtime ADD TABLE value_bets;
ALTER PUBLICATION supabase_realtime ADD TABLE injuries;
ALTER PUBLICATION supabase_realtime ADD TABLE match_statistics;
ALTER PUBLICATION supabase_realtime ADD TABLE group_standings;

-- ─── Data sync log ────────────────────────────────────────────
-- Tracks external data ingestion runs (API-Football, odds providers, etc.)

CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,          -- 'api_football', 'betfair', 'manual', etc.
  entity_type TEXT NOT NULL,     -- 'matches', 'odds', 'lineups', 'injuries'
  entity_id TEXT,                -- Optional reference
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'error')),
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_logs_admin" ON sync_logs FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'analyst'))
);

-- Index for recent sync monitoring
CREATE INDEX idx_sync_logs_source ON sync_logs(source);
CREATE INDEX idx_sync_logs_created ON sync_logs(created_at DESC);

-- ─── Notifications table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'lineup_confirmed', 'injury_alert', 'value_bet_detected', 'odds_movement'
  title TEXT NOT NULL,
  body TEXT,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

CREATE POLICY "notifications_own" ON notifications FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ─── Auto-notify on high-value bet detection ──────────────────

CREATE OR REPLACE FUNCTION notify_value_bet()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.grade IN ('high', 'medium') THEN
    INSERT INTO notifications (user_id, type, title, body, match_id)
    SELECT
      u.id,
      'value_bet_detected',
      'Apuesta de valor detectada',
      format(
        '%s · %s · Cuota %.2f · EV +%.1f%%',
        NEW.market, NEW.bookmaker, NEW.odds_value, NEW.expected_value * 100
      ),
      NEW.match_id
    FROM users u
    WHERE u.preferences->>'value_bet_alerts' != 'false';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER value_bet_notification
AFTER INSERT ON value_bets
FOR EACH ROW EXECUTE FUNCTION notify_value_bet();

-- ─── Auto-notify on injury update ─────────────────────────────

CREATE OR REPLACE FUNCTION notify_injury()
RETURNS TRIGGER AS $$
DECLARE
  player_name TEXT;
BEGIN
  IF NEW.is_active AND (TG_OP = 'INSERT' OR NOT OLD.is_active) THEN
    SELECT name INTO player_name FROM players WHERE id = NEW.player_id;

    INSERT INTO notifications (user_id, type, title, body, match_id)
    SELECT
      u.id,
      'injury_alert',
      'Lesión reportada: ' || player_name,
      format('%s · Impacto: %.1f/10', NEW.injury_type, NEW.impact_score),
      NULL
    FROM users u
    WHERE u.preferences->>'injury_alerts' != 'false';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER injury_notification
AFTER INSERT OR UPDATE ON injuries
FOR EACH ROW EXECUTE FUNCTION notify_injury();

-- ─── Dashboard view for quick KPI access ─────────────────────

CREATE OR REPLACE VIEW public.dashboard_kpis AS
SELECT
  (SELECT COUNT(*) FROM matches WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890') AS total_matches,
  (SELECT COUNT(*) FROM predictions WHERE is_published = TRUE) AS analyzed_matches,
  (SELECT COUNT(*) FROM value_bets WHERE is_active = TRUE AND result = 'pending') AS active_picks,
  (SELECT COUNT(*) FROM value_bets WHERE is_active = TRUE AND grade IN ('high','medium')) AS value_bets_detected,
  (SELECT COUNT(*) FROM value_bets WHERE result = 'won') AS value_bets_won,
  (SELECT COUNT(*) FROM predictions WHERE was_correct = TRUE) AS correct_predictions,
  (SELECT COUNT(*) FROM predictions WHERE was_correct IS NOT NULL) AS resolved_predictions,
  (SELECT COUNT(*) FROM injuries WHERE is_active = TRUE) AS active_injuries;

-- Grant select to authenticated users
GRANT SELECT ON dashboard_kpis TO authenticated;
