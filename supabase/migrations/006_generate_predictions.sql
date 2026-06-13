-- ============================================================
-- WORLD CUP PREDICTOR — Migration 006: Generar predicciones
-- Genera una prediccion publicada para cada partido que aun no
-- tenga una. Replica en SQL la logica de app/api/predictions/route.ts
-- (el endpoint REST esta cerrado tras auth y la app es de acceso
-- libre, asi que se genera por SQL como superusuario).
--
-- Pesos del motor: forma 20%, calidad/ELO 25%, status jugadores 15%,
-- xG 15%, y tactico/motivacion/externo/h2h/odds neutros (0.5).
-- Idempotente: solo inserta donde NO existe prediccion.
-- ============================================================

BEGIN;

-- Helper: puntaje de forma (W=1, D=0.5, L=0) sobre los ultimos 5; 0.5 si vacio
CREATE OR REPLACE FUNCTION wc_form_score(f form_result[])
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    (SELECT AVG(CASE x WHEN 'W' THEN 1.0 WHEN 'D' THEN 0.5 ELSE 0.0 END)
     FROM unnest(
       CASE WHEN array_length(f,1) IS NULL THEN ARRAY[]::form_result[]
            ELSE f[greatest(1, array_length(f,1)-4):array_length(f,1)]
       END
     ) AS x),
    0.5);
$$ LANGUAGE sql IMMUTABLE;

-- ─── Insertar predicciones ────────────────────────────────────
WITH base AS (
  SELECT
    mt.id AS match_id,
    ht.elo_rating AS elo_h, at.elo_rating AS elo_a,
    wc_form_score(hts.form) AS fsh, wc_form_score(ats.form) AS fsa,
    COALESCE(hts.avg_xg, 1.2) AS xg_h, COALESCE(ats.avg_xg, 1.0) AS xg_a,
    COALESCE(hts.avg_goals_scored, 1.5) AS ags_h,
    COALESCE(ats.avg_goals_scored, 1.0) AS ags_a,
    COALESCE(ih.imp, 0) AS inj_h, COALESCE(ia.imp, 0) AS inj_a
  FROM matches mt
  JOIN teams ht ON ht.id = mt.home_team_id
  JOIN teams at ON at.id = mt.away_team_id
  LEFT JOIN team_statistics hts ON hts.team_id = mt.home_team_id
  LEFT JOIN team_statistics ats ON ats.team_id = mt.away_team_id
  LEFT JOIN (SELECT team_id, SUM(impact_score) imp FROM injuries WHERE is_active GROUP BY team_id) ih ON ih.team_id = mt.home_team_id
  LEFT JOIN (SELECT team_id, SUM(impact_score) imp FROM injuries WHERE is_active GROUP BY team_id) ia ON ia.team_id = mt.away_team_id
  WHERE mt.competition_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND NOT EXISTS (SELECT 1 FROM predictions p WHERE p.match_id = mt.id)
),
calc AS (
  SELECT *,
    -- ELO normalizado 0..1 (ventaja local)
    (1.0 / (1.0 + power(10, -(elo_h - elo_a) / 400.0))) AS norm_elo,
    -- inputs del motor
    (fsh - fsa + 0.5) AS in_form,
    (greatest(0.1, 1 - inj_h/50.0) - greatest(0.0, 1 - inj_a/50.0) + 0.5) AS in_pstatus,
    (xg_h / NULLIF(xg_h + xg_a, 0)) AS in_adv
  FROM base
),
strength AS (
  SELECT *,
    -- homeStrength ponderado; tactico/odds/motivacion/externo/h2h = 0.5
    least(0.95, greatest(0.05,
      in_form    * 0.20 +
      norm_elo   * 0.15 +   -- squadQuality
      in_pstatus * 0.15 +
      in_adv     * 0.15 +
      0.5        * 0.10 +   -- tactical
      norm_elo   * 0.10 +   -- elo
      0.5        * 0.05 +   -- odds
      0.5        * 0.05 +   -- motivation
      0.5        * 0.03 +   -- external
      0.5        * 0.02     -- h2h
    )) AS hs
  FROM calc
),
probs AS (
  SELECT *,
    greatest(0.04, 0.22 * (1 - abs(hs - 0.5) * 1.8)) AS draw_base
  FROM strength
),
raw AS (
  SELECT *,
    hs * (1 - draw_base) AS hw_raw,
    (1 - hs) * (1 - draw_base) AS aw_raw,
    (hs * (1 - draw_base)) + draw_base + ((1 - hs) * (1 - draw_base)) AS tot
  FROM probs
),
final AS (
  SELECT *,
    round((hw_raw / tot)::numeric, 4) AS home_win,
    round((draw_base / tot)::numeric, 4) AS draw_p
  FROM raw
),
final2 AS (
  SELECT *,
    round((1 - home_win - draw_p)::numeric, 4) AS away_win
  FROM final
),
scored AS (
  SELECT *,
    round(greatest(0, ags_h) * (home_win + draw_p * 0.5))::int AS pred_h,
    round(greatest(0, ags_a) * (away_win + draw_p * 0.5))::int AS pred_a,
    least(95, greatest(40, 65 + abs(hs - 0.5) * 60 - (inj_h + inj_a) * 0.5))::numeric(5,2) AS conf
  FROM final2
)
INSERT INTO predictions (
  match_id, home_win_probability, draw_probability, away_win_probability,
  predicted_home_score, predicted_away_score,
  confidence_level, confidence_score, model_version, is_published
)
SELECT
  match_id, home_win, draw_p, away_win,
  pred_h, pred_a,
  CASE WHEN conf >= 85 THEN 5 WHEN conf >= 75 THEN 4
       WHEN conf >= 65 THEN 3 WHEN conf >= 55 THEN 2 ELSE 1 END,
  conf, '1.0.0', TRUE
FROM scored
ON CONFLICT (match_id) DO NOTHING;

-- ─── Exact score predictions (top-6 por prediccion nueva) ─────
-- Distribucion simple alrededor del marcador previsto, ponderada
-- por la probabilidad 1X2. Solo para predicciones sin exact scores.
DO $$
DECLARE
  p RECORD;
  ph INT; pa INT;
  cand RECORD;
  rk INT;
BEGIN
  FOR p IN
    SELECT pr.id, pr.predicted_home_score h, pr.predicted_away_score a,
           pr.home_win_probability hw, pr.draw_probability dr, pr.away_win_probability aw
    FROM predictions pr
    WHERE NOT EXISTS (SELECT 1 FROM exact_score_predictions e WHERE e.prediction_id = pr.id)
  LOOP
    ph := p.h; pa := p.a;
    rk := 0;
    FOR cand IN
      SELECT s.hs, s.as_, s.prob FROM (
        VALUES
          (ph,            pa,            0.30 * GREATEST(p.hw, p.dr, p.aw) + 0.10),
          (ph + 1,        pa,            0.18 * p.hw + 0.02),
          (ph,            pa + 1,        0.18 * p.aw + 0.02),
          (GREATEST(ph-1,0), pa,         0.10 * p.hw + 0.02),
          (ph,            GREATEST(pa-1,0), 0.10 * p.aw + 0.02),
          (LEAST(ph,pa),  LEAST(ph,pa),  0.16 * p.dr + 0.02)
      ) AS s(hs, as_, prob)
      ORDER BY s.prob DESC
    LOOP
      rk := rk + 1;
      EXIT WHEN rk > 6;
      INSERT INTO exact_score_predictions (prediction_id, home_score, away_score, probability, rank)
      VALUES (p.id, cand.hs, cand.as_, round(cand.prob::numeric, 4), rk)
      ON CONFLICT (prediction_id, rank) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

COMMIT;

-- Verificacion:
--   SELECT COUNT(*) FROM predictions;                 -- esperado: 72
--   SELECT COUNT(*) FROM predictions WHERE is_published; -- 72
--   SELECT m.match_number, ht.code, pr.home_win_probability, pr.draw_probability,
--          pr.away_win_probability, pr.predicted_home_score, pr.predicted_away_score
--   FROM predictions pr JOIN matches m ON m.id=pr.match_id
--   JOIN teams ht ON ht.id=m.home_team_id ORDER BY m.kickoff_time LIMIT 10;
