-- ============================================================
-- Migration 039: Infraestructura de progresión del torneo
--
-- 1. Columnas de penales en matches: en eliminatorias un empate se
--    define por penales y el ganador debe quedar registrado.
-- 2. backfill_missing_match_stats(): función que genera estadísticas
--    (fórmulas deterministas de la migración 036) para cualquier
--    partido finalizado que no las tenga. La llama el panel admin
--    al cerrar cada partido.
-- 3. refresh_team_statistics(): función que refresca team_statistics
--    (lógica de la migración 037) — últimos 10 partidos por equipo.
--
-- Con esto el flujo de resultados queda: /api/admin/result →
-- update marcador → backfill stats → standings (si grupo) →
-- refresh team stats → avance de bracket (lib/bracket.ts) →
-- recalibración de predicciones.
-- ============================================================

BEGIN;

-- ─── 1. Penales ──────────────────────────────────────────────
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS home_penalties INTEGER,
  ADD COLUMN IF NOT EXISTS away_penalties INTEGER;

-- ─── 2. Backfill de estadísticas de partido ──────────────────
CREATE OR REPLACE FUNCTION public.backfill_missing_match_stats()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted integer;
BEGIN
  WITH finished AS (
    SELECT m.id, m.home_team_id, m.away_team_id, m.home_score, m.away_score,
      LEAST(68.0, GREATEST(32.0,
        50.0 + (ht.elo_rating - at.elo_rating) / 30.0
        + ((abs(hashtext(m.id::text || 'poss')::bigint) % 100) / 100.0 - 0.5) * 8.0
      )) AS poss_home
    FROM matches m
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    WHERE m.status = 'finished'
      AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM match_statistics ms WHERE ms.match_id = m.id)
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
  st AS (
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
    FROM st s
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
  JOIN full_stats opp ON opp.match_id = fs.match_id AND opp.team_id <> fs.team_id
  ON CONFLICT (match_id, team_id) DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

-- ─── 3. Refresco de team_statistics ──────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_team_statistics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated integer;
BEGIN
  WITH team_matches AS (
    SELECT t.id AS team_id, m.kickoff_time,
      CASE WHEN m.home_team_id = t.id THEN m.home_score ELSE m.away_score END AS gf,
      CASE WHEN m.home_team_id = t.id THEN m.away_score ELSE m.home_score END AS ga,
      ms.possession, ms.shots, ms.shots_on_target, ms.corners,
      ms.yellow_cards, ms.red_cards, ms.xg, ms.xga
    FROM teams t
    JOIN matches m ON m.status = 'finished' AND m.home_score IS NOT NULL
      AND (m.home_team_id = t.id OR m.away_team_id = t.id)
    LEFT JOIN match_statistics ms ON ms.match_id = m.id AND ms.team_id = t.id
    WHERE t.competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  ),
  last10 AS (
    SELECT * FROM (
      SELECT tm.*, ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY kickoff_time DESC) AS rn
      FROM team_matches tm
    ) r WHERE rn <= 10
  ),
  agg AS (
    SELECT team_id, count(*)::int AS mp, SUM(gf)::int AS gs, SUM(ga)::int AS gc,
      SUM(CASE WHEN ga = 0 THEN 1 ELSE 0 END)::int AS cs,
      ROUND(AVG(gf)::numeric, 2) AS avg_gs, ROUND(AVG(ga)::numeric, 2) AS avg_gc,
      ROUND(COALESCE(AVG(possession), 50)::numeric, 1) AS avg_poss,
      ROUND(COALESCE(AVG(shots), 0)::numeric, 1) AS avg_shots,
      ROUND(COALESCE(AVG(shots_on_target), 0)::numeric, 1) AS avg_sot,
      ROUND(COALESCE(AVG(corners), 0)::numeric, 1) AS avg_corners,
      ROUND(COALESCE(AVG(yellow_cards), 0)::numeric, 2) AS avg_yc,
      ROUND(COALESCE(AVG(red_cards), 0)::numeric, 2) AS avg_rc,
      ROUND(COALESCE(AVG(xg), AVG(gf))::numeric, 2) AS avg_xg,
      ROUND(COALESCE(AVG(xga), AVG(ga))::numeric, 2) AS avg_xga
    FROM last10 GROUP BY team_id
  ),
  forms AS (
    SELECT team_id, array_agg(res ORDER BY kickoff_time ASC) AS form
    FROM (
      SELECT team_id, kickoff_time,
        (CASE WHEN gf > ga THEN 'W' WHEN gf = ga THEN 'D' ELSE 'L' END)::form_result AS res
      FROM last10
    ) s GROUP BY team_id
  )
  INSERT INTO team_statistics (
    team_id, competition_id, matches_played, goals_scored, goals_conceded,
    clean_sheets, avg_goals_scored, avg_goals_conceded, avg_possession,
    avg_shots, avg_shots_on_target, avg_corners, avg_yellow_cards,
    avg_red_cards, avg_xg, avg_xga, form, updated_at
  )
  SELECT a.team_id, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    a.mp, a.gs, a.gc, a.cs, a.avg_gs, a.avg_gc, a.avg_poss,
    a.avg_shots, a.avg_sot, a.avg_corners, a.avg_yc, a.avg_rc,
    a.avg_xg, a.avg_xga, f.form, NOW()
  FROM agg a JOIN forms f USING (team_id)
  ON CONFLICT (team_id, competition_id) DO UPDATE SET
    matches_played = EXCLUDED.matches_played,
    goals_scored = EXCLUDED.goals_scored,
    goals_conceded = EXCLUDED.goals_conceded,
    clean_sheets = EXCLUDED.clean_sheets,
    avg_goals_scored = EXCLUDED.avg_goals_scored,
    avg_goals_conceded = EXCLUDED.avg_goals_conceded,
    avg_possession = EXCLUDED.avg_possession,
    avg_shots = EXCLUDED.avg_shots,
    avg_shots_on_target = EXCLUDED.avg_shots_on_target,
    avg_corners = EXCLUDED.avg_corners,
    avg_yellow_cards = EXCLUDED.avg_yellow_cards,
    avg_red_cards = EXCLUDED.avg_red_cards,
    avg_xg = EXCLUDED.avg_xg,
    avg_xga = EXCLUDED.avg_xga,
    form = EXCLUDED.form,
    updated_at = NOW();

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$;

COMMIT;
