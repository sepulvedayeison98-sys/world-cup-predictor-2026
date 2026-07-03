-- ============================================================
-- Migration 037: Poblar team_statistics con datos reales del torneo
--
-- Problema que corrige: team_statistics estaba VACÍA, así que la
-- recalibración alimentaba el motor con defaults idénticos para los
-- 48 equipos (xG 1.1 vs 1.1, forma neutra) → todas las predicciones
-- salían casi iguales (1-1 / 1-0) y las Smart Bets se aplanaban.
--
-- Agrega por equipo los últimos 10 partidos finalizados (fase de
-- grupos + amistosos pre-mundial) usando match_statistics (xG,
-- posesión, tiros, córners, tarjetas del backfill 036) y construye
-- el array de forma W/D/L en orden cronológico (más reciente al final,
-- como espera formToScore del motor).
--
-- Idempotente: ON CONFLICT (team_id, competition_id) DO UPDATE.
-- Re-ejecutar tras cada jornada actualiza las medias.
-- ============================================================

BEGIN;

WITH team_matches AS (
  SELECT
    t.id AS team_id,
    m.kickoff_time,
    CASE WHEN m.home_team_id = t.id THEN m.home_score ELSE m.away_score END AS gf,
    CASE WHEN m.home_team_id = t.id THEN m.away_score ELSE m.home_score END AS ga,
    ms.possession, ms.shots, ms.shots_on_target, ms.corners,
    ms.yellow_cards, ms.red_cards, ms.xg, ms.xga
  FROM teams t
  JOIN matches m
    ON m.status = 'finished'
   AND m.home_score IS NOT NULL
   AND (m.home_team_id = t.id OR m.away_team_id = t.id)
  LEFT JOIN match_statistics ms
    ON ms.match_id = m.id AND ms.team_id = t.id
  WHERE t.competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
),

last10 AS (
  SELECT * FROM (
    SELECT tm.*, ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY kickoff_time DESC) AS rn
    FROM team_matches tm
  ) r WHERE rn <= 10
),

agg AS (
  SELECT
    team_id,
    count(*)::int                                            AS mp,
    SUM(gf)::int                                             AS gs,
    SUM(ga)::int                                             AS gc,
    SUM(CASE WHEN ga = 0 THEN 1 ELSE 0 END)::int             AS cs,
    ROUND(AVG(gf)::numeric, 2)                               AS avg_gs,
    ROUND(AVG(ga)::numeric, 2)                               AS avg_gc,
    ROUND(COALESCE(AVG(possession), 50)::numeric, 1)         AS avg_poss,
    ROUND(COALESCE(AVG(shots), 0)::numeric, 1)               AS avg_shots,
    ROUND(COALESCE(AVG(shots_on_target), 0)::numeric, 1)     AS avg_sot,
    ROUND(COALESCE(AVG(corners), 0)::numeric, 1)             AS avg_corners,
    ROUND(COALESCE(AVG(yellow_cards), 0)::numeric, 2)        AS avg_yc,
    ROUND(COALESCE(AVG(red_cards), 0)::numeric, 2)           AS avg_rc,
    ROUND(COALESCE(AVG(xg), AVG(gf))::numeric, 2)            AS avg_xg,
    ROUND(COALESCE(AVG(xga), AVG(ga))::numeric, 2)           AS avg_xga
  FROM last10
  GROUP BY team_id
),

forms AS (
  SELECT
    team_id,
    array_agg(res ORDER BY kickoff_time ASC) AS form
  FROM (
    SELECT team_id, kickoff_time,
      (CASE WHEN gf > ga THEN 'W' WHEN gf = ga THEN 'D' ELSE 'L' END)::form_result AS res
    FROM last10
  ) s
  GROUP BY team_id
)

INSERT INTO team_statistics (
  team_id, competition_id, matches_played, goals_scored, goals_conceded,
  clean_sheets, avg_goals_scored, avg_goals_conceded, avg_possession,
  avg_shots, avg_shots_on_target, avg_corners, avg_yellow_cards,
  avg_red_cards, avg_xg, avg_xga, form, updated_at
)
SELECT
  a.team_id, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  a.mp, a.gs, a.gc, a.cs, a.avg_gs, a.avg_gc, a.avg_poss,
  a.avg_shots, a.avg_sot, a.avg_corners, a.avg_yc, a.avg_rc,
  a.avg_xg, a.avg_xga, f.form, NOW()
FROM agg a
JOIN forms f USING (team_id)
ON CONFLICT (team_id, competition_id) DO UPDATE SET
  matches_played      = EXCLUDED.matches_played,
  goals_scored        = EXCLUDED.goals_scored,
  goals_conceded      = EXCLUDED.goals_conceded,
  clean_sheets        = EXCLUDED.clean_sheets,
  avg_goals_scored    = EXCLUDED.avg_goals_scored,
  avg_goals_conceded  = EXCLUDED.avg_goals_conceded,
  avg_possession      = EXCLUDED.avg_possession,
  avg_shots           = EXCLUDED.avg_shots,
  avg_shots_on_target = EXCLUDED.avg_shots_on_target,
  avg_corners         = EXCLUDED.avg_corners,
  avg_yellow_cards    = EXCLUDED.avg_yellow_cards,
  avg_red_cards       = EXCLUDED.avg_red_cards,
  avg_xg              = EXCLUDED.avg_xg,
  avg_xga             = EXCLUDED.avg_xga,
  form                = EXCLUDED.form,
  updated_at          = NOW();

COMMIT;

-- Verificación:
--   SELECT count(*) FROM team_statistics;   -- esperado: 48
--   SELECT t.code, ts.avg_xg, ts.avg_xga, ts.form FROM team_statistics ts
--   JOIN teams t ON t.id = ts.team_id ORDER BY ts.avg_xg DESC LIMIT 8;
