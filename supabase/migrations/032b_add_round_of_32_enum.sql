-- ============================================================
-- 032b · Valor 'round_of_32' en el enum match_phase
-- ============================================================
-- Corrección de integridad de migraciones (auditoría maestra 2026-07-09):
-- la migración 033 inserta partidos con phase='round_of_32', pero ningún
-- ALTER TYPE versionado agregaba ese valor — en la BD viva se añadió
-- fuera de banda, así que una reconstrucción limpia desde migraciones
-- fallaba con "invalid input value for enum match_phase".
--
-- Este archivo se nombra 032b a propósito: ordena DESPUÉS de 032 y ANTES
-- de 033 (orden lexicográfico), que es donde el valor debe existir.
-- ALTER TYPE ... ADD VALUE no puede ejecutarse en la misma transacción
-- que su primer uso, por eso vive en su propio archivo (mismo patrón que
-- 043 con 'league' y 048 con 'regular_season'/'playoffs').
--
-- Idempotente: IF NOT EXISTS — en la BD viva (donde ya existe) es un no-op.

ALTER TYPE match_phase ADD VALUE IF NOT EXISTS 'round_of_32';

-- Verificación:
--   SELECT 'round_of_32' IN (SELECT unnest(enum_range(NULL::match_phase))::text);
