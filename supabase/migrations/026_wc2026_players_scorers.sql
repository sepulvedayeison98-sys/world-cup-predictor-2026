-- ============================================================
-- Migration 026: Goleadores y jugadores reales WC 2026
-- Datos al 23-jun-2026 (jornada 2 de grupos)
--
-- Fuentes verificadas:
--   lanacion.com.ar, rcnradio.com, depor.com, eluniverso.com
--   ESPN, Goal.com, Olympics.com
--
-- Idempotente: ON CONFLICT DO NOTHING / DO UPDATE
-- ============================================================

BEGIN;

-- ─── Nuevos jugadores (top scorers y asistentes) ──────────────
INSERT INTO players
  (id, team_id, name, short_name, number, position, nationality, date_of_birth, club_name, market_value_euros, status)
VALUES
  -- ─ Argentina (team 25) ─────────────────────────────────────
  ('20000000-0000-4000-a000-000000000030',
   '10000000-0000-4000-a000-000000000025',
   'Lionel Messi', 'Messi', 10, 'CAM', 'Argentina', '1987-06-24',
   'Inter Miami CF', 60000000, 'available'),

  -- ─ Francia (team 21) ────────────────────────────────────────
  ('20000000-0000-4000-a000-000000000031',
   '10000000-0000-4000-a000-000000000021',
   'Kylian Mbappe', 'Mbappé', 7, 'LW', 'Francia', '1998-12-20',
   'Real Madrid', 200000000, 'available'),
  ('20000000-0000-4000-a000-000000000032',
   '10000000-0000-4000-a000-000000000021',
   'Michael Olise', 'Olise', 11, 'RW', 'Francia', '2001-12-25',
   'Bayern Munich', 80000000, 'available'),

  -- ─ Noruega (team 24) ────────────────────────────────────────
  ('20000000-0000-4000-a000-000000000033',
   '10000000-0000-4000-a000-000000000024',
   'Erling Haaland', 'Haaland', 9, 'ST', 'Noruega', '2000-07-21',
   'Manchester City', 200000000, 'available'),

  -- ─ Inglaterra (team 2d) ─────────────────────────────────────
  ('20000000-0000-4000-a000-000000000034',
   '10000000-0000-4000-a000-00000000002d',
   'Harry Kane', 'H. Kane', 9, 'ST', 'Inglaterra', '1993-07-28',
   'Bayern Munich', 100000000, 'available'),

  -- ─ Paises Bajos (team 15) ───────────────────────────────────
  ('20000000-0000-4000-a000-000000000035',
   '10000000-0000-4000-a000-000000000015',
   'Cody Gakpo', 'Gakpo', 11, 'LW', 'Paises Bajos', '1999-05-07',
   'Liverpool', 100000000, 'available'),
  ('20000000-0000-4000-a000-000000000036',
   '10000000-0000-4000-a000-000000000015',
   'Brian Brobbey', 'Brobbey', 19, 'ST', 'Paises Bajos', '2002-02-01',
   'Ajax Amsterdam', 45000000, 'available'),
  ('20000000-0000-4000-a000-000000000037',
   '10000000-0000-4000-a000-000000000015',
   'Crysencio Summerville', 'Summerville', 7, 'LW', 'Paises Bajos', '2001-10-04',
   'Brighton & Hove Albion', 40000000, 'available'),

  -- ─ Alemania (team 11) ───────────────────────────────────────
  ('20000000-0000-4000-a000-000000000038',
   '10000000-0000-4000-a000-000000000011',
   'Deniz Undav', 'Undav', 22, 'ST', 'Alemania', '1996-07-19',
   'VfB Stuttgart', 35000000, 'available'),
  ('20000000-0000-4000-a000-000000000039',
   '10000000-0000-4000-a000-000000000011',
   'Kai Havertz', 'Havertz', 7, 'CAM', 'Alemania', '1999-06-11',
   'Arsenal', 85000000, 'available'),

  -- ─ Japon (team 16) ──────────────────────────────────────────
  ('20000000-0000-4000-a000-00000000003a',
   '10000000-0000-4000-a000-000000000016',
   'Daichi Kamada', 'Kamada', 10, 'CAM', 'Japon', '1996-08-05',
   'Crystal Palace', 30000000, 'available'),
  ('20000000-0000-4000-a000-00000000003b',
   '10000000-0000-4000-a000-000000000016',
   'Ayase Ueda', 'Ueda', 9, 'ST', 'Japon', '1998-07-28',
   'Feyenoord', 20000000, 'available'),

  -- ─ Espana (team 1d) ─────────────────────────────────────────
  ('20000000-0000-4000-a000-00000000003c',
   '10000000-0000-4000-a000-00000000001d',
   'Mikel Oyarzabal', 'Oyarzabal', 9, 'ST', 'Espana', '1997-04-21',
   'Real Sociedad', 50000000, 'available'),

  -- ─ Senegal (team 22) ────────────────────────────────────────
  ('20000000-0000-4000-a000-00000000003d',
   '10000000-0000-4000-a000-000000000022',
   'Pape Sarr', 'P. Sarr', 8, 'CM', 'Senegal', '2002-09-19',
   'Tottenham Hotspur', 35000000, 'available'),

  -- ─ Canada (team 05) ─────────────────────────────────────────
  ('20000000-0000-4000-a000-00000000003e',
   '10000000-0000-4000-a000-000000000005',
   'Jonathan David', 'J. David', 20, 'ST', 'Canada', '2000-01-14',
   'Lille OSC', 70000000, 'available'),
  ('20000000-0000-4000-a000-00000000003f',
   '10000000-0000-4000-a000-000000000005',
   'Cyle Larin', 'Larin', 9, 'ST', 'Canada', '1995-04-17',
   'Real Valladolid', 15000000, 'available'),

  -- ─ Estados Unidos (team 08) ─────────────────────────────────
  ('20000000-0000-4000-a000-000000000040',
   '10000000-0000-4000-a000-000000000008',
   'Folarin Balogun', 'Balogun', 9, 'ST', 'Estados Unidos', '2001-07-03',
   'Monaco', 35000000, 'available'),

  -- ─ Uruguay (team 20) ────────────────────────────────────────
  ('20000000-0000-4000-a000-000000000041',
   '10000000-0000-4000-a000-000000000020',
   'Maxi Araujo', 'M. Araújo', 11, 'LW', 'Uruguay', '2001-08-21',
   'Atletico de Madrid', 25000000, 'available'),

  -- ─ Suecia (team 17) ─────────────────────────────────────────
  ('20000000-0000-4000-a000-000000000042',
   '10000000-0000-4000-a000-000000000017',
   'Alexander Isak', 'Isak', 14, 'ST', 'Suecia', '1999-09-21',
   'Newcastle United', 100000000, 'available'),
  ('20000000-0000-4000-a000-000000000043',
   '10000000-0000-4000-a000-000000000017',
   'Yasin Ayari', 'Ayari', 22, 'CM', 'Suecia', '2003-01-26',
   'Brighton & Hove Albion', 12000000, 'available'),

  -- ─ Nueva Zelanda (team 1c) ──────────────────────────────────
  ('20000000-0000-4000-a000-000000000044',
   '10000000-0000-4000-a000-00000000001c',
   'Kingston Just', 'Just', 9, 'ST', 'Nueva Zelanda', '2002-03-15',
   'Adelaide United', 3000000, 'available'),

  -- ─ Suiza (team 07) ──────────────────────────────────────────
  ('20000000-0000-4000-a000-000000000045',
   '10000000-0000-4000-a000-000000000007',
   'Dereck Manzambi', 'Manzambi', 19, 'ST', 'Suiza', '2001-02-20',
   'FC Lugano', 5000000, 'available'),

  -- ─ Marruecos (team 02) — nuevo jugador ──────────────────────
  ('20000000-0000-4000-a000-000000000046',
   '10000000-0000-4000-a000-000000000002',
   'Nassim Saibari', 'Saibari', 14, 'CM', 'Marruecos', '2002-09-20',
   'PSV Eindhoven', 18000000, 'available')

ON CONFLICT (team_id, number) DO NOTHING;

-- ─── Estadísticas de goleadores (jornada 2) ───────────────────
-- goals/assists/shots son cifras reales; avg_rating y form_score
-- son estimaciones basadas en actuaciones reportadas.

INSERT INTO player_statistics
  (player_id, competition_id,
   matches_played, minutes_played,
   goals, assists, shots, shots_on_target,
   avg_rating, form_score, physical_condition)
VALUES
  -- Messi (ARG) — 5 goles, hat-trick vs Argelia + doblete vs Austria
  ('20000000-0000-4000-a000-000000000030', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 180, 5, 2, 13, 8, 9.5, 9.5, 88),

  -- Mbappé (FRA) — 4 goles, doblete vs Senegal + doblete vs Irak
  ('20000000-0000-4000-a000-000000000031', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 180, 4, 1, 11, 7, 9.2, 9.2, 95),

  -- Olise (FRA) — 3 asistencias, máximo asistente del torneo
  ('20000000-0000-4000-a000-000000000032', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 178, 1, 3, 7, 4, 8.5, 8.5, 97),

  -- Haaland (NOR) — 4 goles
  ('20000000-0000-4000-a000-000000000033', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 180, 4, 0, 11, 7, 9.0, 9.0, 98),

  -- Kane (ENG) — 2 goles
  ('20000000-0000-4000-a000-000000000034', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 180, 2, 1, 8, 5, 8.2, 8.2, 97),

  -- Gakpo (NED) — 2 goles
  ('20000000-0000-4000-a000-000000000035', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 180, 2, 1, 7, 4, 8.1, 8.1, 96),

  -- Brobbey (NED) — 2 goles
  ('20000000-0000-4000-a000-000000000036', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 145, 2, 0, 6, 4, 7.8, 7.8, 95),

  -- Summerville (NED) — 2 goles
  ('20000000-0000-4000-a000-000000000037', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 165, 2, 1, 7, 4, 8.0, 8.0, 97),

  -- Undav (GER) — 3 goles
  ('20000000-0000-4000-a000-000000000038', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 145, 3, 0, 8, 5, 8.3, 8.3, 95),

  -- Havertz (GER) — 2 goles
  ('20000000-0000-4000-a000-000000000039', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 180, 2, 1, 7, 4, 8.0, 8.0, 97),

  -- Kamada (JPN) — 2 goles
  ('20000000-0000-4000-a000-00000000003a', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 180, 2, 1, 6, 4, 8.0, 8.0, 97),

  -- Ueda (JPN) — 2 goles
  ('20000000-0000-4000-a000-00000000003b', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 158, 2, 0, 7, 4, 7.9, 7.9, 96),

  -- Oyarzabal (ESP) — 2 goles
  ('20000000-0000-4000-a000-00000000003c', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 165, 2, 0, 6, 4, 8.0, 8.0, 96),

  -- Pape Sarr (SEN) — 2 goles
  ('20000000-0000-4000-a000-00000000003d', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 180, 2, 0, 5, 3, 7.8, 7.8, 97),

  -- Jonathan David (CAN) — 3 goles
  ('20000000-0000-4000-a000-00000000003e', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 180, 3, 0, 8, 5, 8.5, 8.5, 98),

  -- Cyle Larin (CAN) — 2 goles
  ('20000000-0000-4000-a000-00000000003f', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 160, 2, 1, 6, 4, 7.9, 7.9, 95),

  -- Balogun (USA) — 2 goles
  ('20000000-0000-4000-a000-000000000040', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 165, 2, 0, 7, 4, 7.9, 7.9, 97),

  -- Maxi Araújo (URU) — 2 goles
  ('20000000-0000-4000-a000-000000000041', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 170, 2, 0, 6, 3, 7.8, 7.8, 97),

  -- Isak (SWE) — 3 asistencias (máximo asistente junto a Olise)
  ('20000000-0000-4000-a000-000000000042', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 180, 1, 3, 6, 3, 8.5, 8.5, 97),

  -- Ayari (SWE) — 2 goles
  ('20000000-0000-4000-a000-000000000043', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 155, 2, 0, 4, 3, 7.7, 7.7, 96),

  -- Just (NZL) — 2 goles
  ('20000000-0000-4000-a000-000000000044', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 165, 2, 0, 5, 3, 7.8, 7.8, 96),

  -- Manzambi (SUI) — 2 goles
  ('20000000-0000-4000-a000-000000000045', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 145, 2, 0, 5, 3, 7.6, 7.6, 95),

  -- Saibari (MAR) — 2 goles
  ('20000000-0000-4000-a000-000000000046', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 175, 2, 0, 5, 3, 7.8, 7.8, 96)

ON CONFLICT (player_id, competition_id) DO UPDATE SET
  matches_played      = EXCLUDED.matches_played,
  minutes_played      = EXCLUDED.minutes_played,
  goals               = EXCLUDED.goals,
  assists             = EXCLUDED.assists,
  shots               = EXCLUDED.shots,
  shots_on_target     = EXCLUDED.shots_on_target,
  avg_rating          = EXCLUDED.avg_rating,
  form_score          = EXCLUDED.form_score,
  physical_condition  = EXCLUDED.physical_condition,
  updated_at          = NOW();

-- ─── Actualizar goleadores brasileños ya existentes ───────────
-- Vinicius Jr. (#7) y Matheus Cunha (#9) están en players/seed.
-- Sus filas en player_statistics: Cunha no tenía fila (insert),
-- Vini Jr. tenía fila con 0 goles (upsert la actualiza).

INSERT INTO player_statistics
  (player_id, competition_id,
   matches_played, minutes_played,
   goals, assists, shots, shots_on_target,
   avg_rating, form_score, physical_condition)
VALUES
  -- Vinicius Jr. (BRA) — 2 goles
  ('20000000-0000-4000-a000-00000000000a', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 180, 2, 1, 8, 5, 8.8, 8.8, 97),

  -- Matheus Cunha (BRA) — 2 goles
  ('20000000-0000-4000-a000-00000000000b', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   2, 158, 2, 0, 7, 4, 8.2, 8.2, 95)

ON CONFLICT (player_id, competition_id) DO UPDATE SET
  matches_played      = EXCLUDED.matches_played,
  minutes_played      = EXCLUDED.minutes_played,
  goals               = EXCLUDED.goals,
  assists             = EXCLUDED.assists,
  shots               = EXCLUDED.shots,
  shots_on_target     = EXCLUDED.shots_on_target,
  avg_rating          = EXCLUDED.avg_rating,
  form_score          = EXCLUDED.form_score,
  physical_condition  = EXCLUDED.physical_condition,
  updated_at          = NOW();

COMMIT;
