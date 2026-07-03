-- ============================================================
-- Migration 038: Corrección de resultado — COL vs POR fue 0-0
--
-- El marcador cargado en la migración 033 (COL 2-1 POR, match 163)
-- era incorrecto: el partido real terminó 0-0. Esta corrección
-- arrastra en cascada:
--   1. El marcador del partido.
--   2. Sus match_statistics (se regeneran con las fórmulas de 036,
--      ahora derivadas del 0-0).
--   3. La tabla del Grupo K vía recalculate_group_standings().
--      ⚠️ CONSECUENCIA: POR y COL quedan con 7 pts; Portugal pasa
--      a 1º por diferencia de gol (+5 vs +4) y Colombia a 2º.
--
-- Después de esta migración RE-EJECUTAR la 037 (idempotente) para
-- refrescar team_statistics, y luego /api/sync/recalibrate.
-- ============================================================

BEGIN;

-- 1. Marcador real
UPDATE matches SET home_score = 0, away_score = 0
WHERE id = '169a7d17-ee2e-4040-a675-c06f984156ee';  -- COL vs POR, match 163

-- 2. Regenerar estadísticas del partido (mismas fórmulas deterministas de 036)
DELETE FROM match_statistics WHERE match_id = '169a7d17-ee2e-4040-a675-c06f984156ee';

WITH finished AS (
  SELECT m.id, m.home_team_id, m.away_team_id, m.home_score, m.away_score,
    LEAST(68.0, GREATEST(32.0,
      50.0 + (ht.elo_rating - at.elo_rating) / 30.0
      + ((abs(hashtext(m.id::text || 'poss')::bigint) % 100) / 100.0 - 0.5) * 8.0
    )) AS poss_home
  FROM matches m
  JOIN teams ht ON ht.id = m.home_team_id
  JOIN teams at ON at.id = m.away_team_id
  WHERE m.id = '169a7d17-ee2e-4040-a675-c06f984156ee'
),
sides AS (
  SELECT id AS match_id, home_team_id AS team_id, home_score AS gf, away_score AS ga, poss_home AS poss FROM finished
  UNION ALL
  SELECT id, away_team_id, away_score, home_score, 100.0 - poss_home FROM finished
),
noise AS (
  SELECT s.*,
    (abs(hashtext(s.match_id::text || s.team_id::text || 'a')::bigint) % 1000) / 1000.0 AS n1,
    (abs(hashtext(s.match_id::text || s.team_id::text || 'b')::bigint) % 1000) / 1000.0 AS n2,
    (abs(hashtext(s.match_id::text || s.team_id::text || 'c')::bigint) % 1000) / 1000.0 AS n3
  FROM sides s
),
base AS (
  SELECT n.*, GREATEST(0.25, n.gf * 0.72 + 0.45 + (n.n1 - 0.5) * 0.7)::numeric(5,2) AS xg FROM noise n
),
stats AS (
  SELECT b.*, LEAST(22, GREATEST(4, ROUND(b.xg * 7 + 3 + (b.n2 - 0.5) * 4)))::int AS shots FROM base b
),
full_stats AS (
  SELECT s.*,
    LEAST(s.shots, GREATEST(s.gf, ROUND(s.shots * 0.36 + s.gf * 0.4)))::int AS sot,
    LEAST(12, GREATEST(1, ROUND(2 + s.poss / 12.0 + (s.n1 - 0.5) * 3)))::int AS corners,
    ROUND(9 + s.n2 * 8)::int AS fouls,
    LEAST(4, ROUND(s.n3 * 3.2))::int AS yellow_cards,
    CASE WHEN abs(hashtext(s.match_id::text || s.team_id::text || 'red')::bigint) % 22 = 0 THEN 1 ELSE 0 END AS red_cards,
    ROUND(s.n1 * 4)::int AS offsides,
    ROUND(350 + s.poss * 6 + s.n2 * 120)::int AS passes,
    ROUND((76 + s.n3 * 12)::numeric, 1) AS pass_accuracy,
    LEAST(6, GREATEST(0, ROUND(s.xg * 1.5 + (s.n2 - 0.5))))::int AS big_chances
  FROM stats s
)
INSERT INTO match_statistics
  (match_id, team_id, possession, shots, shots_on_target, corners, fouls,
   yellow_cards, red_cards, offsides, passes, pass_accuracy, xg, xga,
   big_chances, big_chances_missed, saves)
SELECT
  fs.match_id, fs.team_id, ROUND(fs.poss::numeric, 1), fs.shots, fs.sot,
  fs.corners, fs.fouls, fs.yellow_cards, fs.red_cards, fs.offsides,
  fs.passes, fs.pass_accuracy, fs.xg, opp.xg, fs.big_chances,
  GREATEST(0, fs.big_chances - fs.gf), GREATEST(0, LEAST(10, opp.sot - fs.ga))
FROM full_stats fs
JOIN full_stats opp ON opp.match_id = fs.match_id AND opp.team_id <> fs.team_id;

-- 3. Recalcular la tabla del Grupo K desde los partidos
SELECT recalculate_group_standings(
  (SELECT id FROM groups WHERE letter = 'K'
   AND competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
);

COMMIT;

-- Verificación:
--   SELECT t.code, gs.won, gs.drawn, gs.lost, gs.goals_for, gs.goals_against, gs.points
--   FROM group_standings gs JOIN teams t ON t.id=gs.team_id
--   JOIN groups g ON g.id=gs.group_id WHERE g.letter='K'
--   ORDER BY gs.points DESC, (gs.goals_for - gs.goals_against) DESC;
--   -- Esperado: POR 7pts +5 · COL 7pts +4 · COD · UZB
