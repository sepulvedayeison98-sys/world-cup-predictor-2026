-- ============================================================
-- Migration 033: Resultados fase de grupos + Octavos de Final
-- Fecha: 2026-06-28 · Fase de grupos terminada
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════
-- GRUPO A  (MEX 1° · KOR 2° · CZE 3°)
-- ═══════════════════════════════════════════════════════
-- J1
UPDATE matches SET status='finished',home_score=2,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=101; -- MEX 2-1 RSA
UPDATE matches SET status='finished',home_score=1,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=102; -- KOR 1-1 CZE
-- J2
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=123; -- CZE 2-0 RSA
UPDATE matches SET status='finished',home_score=1,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=126; -- MEX 1-0 KOR
-- J3
UPDATE matches SET status='finished',home_score=1,away_score=3 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=147; -- CZE 1-3 MEX
UPDATE matches SET status='finished',home_score=0,away_score=2 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=148; -- RSA 0-2 KOR

-- ═══════════════════════════════════════════════════════
-- GRUPO B  (SUI 1° · CAN 2° · BOS 3°)
-- ═══════════════════════════════════════════════════════
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=103; -- CAN 2-0 BOS
UPDATE matches SET status='finished',home_score=0,away_score=3 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=105; -- QAT 0-3 SUI
UPDATE matches SET status='finished',home_score=2,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=124; -- SUI 2-1 BOS
UPDATE matches SET status='finished',home_score=3,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=125; -- CAN 3-0 QAT
UPDATE matches SET status='finished',home_score=1,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=145; -- SUI 1-0 CAN
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=146; -- BOS 2-0 QAT

-- ═══════════════════════════════════════════════════════
-- GRUPO C  (BRA 1° · MAR 2° · SCO 3°)
-- IDs explícitos de migration 002
-- ═══════════════════════════════════════════════════════
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE id='30000000-0000-4000-a000-000000000001'; -- BRA 2-0 MAR
UPDATE matches SET status='finished',home_score=0,away_score=3 WHERE id='30000000-0000-4000-a000-000000000002'; -- HAI 0-3 SCO
UPDATE matches SET status='finished',home_score=1,away_score=2 WHERE id='30000000-0000-4000-a000-000000000003'; -- SCO 1-2 MAR
UPDATE matches SET status='finished',home_score=4,away_score=0 WHERE id='30000000-0000-4000-a000-000000000004'; -- BRA 4-0 HAI
UPDATE matches SET status='finished',home_score=0,away_score=1 WHERE id='30000000-0000-4000-a000-000000000005'; -- SCO 0-1 BRA
UPDATE matches SET status='finished',home_score=3,away_score=0 WHERE id='30000000-0000-4000-a000-000000000006'; -- MAR 3-0 HAI

-- ═══════════════════════════════════════════════════════
-- GRUPO D  (USA 1° · AUS 2° · TUR 3°)
-- ═══════════════════════════════════════════════════════
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=104; -- USA 2-0 PAR
UPDATE matches SET status='finished',home_score=1,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=106; -- AUS 1-1 TUR
UPDATE matches SET status='finished',home_score=1,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=127; -- USA 1-0 AUS
UPDATE matches SET status='finished',home_score=2,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=128; -- TUR 2-1 PAR
UPDATE matches SET status='finished',home_score=1,away_score=2 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=153; -- TUR 1-2 USA
UPDATE matches SET status='finished',home_score=0,away_score=2 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=154; -- PAR 0-2 AUS

-- ═══════════════════════════════════════════════════════
-- GRUPO E  (GER 1° · ECU 2° · CIV 3°)
-- ═══════════════════════════════════════════════════════
UPDATE matches SET status='finished',home_score=4,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=107; -- GER 4-0 CUW
UPDATE matches SET status='finished',home_score=1,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=109; -- CIV 1-1 ECU
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=130; -- GER 2-0 CIV
UPDATE matches SET status='finished',home_score=3,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=131; -- ECU 3-0 CUW
UPDATE matches SET status='finished',home_score=1,away_score=2 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=149; -- ECU 1-2 GER
UPDATE matches SET status='finished',home_score=0,away_score=2 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=150; -- CUW 0-2 CIV

-- ═══════════════════════════════════════════════════════
-- GRUPO F  (NED 1° · JPN 2° · SWE 3°)
-- ═══════════════════════════════════════════════════════
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=108; -- NED 2-0 JPN
UPDATE matches SET status='finished',home_score=2,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=110; -- SWE 2-1 TUN
UPDATE matches SET status='finished',home_score=1,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=129; -- NED 1-1 SWE
UPDATE matches SET status='finished',home_score=0,away_score=2 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=132; -- TUN 0-2 JPN
UPDATE matches SET status='finished',home_score=2,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=151; -- JPN 2-1 SWE
UPDATE matches SET status='finished',home_score=0,away_score=2 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=152; -- TUN 0-2 NED

-- ═══════════════════════════════════════════════════════
-- GRUPO G  (BEL 1° · IRN 2° · EGY 3°)
-- ═══════════════════════════════════════════════════════
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=112; -- BEL 2-0 EGY
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=114; -- IRN 2-0 NZL
UPDATE matches SET status='finished',home_score=1,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=134; -- BEL 1-0 IRN
UPDATE matches SET status='finished',home_score=1,away_score=2 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=136; -- NZL 1-2 EGY
UPDATE matches SET status='finished',home_score=0,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=159; -- EGY 0-1 IRN
UPDATE matches SET status='finished',home_score=0,away_score=3 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=160; -- NZL 0-3 BEL

-- ═══════════════════════════════════════════════════════
-- GRUPO H  (ESP 1° · URU 2° · KSA 3°)
-- ═══════════════════════════════════════════════════════
UPDATE matches SET status='finished',home_score=3,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=111; -- ESP 3-0 CPV
UPDATE matches SET status='finished',home_score=1,away_score=2 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=113; -- KSA 1-2 URU
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=133; -- ESP 2-0 KSA
UPDATE matches SET status='finished',home_score=3,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=135; -- URU 3-0 CPV
UPDATE matches SET status='finished',home_score=0,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=157; -- CPV 0-1 KSA
UPDATE matches SET status='finished',home_score=1,away_score=2 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=158; -- URU 1-2 ESP

-- ═══════════════════════════════════════════════════════
-- GRUPO I  (FRA 1° · NOR 2° · SEN 3°)
-- ═══════════════════════════════════════════════════════
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=115; -- FRA 2-0 SEN
UPDATE matches SET status='finished',home_score=0,away_score=2 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=116; -- IRQ 0-2 NOR
UPDATE matches SET status='finished',home_score=4,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=138; -- FRA 4-0 IRQ
UPDATE matches SET status='finished',home_score=1,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=139; -- NOR 1-1 SEN
UPDATE matches SET status='finished',home_score=0,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=155; -- NOR 0-1 FRA
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=156; -- SEN 2-0 IRQ

-- ═══════════════════════════════════════════════════════
-- GRUPO J  (ARG 1° · AUT 2° · ALG 3°)
-- ═══════════════════════════════════════════════════════
UPDATE matches SET status='finished',home_score=3,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=117; -- ARG 3-0 ALG
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=118; -- AUT 2-0 JOR
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=137; -- ARG 2-0 AUT
UPDATE matches SET status='finished',home_score=0,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=140; -- JOR 0-1 ALG
UPDATE matches SET status='finished',home_score=1,away_score=2 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=165; -- ALG 1-2 AUT
UPDATE matches SET status='finished',home_score=0,away_score=2 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=166; -- JOR 0-2 ARG

-- ═══════════════════════════════════════════════════════
-- GRUPO K  (COL 1° · POR 2° · COD 3°)
-- J1 y J2 ya actualizados en migration 032
-- ═══════════════════════════════════════════════════════
UPDATE matches SET status='finished',home_score=2,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=163; -- COL 2-1 POR
UPDATE matches SET status='finished',home_score=1,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=164; -- COD 1-0 UZB

-- ═══════════════════════════════════════════════════════
-- GRUPO L  (ENG 1° · CRO 2° · GHA 3°)
-- ═══════════════════════════════════════════════════════
UPDATE matches SET status='finished',home_score=2,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=120; -- ENG 2-1 CRO
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=121; -- GHA 2-0 PAN
UPDATE matches SET status='finished',home_score=2,away_score=0 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=142; -- ENG 2-0 GHA
UPDATE matches SET status='finished',home_score=0,away_score=3 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=143; -- PAN 0-3 CRO
UPDATE matches SET status='finished',home_score=0,away_score=3 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=161; -- PAN 0-3 ENG
UPDATE matches SET status='finished',home_score=2,away_score=1 WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND match_number=162; -- CRO 2-1 GHA

-- ═══════════════════════════════════════════════════════
-- DIECISEISAVOS DE FINAL — 16 partidos (29 jun – 2 jul)
-- Cuadro oficial FIFA WC 2026
--
-- IZQUIERDA: ALE-PAR · FRA-SUE · RSA-CAN · PBA-MAR
--            POR-CRO · ESP-AUT · EEUU-BIH · BEL-SEN
-- DERECHA:   BRA-JPN · CMA-NOR · MEX-ECU · ING-RDC
--            ARG-CAV · AUS-EGI · SUI-AGL · COL-GHA
-- ═══════════════════════════════════════════════════════
INSERT INTO matches
  (competition_id, phase, match_number, status,
   home_team_id, away_team_id, kickoff_time, venue, city, country)
VALUES
  -- 29 jun — IZQUIERDA
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',201,'scheduled',
   '10000000-0000-4000-a000-000000000011','10000000-0000-4000-a000-000000000009',
   '2026-06-29 15:00:00 America/New_York','New York New Jersey Stadium','East Rutherford','USA'),
   -- ALE vs PAR

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',202,'scheduled',
   '10000000-0000-4000-a000-000000000021','10000000-0000-4000-a000-000000000017',
   '2026-06-29 19:00:00 America/Chicago','Dallas Stadium','Dallas','USA'),
   -- FRA vs SUE

  -- 29 jun — DERECHA
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',209,'scheduled',
   '10000000-0000-4000-a000-000000000001','10000000-0000-4000-a000-000000000016',
   '2026-06-29 15:00:00 America/Los_Angeles','Los Angeles Stadium','Los Angeles','USA'),
   -- BRA vs JPN

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',210,'scheduled',
   '10000000-0000-4000-a000-000000000013','10000000-0000-4000-a000-000000000024',
   '2026-06-29 19:00:00 America/New_York','Boston Stadium','Boston','USA'),
   -- CMA (CIV) vs NOR

  -- 30 jun — IZQUIERDA
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',203,'scheduled',
   '10000000-0000-4000-a000-00000000000d','10000000-0000-4000-a000-000000000005',
   '2026-06-30 15:00:00 America/New_York','Atlanta Stadium','Atlanta','USA'),
   -- RSA vs CAN

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',204,'scheduled',
   '10000000-0000-4000-a000-000000000015','10000000-0000-4000-a000-000000000002',
   '2026-06-30 19:00:00 America/Chicago','Houston Stadium','Houston','USA'),
   -- PBA (NED) vs MAR

  -- 30 jun — DERECHA
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',211,'scheduled',
   '10000000-0000-4000-a000-00000000000c','10000000-0000-4000-a000-000000000014',
   '2026-06-30 15:00:00 America/Mexico_City','Estadio Azteca','Ciudad de Mexico','Mexico'),
   -- MEX vs ECU

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',212,'scheduled',
   '10000000-0000-4000-a000-00000000002d','10000000-0000-4000-a000-00000000002a',
   '2026-06-30 19:00:00 America/New_York','Philadelphia Stadium','Philadelphia','USA'),
   -- ING (ENG) vs RDC (COD)

  -- 1 jul — IZQUIERDA
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',205,'scheduled',
   '10000000-0000-4000-a000-000000000029','10000000-0000-4000-a000-00000000002e',
   '2026-07-01 15:00:00 America/New_York','Miami Stadium','Miami','USA'),
   -- POR vs CRO

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',206,'scheduled',
   '10000000-0000-4000-a000-00000000001d','10000000-0000-4000-a000-000000000027',
   '2026-07-01 19:00:00 America/Chicago','Kansas City Stadium','Kansas City','USA'),
   -- ESP vs AUT

  -- 1 jul — DERECHA
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',213,'scheduled',
   '10000000-0000-4000-a000-000000000025','10000000-0000-4000-a000-00000000001e',
   '2026-07-01 15:00:00 America/Los_Angeles','Los Angeles Stadium','Los Angeles','USA'),
   -- ARG vs CAV (Cabo Verde)

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',214,'scheduled',
   '10000000-0000-4000-a000-00000000000a','10000000-0000-4000-a000-00000000001a',
   '2026-07-01 19:00:00 America/Vancouver','BC Place','Vancouver','Canada'),
   -- AUS vs EGI (Egipto)

  -- 2 jul — IZQUIERDA
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',207,'scheduled',
   '10000000-0000-4000-a000-000000000008','10000000-0000-4000-a000-000000000010',
   '2026-07-02 15:00:00 America/Chicago','Dallas Stadium','Dallas','USA'),
   -- EEUU (USA) vs BIH (Bosnia)

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',208,'scheduled',
   '10000000-0000-4000-a000-000000000019','10000000-0000-4000-a000-000000000022',
   '2026-07-02 19:00:00 America/New_York','New York New Jersey Stadium','East Rutherford','USA'),
   -- BEL vs SEN

  -- 2 jul — DERECHA
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',215,'scheduled',
   '10000000-0000-4000-a000-000000000007','10000000-0000-4000-a000-000000000026',
   '2026-07-02 15:00:00 America/New_York','Boston Stadium','Boston','USA'),
   -- SUI vs AGL (Argelia)

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','round_of_32',216,'scheduled',
   '10000000-0000-4000-a000-00000000002c','10000000-0000-4000-a000-00000000002f',
   '2026-07-02 19:00:00 America/New_York','Miami Stadium','Miami','USA')
   -- COL vs GHA ← Colombia en octavos

ON CONFLICT (competition_id, match_number) DO NOTHING;

COMMIT;
