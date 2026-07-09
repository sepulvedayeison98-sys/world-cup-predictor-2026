-- ============================================================
-- 050 · Hardening de seguridad (auditoría maestra 2026-07-09)
-- ============================================================
-- 1. search_path fijo en las funciones SECURITY DEFINER restantes
--    (AUDIT 🟡-6). ALTER FUNCTION preserva el cuerpo: cero cambio de
--    comportamiento, solo cierra el vector de search_path injection.
-- 2. RLS activo + política de lectura pública en las tablas V3 que
--    solo tenían GRANT (regla de oro: toda tabla nueva lleva RLS con
--    lectura anon). El comportamiento de lectura no cambia; los writes
--    siguen siendo del service-role (bypassa RLS).

-- ─── 1. search_path en SECURITY DEFINER ─────────────────────

ALTER FUNCTION public.notify_value_bet() SET search_path = public, pg_catalog;
ALTER FUNCTION public.notify_injury() SET search_path = public, pg_catalog;
ALTER FUNCTION public.backfill_missing_match_stats() SET search_path = public, pg_catalog;
ALTER FUNCTION public.refresh_team_statistics() SET search_path = public, pg_catalog;
-- La versión viva de esta función no conservó el SET de la migración 012:
ALTER FUNCTION public.recalculate_group_standings(UUID) SET search_path = public, pg_catalog;

-- ─── 2. RLS + lectura pública en tablas V3 ───────────────────

ALTER TABLE model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'model_registry', 'prediction_audit_log', 'market_movements',
    'tournament_predictions', 'event_simulations', 'data_quality_snapshots'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'public_read_' || t
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (true)',
        'public_read_' || t, t
      );
    END IF;
  END LOOP;
END $$;

-- Verificación:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN
--     ('model_registry','prediction_audit_log','market_movements',
--      'tournament_predictions','event_simulations','data_quality_snapshots');
--   -- todas deben tener rowsecurity = true y una política public_read_*
