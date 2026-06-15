-- ============================================================
-- WORLD CUP PREDICTOR — Migration 012: arreglo del orden de la "forma"
--
-- FIX (AUDIT 🔴-2): recalculate_group_standings construia la racha con
--   array_agg(result ORDER BY result)  -> ordenaba ALFABETICAMENTE (D,L,W),
-- no cronologicamente. La "forma reciente" en las tablas de grupos quedaba
-- sin sentido temporal. Se cambia a ORDER BY kickoff_time.
--
-- De paso (AUDIT 🟡-6): se fija search_path en esta funcion SECURITY DEFINER.
-- Al final se recalculan los grupos para refrescar los standings ya cargados.
-- ============================================================

CREATE OR REPLACE FUNCTION recalculate_group_standings(p_group_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE group_standings
  SET played = 0, won = 0, drawn = 0, lost = 0,
      goals_for = 0, goals_against = 0, form = '{}'
  WHERE group_id = p_group_id;

  WITH match_results AS (
    SELECT
      m.home_team_id AS team_id,
      m.home_score AS gf,
      m.away_score AS ga,
      m.kickoff_time,
      CASE
        WHEN m.home_score > m.away_score THEN 'W'::form_result
        WHEN m.home_score = m.away_score THEN 'D'::form_result
        ELSE 'L'::form_result
      END AS result
    FROM matches m
    WHERE m.group_id = p_group_id AND m.status = 'finished'
    UNION ALL
    SELECT
      m.away_team_id,
      m.away_score,
      m.home_score,
      m.kickoff_time,
      CASE
        WHEN m.away_score > m.home_score THEN 'W'::form_result
        WHEN m.away_score = m.home_score THEN 'D'::form_result
        ELSE 'L'::form_result
      END
    FROM matches m
    WHERE m.group_id = p_group_id AND m.status = 'finished'
  ),
  aggregated AS (
    SELECT
      team_id,
      COUNT(*) AS played,
      COUNT(*) FILTER (WHERE result = 'W') AS won,
      COUNT(*) FILTER (WHERE result = 'D') AS drawn,
      COUNT(*) FILTER (WHERE result = 'L') AS lost,
      SUM(gf) AS goals_for,
      SUM(ga) AS goals_against,
      array_agg(result ORDER BY kickoff_time) AS form   -- cronologico (FIX)
    FROM match_results
    GROUP BY team_id
  )
  UPDATE group_standings gs
  SET
    played = a.played,
    won = a.won,
    drawn = a.drawn,
    lost = a.lost,
    goals_for = a.goals_for,
    goals_against = a.goals_against,
    form = a.form
  FROM aggregated a
  WHERE gs.team_id = a.team_id AND gs.group_id = p_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

-- Refrescar standings ya cargados con la forma corregida
DO $$
DECLARE g RECORD;
BEGIN
  FOR g IN
    SELECT id FROM groups WHERE competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  LOOP
    PERFORM recalculate_group_standings(g.id);
  END LOOP;
END $$;
