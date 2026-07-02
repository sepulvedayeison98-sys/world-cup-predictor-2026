-- ============================================================
-- Migration 036: Backfill de match_statistics para partidos
-- finalizados sin estadísticas (fase de grupos + R32 jugados).
--
-- Las estadísticas son SIMULADAS pero coherentes y deterministas:
--   · xG correlacionado con los goles reales del partido
--   · xGA de un equipo = xG del rival (consistencia interna)
--   · posesión repartida según diferencia de ELO (suma 100)
--   · tiros/córners/tarjetas derivados con ruido pseudoaleatorio
--     estable (hashtext del match_id + team_id): re-ejecutar la
--     migración produce exactamente los mismos valores.
--
-- Idempotente: ON CONFLICT (match_id, team_id) DO NOTHING.
-- ============================================================

BEGIN;

WITH finished AS (
  SELECT
    m.id,
    m.home_team_id,
    m.away_team_id,
    m.home_score,
    m.away_score,
    -- Posesión del local: 50 ± diferencia ELO/30 ± ruido, acotada 32..68
    LEAST(68.0, GREATEST(32.0,
      50.0
      + (ht.elo_rating - at.elo_rating) / 30.0
      + ((abs(hashtext(m.id::text || 'poss')::bigint) % 100) / 100.0 - 0.5) * 8.0
    )) AS poss_home
  FROM matches m
  JOIN teams ht ON ht.id = m.home_team_id
  JOIN teams at ON at.id = m.away_team_id
  WHERE m.status = 'finished'
    AND m.home_score IS NOT NULL
    AND m.away_score IS NOT NULL
),

sides AS (
  SELECT id AS match_id, home_team_id AS team_id, home_score AS gf, away_score AS ga, poss_home AS poss
  FROM finished
  UNION ALL
  SELECT id, away_team_id, away_score, home_score, 100.0 - poss_home
  FROM finished
),

noise AS (
  SELECT s.*,
    (abs(hashtext(s.match_id::text || s.team_id::text || 'a')::bigint) % 1000) / 1000.0 AS n1,
    (abs(hashtext(s.match_id::text || s.team_id::text || 'b')::bigint) % 1000) / 1000.0 AS n2,
    (abs(hashtext(s.match_id::text || s.team_id::text || 'c')::bigint) % 1000) / 1000.0 AS n3
  FROM sides s
),

base AS (
  SELECT n.*,
    -- xG correlacionado con goles: 0 goles → ~0.25-0.80, 2 goles → ~1.5-2.2
    GREATEST(0.25, n.gf * 0.72 + 0.45 + (n.n1 - 0.5) * 0.7)::numeric(5,2) AS xg
  FROM noise n
),

stats AS (
  SELECT b.*,
    LEAST(22, GREATEST(4, ROUND(b.xg * 7 + 3 + (b.n2 - 0.5) * 4)))::int AS shots
  FROM base b
),

full_stats AS (
  SELECT s.*,
    -- A puerta: ~36% de los tiros, nunca menos que los goles ni más que los tiros
    LEAST(s.shots, GREATEST(s.gf, ROUND(s.shots * 0.36 + s.gf * 0.4)))::int AS sot,
    LEAST(12, GREATEST(1, ROUND(2 + s.poss / 12.0 + (s.n1 - 0.5) * 3)))::int AS corners,
    ROUND(9 + s.n2 * 8)::int                                                  AS fouls,
    LEAST(4, ROUND(s.n3 * 3.2))::int                                          AS yellow_cards,
    CASE WHEN abs(hashtext(s.match_id::text || s.team_id::text || 'red')::bigint) % 22 = 0
         THEN 1 ELSE 0 END                                                    AS red_cards,
    ROUND(s.n1 * 4)::int                                                      AS offsides,
    ROUND(350 + s.poss * 6 + s.n2 * 120)::int                                 AS passes,
    ROUND((76 + s.n3 * 12)::numeric, 1)                                       AS pass_accuracy,
    LEAST(6, GREATEST(0, ROUND(s.xg * 1.5 + (s.n2 - 0.5))))::int              AS big_chances
  FROM stats s
)

INSERT INTO match_statistics
  (match_id, team_id, possession, shots, shots_on_target, corners, fouls,
   yellow_cards, red_cards, offsides, passes, pass_accuracy, xg, xga,
   big_chances, big_chances_missed, saves)
SELECT
  fs.match_id,
  fs.team_id,
  ROUND(fs.poss::numeric, 1),
  fs.shots,
  fs.sot,
  fs.corners,
  fs.fouls,
  fs.yellow_cards,
  fs.red_cards,
  fs.offsides,
  fs.passes,
  fs.pass_accuracy,
  fs.xg,
  opp.xg,                                        -- xGA = xG del rival
  fs.big_chances,
  GREATEST(0, fs.big_chances - fs.gf),           -- ocasiones falladas
  GREATEST(0, LEAST(10, opp.sot - fs.ga))        -- paradas = SOT rival - goles recibidos
FROM full_stats fs
JOIN full_stats opp
  ON opp.match_id = fs.match_id AND opp.team_id <> fs.team_id
ON CONFLICT (match_id, team_id) DO NOTHING;

COMMIT;

-- Verificación (opcional):
--   SELECT COUNT(*) FROM match_statistics;              -- ≈ 2 × partidos finalizados
--   SELECT ms.xg, ms.xga, ms.possession, m.home_score, m.away_score
--   FROM match_statistics ms JOIN matches m ON m.id = ms.match_id LIMIT 10;
--   -- La posesión de los dos equipos de un partido debe sumar 100:
--   SELECT match_id, SUM(possession) FROM match_statistics GROUP BY match_id
--   HAVING ABS(SUM(possession) - 100) > 0.2;
