-- ============================================================
-- WORLD CUP PREDICTOR — Migration 002: Seed Data (WC 2026)
-- ============================================================

-- Competition
INSERT INTO competitions (id, name, short_name, type, season, start_date, end_date, is_active)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'FIFA World Cup 2026',
  'WC2026',
  'world_cup',
  '2026',
  '2026-06-11',
  '2026-07-19',
  TRUE
);

-- ─── Groups ───────────────────────────────────────────────────
INSERT INTO groups (id, competition_id, name, letter) VALUES
  ('g-aaa00000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group A', 'A'),
  ('g-bbb00000-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group B', 'B'),
  ('g-ccc00000-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group C', 'C'),
  ('g-ddd00000-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group D', 'D'),
  ('g-eee00000-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group E', 'E'),
  ('g-fff00000-0000-0000-0000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group F', 'F'),
  ('g-ggg00000-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group G', 'G'),
  ('g-hhh00000-0000-0000-0000-000000000008', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group H', 'H'),
  ('g-iii00000-0000-0000-0000-000000000009', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group I', 'I'),
  ('g-jjj00000-0000-0000-0000-000000000010', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group J', 'J'),
  ('g-kkk00000-0000-0000-0000-000000000011', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group K', 'K'),
  ('g-lll00000-0000-0000-0000-000000000012', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group L', 'L');

-- ─── Teams (Group C — Brasil, Marruecos, Haití, Escocia) ────
-- Adding Group C teams with full data + key teams from other groups

INSERT INTO teams (id, name, short_name, code, confederation, fifa_ranking, elo_rating, coach, competition_id, group_id) VALUES
  -- Group C
  ('t-brasil00-0000-0000-0000-000000000001', 'Brasil', 'BRA', 'BRA', 'CONMEBOL', 5, 2050, 'Carlo Ancelotti', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'g-ccc00000-0000-0000-0000-000000000003'),
  ('t-marroc0-0000-0000-0000-000000000002', 'Marruecos', 'MAR', 'MAR', 'CAF', 14, 1780, 'Mohamed Ouahbi', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'g-ccc00000-0000-0000-0000-000000000003'),
  ('t-haiti00-0000-0000-0000-000000000003', 'Haití', 'HAI', 'HAI', 'CONCACAF', 82, 1380, 'Marc Collat', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'g-ccc00000-0000-0000-0000-000000000003'),
  ('t-escocia-0000-0000-0000-000000000004', 'Escocia', 'SCO', 'SCO', 'UEFA', 39, 1680, 'Steve Clarke', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'g-ccc00000-0000-0000-0000-000000000003'),
  -- Group B
  ('t-canada0-0000-0000-0000-000000000005', 'Canadá', 'CAN', 'CAN', 'CONCACAF', 38, 1710, 'Jesse Marsch', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'g-bbb00000-0000-0000-0000-000000000002'),
  ('t-qatar00-0000-0000-0000-000000000006', 'Qatar', 'QAT', 'QAT', 'AFC', 58, 1530, 'Marquez Lopez', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'g-bbb00000-0000-0000-0000-000000000002'),
  ('t-suiza00-0000-0000-0000-000000000007', 'Suiza', 'SUI', 'SUI', 'UEFA', 20, 1810, 'Murat Yakin', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'g-bbb00000-0000-0000-0000-000000000002'),
  -- Group D
  ('t-usa0000-0000-0000-0000-000000000008', 'Estados Unidos', 'USA', 'USA', 'CONCACAF', 11, 1875, 'Mauricio Pochettino', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'g-ddd00000-0000-0000-0000-000000000004'),
  ('t-paraguay-000-0000-0000-000000000009', 'Paraguay', 'PAR', 'PAR', 'CONMEBOL', 62, 1580, 'Daniel Garnero', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'g-ddd00000-0000-0000-0000-000000000004'),
  ('t-austral-0000-0000-0000-00000000000a', 'Australia', 'AUS', 'AUS', 'AFC', 24, 1750, 'Tony Popovic', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'g-ddd00000-0000-0000-0000-000000000004'),
  ('t-turquia-0000-0000-0000-00000000000b', 'Turquía', 'TUR', 'TUR', 'UEFA', 28, 1760, 'Vincenzo Montella', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'g-ddd00000-0000-0000-0000-000000000004');

-- ─── Group standings initial rows ─────────────────────────────
INSERT INTO group_standings (group_id, team_id, qualification_probability, top_spot_probability) VALUES
  ('g-ccc00000-0000-0000-0000-000000000003', 't-brasil00-0000-0000-0000-000000000001', 88.5, 65.2),
  ('g-ccc00000-0000-0000-0000-000000000003', 't-marroc0-0000-0000-0000-000000000002', 72.3, 25.1),
  ('g-ccc00000-0000-0000-0000-000000000003', 't-haiti00-0000-0000-0000-000000000003', 8.4, 2.1),
  ('g-ccc00000-0000-0000-0000-000000000003', 't-escocia-0000-0000-0000-000000000004', 30.8, 7.6),
  ('g-bbb00000-0000-0000-0000-000000000002', 't-canada0-0000-0000-0000-000000000005', 75.0, 45.0),
  ('g-bbb00000-0000-0000-0000-000000000002', 't-qatar00-0000-0000-0000-000000000006', 15.0, 5.0),
  ('g-bbb00000-0000-0000-0000-000000000002', 't-suiza00-0000-0000-0000-000000000007', 70.0, 40.0),
  ('g-ddd00000-0000-0000-0000-000000000004', 't-usa0000-0000-0000-0000-000000000008', 82.0, 55.0),
  ('g-ddd00000-0000-0000-0000-000000000004', 't-paraguay-000-0000-0000-000000000009', 35.0, 10.0),
  ('g-ddd00000-0000-0000-0000-000000000004', 't-austral-0000-0000-0000-00000000000a', 55.0, 20.0),
  ('g-ddd00000-0000-0000-0000-000000000004', 't-turquia-0000-0000-0000-00000000000b', 58.0, 15.0);

-- ─── Team Statistics ──────────────────────────────────────────
INSERT INTO team_statistics (team_id, competition_id, avg_goals_scored, avg_goals_conceded, avg_possession, avg_shots, avg_shots_on_target, avg_xg, avg_xga, form) VALUES
  ('t-brasil00-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 2.4, 0.8, 58.2, 16.3, 6.1, 2.1, 0.9, ARRAY['W','W','W','D','W']::form_result[]),
  ('t-marroc0-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 1.6, 0.6, 42.1, 11.2, 4.8, 1.4, 0.8, ARRAY['W','D','W','W','W']::form_result[]),
  ('t-haiti00-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 1.0, 2.1, 38.5, 9.1, 3.2, 0.9, 1.8, ARRAY['L','D','L','W','L']::form_result[]),
  ('t-escocia-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 1.4, 1.2, 48.3, 12.8, 4.9, 1.3, 1.1, ARRAY['W','W','D','L','W']::form_result[]),
  ('t-usa0000-0000-0000-0000-000000000008', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 2.1, 0.9, 54.1, 14.8, 5.8, 1.9, 1.0, ARRAY['W','W','W','D','W']::form_result[]);

-- ─── Players — Brasil ─────────────────────────────────────────
INSERT INTO players (id, team_id, name, short_name, number, position, nationality, date_of_birth, club_name, market_value_euros, status) VALUES
  ('p-alisson-0000-0000-0000-000000000001', 't-brasil00-0000-0000-0000-000000000001', 'Alisson Becker', 'Alisson', 1, 'GK', 'Brasileira', '1992-10-02', 'Liverpool', 30000000, 'available'),
  ('p-danilo0-0000-0000-0000-000000000002', 't-brasil00-0000-0000-0000-000000000001', 'Danilo', 'Danilo', 13, 'RB', 'Brasileira', '1991-07-15', 'Juventus', 8000000, 'available'),
  ('p-marquin-0000-0000-0000-000000000003', 't-brasil00-0000-0000-0000-000000000001', 'Marquinhos', 'Marquinhos', 4, 'CB', 'Brasileira', '1994-05-14', 'PSG', 45000000, 'available'),
  ('p-gabriel-0000-0000-0000-000000000004', 't-brasil00-0000-0000-0000-000000000001', 'Gabriel Magalhães', 'Gabriel', 3, 'CB', 'Brasileira', '1997-12-19', 'Arsenal', 55000000, 'available'),
  ('p-alexsan-0000-0000-0000-000000000005', 't-brasil00-0000-0000-0000-000000000001', 'Alex Sandro', 'A. Sandro', 6, 'LB', 'Brasileira', '1991-01-26', 'Flamengo', 5000000, 'available'),
  ('p-casemiro-000-0000-0000-000000000006', 't-brasil00-0000-0000-0000-000000000001', 'Casemiro', 'Casemiro', 5, 'CDM', 'Brasileira', '1992-02-23', 'Man. United', 20000000, 'available'),
  ('p-brunogm-0000-0000-0000-000000000007', 't-brasil00-0000-0000-0000-000000000001', 'Bruno Guimarães', 'B. Guimarães', 8, 'CM', 'Brasileira', '1997-11-16', 'Newcastle', 70000000, 'available'),
  ('p-raphinha-000-0000-0000-000000000008', 't-brasil00-0000-0000-0000-000000000001', 'Raphinha', 'Raphinha', 11, 'RW', 'Brasileira', '1996-12-14', 'Barcelona', 75000000, 'available'),
  ('p-paqueta-000-0000-0000-000000000009', 't-brasil00-0000-0000-0000-000000000001', 'Lucas Paquetá', 'Paquetá', 20, 'CAM', 'Brasileira', '1997-08-27', 'West Ham', 55000000, 'available'),
  ('p-vinicius-00-0000-0000-00000000000a', 't-brasil00-0000-0000-0000-000000000001', 'Vinícius Júnior', 'Vini Jr.', 7, 'LW', 'Brasileira', '2000-07-12', 'Real Madrid', 200000000, 'available'),
  ('p-matheus-000-0000-0000-00000000000b', 't-brasil00-0000-0000-0000-000000000001', 'Matheus Cunha', 'M. Cunha', 9, 'ST', 'Brasileira', '1999-05-27', 'Wolves', 50000000, 'available'),
  ('p-neymar0-0000-0000-0000-00000000000c', 't-brasil00-0000-0000-0000-000000000001', 'Neymar Jr.', 'Neymar', 10, 'LW', 'Brasileira', '1992-02-05', 'Al-Hilal', 25000000, 'doubt');

-- Injury record for Neymar
INSERT INTO injuries (player_id, team_id, competition_id, injury_type, description, is_active, impact_score)
VALUES (
  'p-neymar0-0000-0000-0000-00000000000c',
  't-brasil00-0000-0000-0000-000000000001',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'muscular',
  'Lesión muscular en muslo izquierdo. En tratamiento previo al torneo.',
  TRUE,
  7.5
);

-- ─── Players — Marruecos ──────────────────────────────────────
INSERT INTO players (id, team_id, name, short_name, number, position, nationality, date_of_birth, club_name, market_value_euros, status) VALUES
  ('p-bounou0-0000-0000-0000-000000000020', 't-marroc0-0000-0000-0000-000000000002', 'Yassine Bounou', 'Bono', 1, 'GK', 'Marroquí', '1991-04-05', 'Al-Hilal', 18000000, 'available'),
  ('p-hakimi0-0000-0000-0000-000000000021', 't-marroc0-0000-0000-0000-000000000002', 'Achraf Hakimi', 'Hakimi', 2, 'RB', 'Marroquí', '1998-11-04', 'PSG', 80000000, 'available'),
  ('p-aguerd0-0000-0000-0000-000000000022', 't-marroc0-0000-0000-0000-000000000002', 'Nayef Aguerd', 'Aguerd', 5, 'CB', 'Marroquí', '1996-03-30', 'West Ham', 22000000, 'injured'),
  ('p-chadi00-0000-0000-0000-000000000023', 't-marroc0-0000-0000-0000-000000000002', 'Chadi Riad', 'C. Riad', 18, 'CB', 'Marroquí', '2004-08-03', 'Real Betis', 15000000, 'available'),
  ('p-issadiop-00-0000-0000-000000000024', 't-marroc0-0000-0000-0000-000000000002', 'Issa Diop', 'I. Diop', 14, 'CB', 'Marroquí', '1997-01-09', 'Fulham', 12000000, 'available'),
  ('p-ounahi0-0000-0000-0000-000000000025', 't-marroc0-0000-0000-0000-000000000002', 'Azzedine Ounahi', 'Ounahi', 8, 'CM', 'Marroquí', '2000-04-06', 'Marseille', 25000000, 'available'),
  ('p-elaynou-0000-0000-0000-000000000026', 't-marroc0-0000-0000-0000-000000000002', 'Nour El Aynaoui', 'El Aynaoui', 24, 'CM', 'Marroquí', '2002-01-01', 'Stade Rennais', 18000000, 'available'),
  ('p-bouaddi-0000-0000-0000-000000000027', 't-marroc0-0000-0000-0000-000000000002', 'Ayyoub Bouaddi', 'Bouaddi', 6, 'CDM', 'Marroquí', '2005-07-10', 'LOSC Lille', 20000000, 'available'),
  ('p-brahimd-0000-0000-0000-000000000028', 't-marroc0-0000-0000-0000-000000000002', 'Brahim Díaz', 'B. Díaz', 10, 'CAM', 'Marroquí', '1999-08-03', 'Real Madrid', 45000000, 'available'),
  ('p-elkhan0-0000-0000-0000-000000000029', 't-marroc0-0000-0000-0000-000000000002', 'Bilal El Khannouss', 'El Khannouss', 23, 'CAM', 'Marroquí', '2004-05-10', 'Leicester City', 28000000, 'available'),
  ('p-saibari-0000-0000-0000-00000000002a', 't-marroc0-0000-0000-0000-000000000002', 'Ismael Saibari', 'Saibari', 11, 'LW', 'Marroquí', '2000-03-25', 'PSV', 22000000, 'available'),
  ('p-abde000-0000-0000-0000-00000000002b', 't-marroc0-0000-0000-0000-000000000002', 'Abde Ezzalzouli', 'Abde', 17, 'LW', 'Marroquí', '2001-12-16', 'Real Betis', 20000000, 'injured');

-- Injury records for Marruecos
INSERT INTO injuries (player_id, team_id, competition_id, injury_type, description, is_active, impact_score)
VALUES
  ('p-aguerd0-0000-0000-0000-000000000022', 't-marroc0-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'muscular', 'Lesión muscular. Baja confirmada para el debut.', TRUE, 8.0),
  ('p-abde000-0000-0000-0000-00000000002b', 't-marroc0-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'muscular', 'Lesión en banda izquierda. Baja confirmada.', TRUE, 6.5);

-- ─── Matches — Group C ────────────────────────────────────────
INSERT INTO matches (id, competition_id, group_id, phase, match_number, status, home_team_id, away_team_id, kickoff_time, venue, city, country, weather_condition, weather_temp_celsius, home_rest_days, away_rest_days) VALUES
  (
    'm-bravmar-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'g-ccc00000-0000-0000-0000-000000000003',
    'group', 13, 'scheduled',
    't-brasil00-0000-0000-0000-000000000001',
    't-marroc0-0000-0000-0000-000000000002',
    '2026-06-13T21:00:00Z',
    'MetLife Stadium', 'East Rutherford', 'USA',
    'Clear', 24, NULL, NULL
  ),
  (
    'm-haiisco-0000-0000-0000-000000000002',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'g-ccc00000-0000-0000-0000-000000000003',
    'group', 14, 'scheduled',
    't-haiti00-0000-0000-0000-000000000003',
    't-escocia-0000-0000-0000-000000000004',
    '2026-06-14T00:00:00Z',
    'Gillette Stadium', 'Foxborough', 'USA',
    'Clear', 21, NULL, NULL
  ),
  (
    'm-scomar0-0000-0000-0000-000000000003',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'g-ccc00000-0000-0000-0000-000000000003',
    'group', 28, 'scheduled',
    't-escocia-0000-0000-0000-000000000004',
    't-marroc0-0000-0000-0000-000000000002',
    '2026-06-19T21:00:00Z',
    'Gillette Stadium', 'Foxborough', 'USA',
    NULL, NULL, NULL, NULL
  ),
  (
    'm-brahait-0000-0000-0000-000000000004',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'g-ccc00000-0000-0000-0000-000000000003',
    'group', 29, 'scheduled',
    't-brasil00-0000-0000-0000-000000000001',
    't-haiti00-0000-0000-0000-000000000003',
    '2026-06-20T00:00:00Z',
    'Lincoln Financial Field', 'Philadelphia', 'USA',
    NULL, NULL, NULL, NULL
  ),
  (
    'm-scobra0-0000-0000-0000-000000000005',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'g-ccc00000-0000-0000-0000-000000000003',
    'group', 44, 'scheduled',
    't-escocia-0000-0000-0000-000000000004',
    't-brasil00-0000-0000-0000-000000000001',
    '2026-06-25T00:00:00Z',
    'Hard Rock Stadium', 'Miami', 'USA',
    NULL, NULL, NULL, NULL
  ),
  (
    'm-marhait-0000-0000-0000-000000000006',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'g-ccc00000-0000-0000-0000-000000000003',
    'group', 45, 'scheduled',
    't-marroc0-0000-0000-0000-000000000002',
    't-haiti00-0000-0000-0000-000000000003',
    '2026-06-25T00:00:00Z',
    'Mercedes-Benz Stadium', 'Atlanta', 'USA',
    NULL, NULL, NULL, NULL
  );

-- ─── Prediction — Brasil vs Marruecos ────────────────────────
INSERT INTO predictions (
  id, match_id,
  home_win_probability, draw_probability, away_win_probability,
  predicted_home_score, predicted_away_score,
  confidence_level, confidence_score, model_version,
  is_published
) VALUES (
  'pred-bravmar-00000000-0000-000000000001',
  'm-bravmar-0000-0000-0000-000000000001',
  0.5800, 0.2500, 0.1700,
  2, 0,
  3, 71.5, '1.0.0',
  TRUE
);

-- Exact scores for Brasil vs Marruecos
INSERT INTO exact_score_predictions (prediction_id, home_score, away_score, probability, rank) VALUES
  ('pred-bravmar-00000000-0000-000000000001', 1, 0, 0.1800, 1),
  ('pred-bravmar-00000000-0000-000000000001', 2, 0, 0.1400, 2),
  ('pred-bravmar-00000000-0000-000000000001', 1, 1, 0.1300, 3),
  ('pred-bravmar-00000000-0000-000000000001', 2, 1, 0.1200, 4),
  ('pred-bravmar-00000000-0000-000000000001', 0, 0, 0.1000, 5),
  ('pred-bravmar-00000000-0000-000000000001', 0, 1, 0.0700, 6),
  ('pred-bravmar-00000000-0000-000000000001', 3, 0, 0.0600, 7),
  ('pred-bravmar-00000000-0000-000000000001', 2, 2, 0.0500, 8),
  ('pred-bravmar-00000000-0000-000000000001', 1, 2, 0.0500, 9),
  ('pred-bravmar-00000000-0000-000000000001', 3, 1, 0.0400, 10);

-- ─── Odds — Brasil vs Marruecos ──────────────────────────────
INSERT INTO odds (match_id, bookmaker, market, odds_value, implied_probability, recorded_at) VALUES
  ('m-bravmar-0000-0000-0000-000000000001', 'Bet365', 'home_win', 1.65, 0.6061, NOW()),
  ('m-bravmar-0000-0000-0000-000000000001', 'Bet365', 'draw', 3.75, 0.2667, NOW()),
  ('m-bravmar-0000-0000-0000-000000000001', 'Bet365', 'away_win', 5.25, 0.1905, NOW()),
  ('m-bravmar-0000-0000-0000-000000000001', 'Bet365', 'over_2_5', 2.10, 0.4762, NOW()),
  ('m-bravmar-0000-0000-0000-000000000001', 'Bet365', 'btts_yes', 2.05, 0.4878, NOW()),
  ('m-bravmar-0000-0000-0000-000000000001', 'Bet365', 'btts_no', 1.75, 0.5714, NOW()),
  ('m-bravmar-0000-0000-0000-000000000001', 'Betway', 'home_win', 1.70, 0.5882, NOW()),
  ('m-bravmar-0000-0000-0000-000000000001', 'Betway', 'draw', 3.60, 0.2778, NOW()),
  ('m-bravmar-0000-0000-0000-000000000001', 'Betway', 'away_win', 5.00, 0.2000, NOW());

-- ─── Value Bets ───────────────────────────────────────────────
INSERT INTO value_bets (match_id, prediction_id, market, bookmaker, odds_value, implied_probability, model_probability, expected_value, edge, grade, stake_suggestion_percent) VALUES
  (
    'm-bravmar-0000-0000-0000-000000000001',
    'pred-bravmar-00000000-0000-000000000001',
    'home_win', 'Bet365', 1.65, 0.6061, 0.5800,
    (1.65 * 0.5800) - 1, 0.5800 - 0.6061,
    'none', 0.00
  ),
  (
    'm-bravmar-0000-0000-0000-000000000001',
    'pred-bravmar-00000000-0000-000000000001',
    'btts_no', 'Bet365', 1.75, 0.5714, 0.5500,
    (1.75 * 0.5500) - 1, 0.5500 - 0.5714,
    'low', 1.5
  ),
  (
    'm-bravmar-0000-0000-0000-000000000001',
    'pred-bravmar-00000000-0000-000000000001',
    'clean_sheet_home', 'Betway', 2.20, 0.4545, 0.4800,
    (2.20 * 0.4800) - 1, 0.4800 - 0.4545,
    'medium', 2.5
  );

-- Player statistics seed (Brasil key players)
INSERT INTO player_statistics (player_id, competition_id, avg_rating, form_score, physical_condition) VALUES
  ('p-vinicius-00-0000-0000-00000000000a', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 8.2, 8.5, 95),
  ('p-raphinha-000-0000-0000-000000000008', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 7.9, 8.1, 98),
  ('p-brunogm-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 8.0, 8.0, 97),
  ('p-brahimd-0000-0000-0000-000000000028', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 7.8, 8.3, 96),
  ('p-hakimi0-0000-0000-0000-000000000021', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 7.6, 7.9, 94),
  ('p-neymar0-0000-0000-0000-00000000000c', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 7.5, 6.5, 60);
