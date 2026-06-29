-- ============================================================
-- Migration 035: Corrección definitiva de kickoff_time R32
-- Fuente: calendario oficial FIFA WC 2026 (hora Colombia UTC-5)
-- Identificación por home_team_id + away_team_id — más fiable
-- que match_number. Idempotente; reaplica y amplía 034.
-- ============================================================

BEGIN;

-- ─── 28 JUN ──────────────────────────────────────────────────
-- RSA vs CAN · 14:00 COL → 19:00 UTC
UPDATE matches SET kickoff_time = '2026-06-28 19:00:00+00',
  venue = 'Mercedes-Benz Stadium', city = 'Atlanta'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-00000000000d'
  AND away_team_id = '10000000-0000-4000-a000-000000000005';

-- ─── 29 JUN ──────────────────────────────────────────────────
-- BRA vs JPN · 12:00 COL → 17:00 UTC
UPDATE matches SET kickoff_time = '2026-06-29 17:00:00+00',
  venue = 'SoFi Stadium', city = 'Los Angeles'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-000000000001'
  AND away_team_id = '10000000-0000-4000-a000-000000000016';

-- GER vs PAR · 15:30 COL → 20:30 UTC
UPDATE matches SET kickoff_time = '2026-06-29 20:30:00+00',
  venue = 'MetLife Stadium', city = 'East Rutherford'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-000000000011'
  AND away_team_id = '10000000-0000-4000-a000-000000000009';

-- NED vs MAR · 20:00 COL → 30 jun 01:00 UTC
UPDATE matches SET kickoff_time = '2026-06-30 01:00:00+00',
  venue = 'NRG Stadium', city = 'Houston'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-000000000015'
  AND away_team_id = '10000000-0000-4000-a000-000000000002';

-- ─── 30 JUN ──────────────────────────────────────────────────
-- CIV vs NOR · 12:00 COL → 17:00 UTC
UPDATE matches SET kickoff_time = '2026-06-30 17:00:00+00',
  venue = 'Gillette Stadium', city = 'Boston'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-000000000013'
  AND away_team_id = '10000000-0000-4000-a000-000000000024';

-- FRA vs SUE · 16:00 COL → 21:00 UTC
UPDATE matches SET kickoff_time = '2026-06-30 21:00:00+00',
  venue = 'AT&T Stadium', city = 'Dallas'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-000000000021'
  AND away_team_id = '10000000-0000-4000-a000-000000000017';

-- MEX vs ECU · 20:00 COL → 1 jul 01:00 UTC
UPDATE matches SET kickoff_time = '2026-07-01 01:00:00+00',
  venue = 'Estadio Azteca', city = 'Ciudad de México'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-00000000000c'
  AND away_team_id = '10000000-0000-4000-a000-000000000014';

-- ─── 1 JUL ───────────────────────────────────────────────────
-- ENG vs COD · 11:00 COL → 16:00 UTC
UPDATE matches SET kickoff_time = '2026-07-01 16:00:00+00',
  venue = 'Lincoln Financial Field', city = 'Philadelphia'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-00000000002d'
  AND away_team_id = '10000000-0000-4000-a000-00000000002a';

-- BEL vs SEN · 15:00 COL → 20:00 UTC
UPDATE matches SET kickoff_time = '2026-07-01 20:00:00+00',
  venue = 'MetLife Stadium', city = 'East Rutherford'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-000000000019'
  AND away_team_id = '10000000-0000-4000-a000-000000000022';

-- USA vs BIH · 19:00 COL → 2 jul 00:00 UTC
UPDATE matches SET kickoff_time = '2026-07-02 00:00:00+00',
  venue = 'AT&T Stadium', city = 'Dallas'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-000000000008'
  AND away_team_id = '10000000-0000-4000-a000-000000000010';

-- ─── 2 JUL ───────────────────────────────────────────────────
-- ESP vs AUT · 14:00 COL → 19:00 UTC
UPDATE matches SET kickoff_time = '2026-07-02 19:00:00+00',
  venue = 'Arrowhead Stadium', city = 'Kansas City'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-00000000001d'
  AND away_team_id = '10000000-0000-4000-a000-000000000027';

-- POR vs CRO · 18:00 COL → 23:00 UTC
UPDATE matches SET kickoff_time = '2026-07-02 23:00:00+00',
  venue = 'Hard Rock Stadium', city = 'Miami'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-000000000029'
  AND away_team_id = '10000000-0000-4000-a000-00000000002e';

-- ─── 3 JUL ───────────────────────────────────────────────────
-- AUS vs EGY · 12:00 COL → 17:00 UTC
UPDATE matches SET kickoff_time = '2026-07-03 17:00:00+00',
  venue = 'BC Place', city = 'Vancouver'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-00000000000a'
  AND away_team_id = '10000000-0000-4000-a000-00000000001a';

-- ARG vs CPV · 16:00 COL → 21:00 UTC
UPDATE matches SET kickoff_time = '2026-07-03 21:00:00+00',
  venue = 'SoFi Stadium', city = 'Los Angeles'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-000000000025'
  AND away_team_id = '10000000-0000-4000-a000-00000000001e';

-- COL vs GHA · 19:30 COL → 4 jul 00:30 UTC
UPDATE matches SET kickoff_time = '2026-07-04 00:30:00+00',
  venue = 'Hard Rock Stadium', city = 'Miami'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-00000000002c'
  AND away_team_id = '10000000-0000-4000-a000-00000000002f';

-- ─── 4 JUL ───────────────────────────────────────────────────
-- SUI vs ALG · 01:00 COL (4 jul) = 23:00 PDT del 3 jul → 06:00 UTC
UPDATE matches SET kickoff_time = '2026-07-04 06:00:00+00',
  venue = 'SoFi Stadium', city = 'Los Angeles'
WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND home_team_id = '10000000-0000-4000-a000-000000000007'
  AND away_team_id = '10000000-0000-4000-a000-000000000026';

COMMIT;
