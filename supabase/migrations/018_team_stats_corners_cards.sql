-- ============================================================
-- WORLD CUP PREDICTOR — Migration 018: avg_corners, avg_yellow_cards y
-- avg_red_cards por equipo
--
-- Las migraciones 002 y 005 insertaron team_statistics sin estas tres
-- columnas; quedaron en 0. Las derivamos con formulas coherentes sobre
-- los datos ya existentes:
--
--   avg_corners       ≈ 30% de avg_shots  (cornejo resultado de remates)
--   avg_yellow_cards  se reduce con la posesion: equipos dominantes foulean
--                     menos; equipos de bloque bajo foulean mas.
--                     Formula: 2.0 − (avg_possession − 50) * 0.03
--                     rango clampeado a [0.8, 2.5]
--   avg_red_cards     0.10 por equipo por partido (media historica mundial)
--
-- La condicion `avg_corners = 0` hace que la migracion sea idempotente:
-- si se re-ejecuta, no sobreescribe equipos que ya tengan datos reales.
-- ============================================================

BEGIN;

UPDATE public.team_statistics
SET
  avg_corners = ROUND(avg_shots::numeric * 0.30, 1),
  avg_yellow_cards = ROUND(
    GREATEST(0.8, LEAST(2.5,
      2.0 - (avg_possession - 50.0) * 0.03
    ))::numeric,
    1
  ),
  avg_red_cards = 0.10
WHERE
  competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND avg_corners = 0;

-- Verificacion rapida (dev): muestra cuantas filas se actualizaron.
DO $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM public.team_statistics
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND avg_corners > 0;
  RAISE NOTICE 'team_statistics con avg_corners > 0 despues del update: %', cnt;
END $$;

COMMIT;
