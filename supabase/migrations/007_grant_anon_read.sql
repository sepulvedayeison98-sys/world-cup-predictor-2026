-- ============================================================
-- WORLD CUP PREDICTOR — Migration 007: GRANT lectura a anon
--
-- FIX: la migracion 004 creo las POLITICAS RLS de lectura publica
-- pero NO los GRANT de privilegio a nivel de tabla. En Postgres el
-- privilegio de tabla se evalua ANTES que RLS, asi que el rol `anon`
-- recibia "permission denied for table ..." (error 42501) y la app
-- publica renderizaba vacio. Esto otorga SELECT a anon/authenticated.
--
-- Seguro: TODAS las tablas tienen RLS activo (migracion 001), asi que
-- el GRANT solo habilita el acceso; las politicas siguen filtrando filas
-- (users y simulation_results quedan protegidas: no tienen policy para anon).
-- ============================================================

BEGIN;

-- Acceso al esquema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Lectura sobre todas las tablas actuales (RLS sigue filtrando filas)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Que las tablas FUTURAS (p. ej. la futura carga de jugadores) tambien
-- queden legibles sin tener que volver a otorgar privilegios manualmente.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon, authenticated;

COMMIT;

-- Verificacion (deberia devolver 12 filas, no un error de permisos):
--   SET ROLE anon;
--   SELECT letter FROM groups ORDER BY letter;
--   RESET ROLE;
