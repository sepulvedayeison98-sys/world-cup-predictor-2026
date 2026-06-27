-- ============================================================
-- Migration 032: Colombia vs Portugal — Jornada 3 (27-jun-2026)
--
-- Incluye:
--   1. Jugadores reales de Colombia y Portugal
--   2. Resultados J1 y J2 del Grupo E11
--   3. Stats actualizadas de ambos equipos (WC 2026)
--   4. Alineaciones confirmadas para el partido 163
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- 1. JUGADORES COLOMBIA
-- ═══════════════════════════════════════════════════════════
INSERT INTO players
  (id, team_id, name, short_name, number, position, nationality,
   date_of_birth, club_name, market_value_euros, status)
VALUES
  -- Titulares
  ('20000000-0000-4000-a000-000000000047',
   '10000000-0000-4000-a000-00000000002c',
   'Camilo Vargas', 'C. Vargas', 22, 'GK', 'Colombia',
   '1992-08-15', 'Atlas FC', 4000000, 'available'),

  ('20000000-0000-4000-a000-000000000048',
   '10000000-0000-4000-a000-00000000002c',
   'Daniel Muñoz', 'D. Muñoz', 2, 'RB', 'Colombia',
   '1996-02-04', 'Crystal Palace', 22000000, 'available'),

  ('20000000-0000-4000-a000-000000000049',
   '10000000-0000-4000-a000-00000000002c',
   'Dávinson Sánchez', 'D. Sánchez', 6, 'CB', 'Colombia',
   '1996-06-12', 'Galatasaray', 18000000, 'available'),

  ('20000000-0000-4000-a000-00000000004a',
   '10000000-0000-4000-a000-00000000002c',
   'Jhon Lucumí', 'Lucumí', 4, 'CB', 'Colombia',
   '1998-06-23', 'Bologna FC', 22000000, 'available'),

  ('20000000-0000-4000-a000-00000000004b',
   '10000000-0000-4000-a000-00000000002c',
   'Johan Mojica', 'Mojica', 16, 'LB', 'Colombia',
   '1992-08-21', 'Girona FC', 8000000, 'available'),

  ('20000000-0000-4000-a000-00000000004c',
   '10000000-0000-4000-a000-00000000002c',
   'Wilmar Barrios', 'Barrios', 5, 'CDM', 'Colombia',
   '1993-10-16', 'Zenit San Petersburgo', 8000000, 'available'),

  ('20000000-0000-4000-a000-00000000004d',
   '10000000-0000-4000-a000-00000000002c',
   'Richard Ríos', 'R. Ríos', 21, 'CDM', 'Colombia',
   '2000-07-07', 'Palmeiras', 28000000, 'available'),

  ('20000000-0000-4000-a000-00000000004e',
   '10000000-0000-4000-a000-00000000002c',
   'Jhon Arias', 'J. Arias', 17, 'RW', 'Colombia',
   '1997-03-28', 'Fluminense', 22000000, 'available'),

  ('20000000-0000-4000-a000-00000000004f',
   '10000000-0000-4000-a000-00000000002c',
   'James Rodríguez', 'James', 10, 'CAM', 'Colombia',
   '1991-07-12', 'Rayo Vallecano', 8000000, 'available'),

  ('20000000-0000-4000-a000-000000000050',
   '10000000-0000-4000-a000-00000000002c',
   'Luis Díaz', 'L. Díaz', 7, 'LW', 'Colombia',
   '1997-01-13', 'Liverpool FC', 80000000, 'available'),

  ('20000000-0000-4000-a000-000000000051',
   '10000000-0000-4000-a000-00000000002c',
   'Rafael Santos Borré', 'Borré', 9, 'ST', 'Colombia',
   '1995-09-15', 'Eintracht Frankfurt', 12000000, 'available'),

  -- Suplentes
  ('20000000-0000-4000-a000-000000000052',
   '10000000-0000-4000-a000-00000000002c',
   'Álvaro Montero', 'Montero', 1, 'GK', 'Colombia',
   '1996-06-07', 'Millonarios FC', 3000000, 'available'),

  ('20000000-0000-4000-a000-000000000053',
   '10000000-0000-4000-a000-00000000002c',
   'Yerry Mina', 'Y. Mina', 13, 'CB', 'Colombia',
   '1994-09-23', 'Fiorentina', 8000000, 'available'),

  ('20000000-0000-4000-a000-000000000054',
   '10000000-0000-4000-a000-00000000002c',
   'Matheus Uribe', 'M. Uribe', 8, 'CM', 'Colombia',
   '1991-03-14', 'Porto', 5000000, 'available'),

  ('20000000-0000-4000-a000-000000000055',
   '10000000-0000-4000-a000-00000000002c',
   'Jhon Córdoba', 'J. Córdoba', 19, 'ST', 'Colombia',
   '1993-06-11', 'Krasnodar', 8000000, 'available'),

  ('20000000-0000-4000-a000-000000000056',
   '10000000-0000-4000-a000-00000000002c',
   'Duván Zapata', 'Zapata', 11, 'ST', 'Colombia',
   '1991-04-01', 'Torino FC', 6000000, 'available')

ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 2. JUGADORES PORTUGAL
-- ═══════════════════════════════════════════════════════════
INSERT INTO players
  (id, team_id, name, short_name, number, position, nationality,
   date_of_birth, club_name, market_value_euros, status)
VALUES
  -- Titulares
  ('20000000-0000-4000-a000-000000000057',
   '10000000-0000-4000-a000-000000000029',
   'Diogo Costa', 'D. Costa', 1, 'GK', 'Portugal',
   '1999-09-19', 'Porto', 35000000, 'available'),

  ('20000000-0000-4000-a000-000000000058',
   '10000000-0000-4000-a000-000000000029',
   'João Cancelo', 'Cancelo', 20, 'RB', 'Portugal',
   '1994-05-27', 'Barcelona', 30000000, 'available'),

  ('20000000-0000-4000-a000-000000000059',
   '10000000-0000-4000-a000-000000000029',
   'Rúben Dias', 'R. Dias', 3, 'CB', 'Portugal',
   '1997-05-14', 'Manchester City', 80000000, 'available'),

  ('20000000-0000-4000-a000-00000000005a',
   '10000000-0000-4000-a000-000000000029',
   'Gonçalo Inácio', 'G. Inácio', 4, 'CB', 'Portugal',
   '2001-08-25', 'Sporting CP', 45000000, 'available'),

  ('20000000-0000-4000-a000-00000000005b',
   '10000000-0000-4000-a000-000000000029',
   'Nuno Mendes', 'N. Mendes', 19, 'LB', 'Portugal',
   '2002-06-19', 'PSG', 55000000, 'available'),

  ('20000000-0000-4000-a000-00000000005c',
   '10000000-0000-4000-a000-000000000029',
   'João Neves', 'J. Neves', 8, 'CDM', 'Portugal',
   '2004-03-27', 'PSG', 70000000, 'available'),

  ('20000000-0000-4000-a000-00000000005d',
   '10000000-0000-4000-a000-000000000029',
   'Vitinha', 'Vitinha', 16, 'CM', 'Portugal',
   '2000-02-13', 'PSG', 60000000, 'available'),

  ('20000000-0000-4000-a000-00000000005e',
   '10000000-0000-4000-a000-000000000029',
   'Bernardo Silva', 'B. Silva', 10, 'CM', 'Portugal',
   '1994-08-10', 'Manchester City', 75000000, 'available'),

  ('20000000-0000-4000-a000-00000000005f',
   '10000000-0000-4000-a000-000000000029',
   'Pedro Neto', 'P. Neto', 7, 'RW', 'Portugal',
   '2000-03-09', 'Chelsea', 65000000, 'available'),

  ('20000000-0000-4000-a000-000000000060',
   '10000000-0000-4000-a000-000000000029',
   'Rafael Leão', 'R. Leão', 11, 'LW', 'Portugal',
   '1999-06-10', 'AC Milan', 85000000, 'available'),

  ('20000000-0000-4000-a000-000000000061',
   '10000000-0000-4000-a000-000000000029',
   'Gonçalo Ramos', 'G. Ramos', 9, 'ST', 'Portugal',
   '2001-06-20', 'PSG', 65000000, 'available'),

  -- Suplentes
  ('20000000-0000-4000-a000-000000000062',
   '10000000-0000-4000-a000-000000000029',
   'José Sá', 'J. Sá', 22, 'GK', 'Portugal',
   '1993-01-17', 'Wolverhampton', 12000000, 'available'),

  ('20000000-0000-4000-a000-000000000063',
   '10000000-0000-4000-a000-000000000029',
   'Rúben Neves', 'R. Neves', 15, 'CDM', 'Portugal',
   '1997-03-13', 'Al-Hilal', 25000000, 'available'),

  ('20000000-0000-4000-a000-000000000064',
   '10000000-0000-4000-a000-000000000029',
   'Cristiano Ronaldo', 'CR7', 77, 'RW', 'Portugal',
   '1985-02-05', 'Al-Nassr', 15000000, 'available'),

  ('20000000-0000-4000-a000-000000000065',
   '10000000-0000-4000-a000-000000000029',
   'Diogo Jota', 'D. Jota', 21, 'LW', 'Portugal',
   '1996-12-04', 'Liverpool FC', 40000000, 'available'),

  ('20000000-0000-4000-a000-000000000066',
   '10000000-0000-4000-a000-000000000029',
   'Francisco Conceição', 'F. Conceição', 30, 'RW', 'Portugal',
   '2002-12-12', 'Juventus', 25000000, 'available')

ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 3. RESULTADOS GRUPO E11 — JORNADA 1 Y 2
-- ═══════════════════════════════════════════════════════════

-- J1: Portugal 3-0 RD Congo  (17 jun · Houston)
UPDATE matches SET status = 'finished', home_score = 3, away_score = 0
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 119;

-- J1: Uzbekistán 0-2 Colombia  (17 jun · Azteca)
UPDATE matches SET status = 'finished', home_score = 0, away_score = 2
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 122;

-- J2: Portugal 2-0 Uzbekistán  (23 jun · Houston)
UPDATE matches SET status = 'finished', home_score = 2, away_score = 0
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 141;

-- J2: Colombia 2-0 RD Congo  (23 jun · Guadalajara)
UPDATE matches SET status = 'finished', home_score = 2, away_score = 0
  WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 144;

-- ═══════════════════════════════════════════════════════════
-- 4. TEAM STATISTICS ACTUALIZADAS (WC 2026, 2 partidos jugados)
-- ═══════════════════════════════════════════════════════════

-- Colombia: 2PJ, 2G, 0E, 0P, GF:4, GC:0, 2 vallas invictas
UPDATE team_statistics SET
  matches_played     = 2,
  goals_scored       = 4,
  goals_conceded     = 0,
  clean_sheets       = 2,
  avg_goals_scored   = 2.00,
  avg_goals_conceded = 0.00,
  avg_possession     = 56.0,
  avg_shots          = 15.5,
  avg_shots_on_target = 6.0,
  avg_corners        = 6.5,
  avg_xg             = 2.10,
  avg_xga            = 0.45,
  form               = ARRAY['W','W','W','W','W']::form_result[]
WHERE team_id = '10000000-0000-4000-a000-00000000002c'
  AND competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Portugal: 2PJ, 2G, 0E, 0P, GF:5, GC:0, 2 vallas invictas
UPDATE team_statistics SET
  matches_played     = 2,
  goals_scored       = 5,
  goals_conceded     = 0,
  clean_sheets       = 2,
  avg_goals_scored   = 2.50,
  avg_goals_conceded = 0.00,
  avg_possession     = 58.0,
  avg_shots          = 16.5,
  avg_shots_on_target = 6.5,
  avg_corners        = 7.0,
  avg_xg             = 2.30,
  avg_xga            = 0.50,
  form               = ARRAY['W','W','W','W','W']::form_result[]
WHERE team_id = '10000000-0000-4000-a000-000000000029'
  AND competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- ═══════════════════════════════════════════════════════════
-- 5. ALINEACIONES MATCH 163: Colombia vs Portugal
-- ═══════════════════════════════════════════════════════════
DO $$
DECLARE
  v_match_id     UUID;
  v_col_lineup   UUID;
  v_por_lineup   UUID;
BEGIN
  SELECT id INTO v_match_id
  FROM matches
  WHERE match_number = 163
    AND competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'Partido 163 no encontrado';
  END IF;

  -- ─── Alineación Colombia (4-2-3-1) ───────────────────────
  INSERT INTO lineups (match_id, team_id, formation, is_confirmed)
  VALUES (v_match_id, '10000000-0000-4000-a000-00000000002c', '4-2-3-1', TRUE)
  ON CONFLICT (match_id, team_id)
    DO UPDATE SET formation = EXCLUDED.formation, is_confirmed = TRUE
  RETURNING id INTO v_col_lineup;

  INSERT INTO lineup_players
    (lineup_id, player_id, position, grid_x, grid_y, is_starter, is_captain)
  VALUES
    -- Portero
    (v_col_lineup,'20000000-0000-4000-a000-000000000047','GK',3,1,TRUE,FALSE),
    -- Defensa
    (v_col_lineup,'20000000-0000-4000-a000-00000000004b','LB',1,3,TRUE,FALSE),  -- Mojica
    (v_col_lineup,'20000000-0000-4000-a000-00000000004a','CB',2,3,TRUE,FALSE),  -- Lucumí
    (v_col_lineup,'20000000-0000-4000-a000-000000000049','CB',4,3,TRUE,FALSE),  -- D. Sánchez
    (v_col_lineup,'20000000-0000-4000-a000-000000000048','RB',5,3,TRUE,FALSE),  -- Muñoz
    -- Doble pivote
    (v_col_lineup,'20000000-0000-4000-a000-00000000004c','CDM',2,5,TRUE,FALSE), -- Barrios
    (v_col_lineup,'20000000-0000-4000-a000-00000000004d','CDM',4,5,TRUE,FALSE), -- R. Ríos
    -- Media punta y extremos
    (v_col_lineup,'20000000-0000-4000-a000-000000000050','LW',1,7,TRUE,FALSE),  -- Luis Díaz
    (v_col_lineup,'20000000-0000-4000-a000-00000000004f','CAM',3,7,TRUE,TRUE),  -- James ©
    (v_col_lineup,'20000000-0000-4000-a000-00000000004e','RW',5,7,TRUE,FALSE),  -- Arias
    -- Delantero
    (v_col_lineup,'20000000-0000-4000-a000-000000000051','ST',3,9,TRUE,FALSE),  -- Borré
    -- Suplentes
    (v_col_lineup,'20000000-0000-4000-a000-000000000052','GK',1,11,FALSE,FALSE),
    (v_col_lineup,'20000000-0000-4000-a000-000000000053','CB',2,11,FALSE,FALSE),
    (v_col_lineup,'20000000-0000-4000-a000-000000000054','CM',3,11,FALSE,FALSE),
    (v_col_lineup,'20000000-0000-4000-a000-000000000055','ST',4,11,FALSE,FALSE),
    (v_col_lineup,'20000000-0000-4000-a000-000000000056','ST',5,11,FALSE,FALSE)
  ON CONFLICT (lineup_id, player_id) DO NOTHING;

  -- ─── Alineación Portugal (4-3-3) ─────────────────────────
  INSERT INTO lineups (match_id, team_id, formation, is_confirmed)
  VALUES (v_match_id, '10000000-0000-4000-a000-000000000029', '4-3-3', TRUE)
  ON CONFLICT (match_id, team_id)
    DO UPDATE SET formation = EXCLUDED.formation, is_confirmed = TRUE
  RETURNING id INTO v_por_lineup;

  INSERT INTO lineup_players
    (lineup_id, player_id, position, grid_x, grid_y, is_starter, is_captain)
  VALUES
    -- Portero
    (v_por_lineup,'20000000-0000-4000-a000-000000000057','GK',3,1,TRUE,FALSE),
    -- Defensa
    (v_por_lineup,'20000000-0000-4000-a000-00000000005b','LB',1,3,TRUE,FALSE),  -- N. Mendes
    (v_por_lineup,'20000000-0000-4000-a000-00000000005a','CB',2,3,TRUE,FALSE),  -- G. Inácio
    (v_por_lineup,'20000000-0000-4000-a000-000000000059','CB',4,3,TRUE,FALSE),  -- R. Dias
    (v_por_lineup,'20000000-0000-4000-a000-000000000058','RB',5,3,TRUE,FALSE),  -- Cancelo
    -- Triple pivote
    (v_por_lineup,'20000000-0000-4000-a000-00000000005d','CM',2,5,TRUE,FALSE),  -- Vitinha
    (v_por_lineup,'20000000-0000-4000-a000-00000000005c','CDM',3,5,TRUE,FALSE), -- J. Neves
    (v_por_lineup,'20000000-0000-4000-a000-00000000005e','CM',4,5,TRUE,TRUE),   -- B. Silva ©
    -- Tridente
    (v_por_lineup,'20000000-0000-4000-a000-000000000060','LW',1,7,TRUE,FALSE),  -- Leão
    (v_por_lineup,'20000000-0000-4000-a000-000000000061','ST',3,7,TRUE,FALSE),  -- G. Ramos
    (v_por_lineup,'20000000-0000-4000-a000-00000000005f','RW',5,7,TRUE,FALSE),  -- P. Neto
    -- Suplentes
    (v_por_lineup,'20000000-0000-4000-a000-000000000062','GK',1,11,FALSE,FALSE),
    (v_por_lineup,'20000000-0000-4000-a000-000000000063','CDM',2,11,FALSE,FALSE),
    (v_por_lineup,'20000000-0000-4000-a000-000000000064','RW',3,11,FALSE,FALSE), -- CR7
    (v_por_lineup,'20000000-0000-4000-a000-000000000065','LW',4,11,FALSE,FALSE),
    (v_por_lineup,'20000000-0000-4000-a000-000000000066','RW',5,11,FALSE,FALSE)
  ON CONFLICT (lineup_id, player_id) DO NOTHING;

END $$;

COMMIT;
