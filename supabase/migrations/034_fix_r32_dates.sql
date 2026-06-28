-- ============================================================
-- Migration 034: Corrección de fechas/horas octavos de final
-- Según calendario oficial FIFA WC 2026 (hora Colombia UTC-5)
-- ============================================================

BEGIN;

-- 28 JUN · 14:00 COL → 19:00 UTC
UPDATE matches SET
  kickoff_time = '2026-06-28 19:00:00+00',
  venue = 'Mercedes-Benz Stadium',
  city = 'Atlanta'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 203;
-- Sudáfrica vs Canadá

-- 29 JUN · 12:00 COL → 17:00 UTC
UPDATE matches SET
  kickoff_time = '2026-06-29 17:00:00+00',
  venue = 'SoFi Stadium',
  city = 'Los Angeles'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 209;
-- Brasil vs Japón

-- 29 JUN · 15:30 COL → 20:30 UTC
UPDATE matches SET
  kickoff_time = '2026-06-29 20:30:00+00',
  venue = 'MetLife Stadium',
  city = 'East Rutherford'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 201;
-- Alemania vs Paraguay

-- 29 JUN · 20:00 COL → 30 jun 01:00 UTC
UPDATE matches SET
  kickoff_time = '2026-06-30 01:00:00+00',
  venue = 'NRG Stadium',
  city = 'Houston'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 204;
-- Países Bajos vs Marruecos

-- 30 JUN · 12:00 COL → 17:00 UTC
UPDATE matches SET
  kickoff_time = '2026-06-30 17:00:00+00',
  venue = 'Gillette Stadium',
  city = 'Boston'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 210;
-- Costa de Marfil vs Noruega

-- 30 JUN · 16:00 COL → 21:00 UTC
UPDATE matches SET
  kickoff_time = '2026-06-30 21:00:00+00',
  venue = 'AT&T Stadium',
  city = 'Dallas'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 202;
-- Francia vs Suecia

-- 30 JUN · 20:00 COL → 1 jul 01:00 UTC
UPDATE matches SET
  kickoff_time = '2026-07-01 01:00:00+00',
  venue = 'Estadio Azteca',
  city = 'Ciudad de México'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 211;
-- México vs Ecuador

-- 1 JUL · 11:00 COL → 16:00 UTC
UPDATE matches SET
  kickoff_time = '2026-07-01 16:00:00+00',
  venue = 'Lincoln Financial Field',
  city = 'Philadelphia'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 212;
-- Inglaterra vs RD Congo

-- 1 JUL · 15:00 COL → 20:00 UTC
UPDATE matches SET
  kickoff_time = '2026-07-01 20:00:00+00',
  venue = 'MetLife Stadium',
  city = 'East Rutherford'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 208;
-- Bélgica vs Senegal

-- 1 JUL · 19:00 COL → 2 jul 00:00 UTC
UPDATE matches SET
  kickoff_time = '2026-07-02 00:00:00+00',
  venue = 'AT&T Stadium',
  city = 'Dallas'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 207;
-- Estados Unidos vs Bosnia y Herzegovina

-- 2 JUL · 14:00 COL → 19:00 UTC
UPDATE matches SET
  kickoff_time = '2026-07-02 19:00:00+00',
  venue = 'Arrowhead Stadium',
  city = 'Kansas City'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 206;
-- España vs Austria

-- 2 JUL · 18:00 COL → 23:00 UTC
UPDATE matches SET
  kickoff_time = '2026-07-02 23:00:00+00',
  venue = 'Hard Rock Stadium',
  city = 'Miami'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 205;
-- Portugal vs Croacia

-- 3 JUL · 12:00 COL → 17:00 UTC
UPDATE matches SET
  kickoff_time = '2026-07-03 17:00:00+00',
  venue = 'BC Place',
  city = 'Vancouver'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 214;
-- Australia vs Egipto

-- 3 JUL · 16:00 COL → 21:00 UTC
UPDATE matches SET
  kickoff_time = '2026-07-03 21:00:00+00',
  venue = 'SoFi Stadium',
  city = 'Los Angeles'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 213;
-- Argentina vs Cabo Verde

-- 3 JUL · 19:30 COL → 4 jul 00:30 UTC · Colombia vs Ghana
UPDATE matches SET
  kickoff_time = '2026-07-04 00:30:00+00',
  venue = 'Hard Rock Stadium',
  city = 'Miami'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 216;
-- Colombia vs Ghana

-- 4 JUL · 01:00 COL → 06:00 UTC (23:00 PDT del 3 jul en Los Ángeles)
UPDATE matches SET
  kickoff_time = '2026-07-04 06:00:00+00',
  venue = 'SoFi Stadium',
  city = 'Los Angeles'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number = 215;
-- Suiza vs Argelia

COMMIT;
