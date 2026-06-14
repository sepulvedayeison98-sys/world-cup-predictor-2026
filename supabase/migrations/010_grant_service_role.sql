-- ============================================================
-- WORLD CUP PREDICTOR — Migration 010: privilegios a service_role
--
-- FIX: las tablas se crearon por SQL manual y el rol `service_role`
-- (el que usa la SUPABASE_SERVICE_ROLE_KEY / clave sb_secret_ en el sync)
-- no recibio sus GRANT por defecto -> "permission denied for table ...".
-- Sin esto, /api/sync/* no puede leer ni escribir.
--
-- service_role tiene BYPASSRLS, asi que con los GRANT ya lee/escribe todo
-- sin chocar con las politicas. Idempotente.
-- ============================================================

BEGIN;

GRANT USAGE ON SCHEMA public TO service_role;

-- Lectura y escritura sobre todas las tablas (el sync hace SELECT/INSERT/UPDATE)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Tablas/secuencias futuras quedan cubiertas automaticamente
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

COMMIT;
