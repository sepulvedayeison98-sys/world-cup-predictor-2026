-- ─── Migración 028: Cuotas colombianas para todos los partidos reales ──────────
-- La migración 027 usó un match_id fijo que no existe → FK failure.
-- Esta migración limpia ese intento y genera cuotas para TODOS los partidos
-- de la tabla matches, usando Elo para los mercados de resultado y valores
-- representativos fijos para los mercados de goles/portería.
--
-- Márgenes por casa:
--   Betplay: ~8.2% (factor 0.918)
--   Wplay:   ~9.2% (factor 0.908)
--   Betson:  ~7.6% (factor 0.924)

-- Limpiar intentos anteriores de Betplay/Wplay/Betson
DELETE FROM odds WHERE bookmaker IN ('Betplay', 'Wplay', 'Betson');

INSERT INTO odds (match_id, bookmaker, market, odds_value, implied_probability, recorded_at)
WITH

-- ── 1. Elo base ─────────────────────────────────────────────────────────────
elo_base AS (
  SELECT
    m.id                                   AS match_id,
    COALESCE(ht.elo_rating, 1700)::FLOAT   AS he,
    COALESCE(at.elo_rating, 1700)::FLOAT   AS ae
  FROM matches m
  JOIN teams ht ON m.home_team_id = ht.id
  JOIN teams at ON m.away_team_id = at.id
),

-- ── 2. Probabilidades brutas (ventaja local = +60 Elo) ───────────────────────
raw_probs AS (
  SELECT
    match_id,
    1.0 / (1.0 + power(10.0, -(he - ae + 60.0) / 400.0))  AS p_home_raw
  FROM elo_base
),

-- ── 3. Estimar probabilidad de empate (decrece en partidos muy desiguales) ───
draw_est AS (
  SELECT
    match_id,
    p_home_raw,
    GREATEST(0.17, LEAST(0.30,
      0.255 - ABS(p_home_raw - 0.5) * 0.28
    )) AS p_draw
  FROM raw_probs
),

-- ── 4. Probabilidades finales (p_away = residual, mínimo 5%) ─────────────────
final_p AS (
  SELECT
    match_id,
    p_home_raw                                                  AS p_h,
    p_draw                                                      AS p_d,
    GREATEST(0.05, 1.0 - p_home_raw - p_draw)                  AS p_a
  FROM draw_est
),

-- ── 5. Mercados de resultado con margen por casa ─────────────────────────────
result_markets AS (
  SELECT match_id, 'Betplay'::TEXT AS bk, 'home_win'::odds_market AS mkt,
         GREATEST(1.01, ROUND((0.918 / p_h)::NUMERIC, 2)) AS ov
  FROM final_p
  UNION ALL
  SELECT match_id, 'Betplay', 'draw'::odds_market,
         GREATEST(1.01, ROUND((0.918 / p_d)::NUMERIC, 2))
  FROM final_p
  UNION ALL
  SELECT match_id, 'Betplay', 'away_win'::odds_market,
         GREATEST(1.01, ROUND((0.918 / p_a)::NUMERIC, 2))
  FROM final_p

  UNION ALL
  SELECT match_id, 'Wplay'::TEXT, 'home_win'::odds_market,
         GREATEST(1.01, ROUND((0.908 / p_h)::NUMERIC, 2))
  FROM final_p
  UNION ALL
  SELECT match_id, 'Wplay', 'draw'::odds_market,
         GREATEST(1.01, ROUND((0.908 / p_d)::NUMERIC, 2))
  FROM final_p
  UNION ALL
  SELECT match_id, 'Wplay', 'away_win'::odds_market,
         GREATEST(1.01, ROUND((0.908 / p_a)::NUMERIC, 2))
  FROM final_p

  UNION ALL
  SELECT match_id, 'Betson'::TEXT, 'home_win'::odds_market,
         GREATEST(1.01, ROUND((0.924 / p_h)::NUMERIC, 2))
  FROM final_p
  UNION ALL
  SELECT match_id, 'Betson', 'draw'::odds_market,
         GREATEST(1.01, ROUND((0.924 / p_d)::NUMERIC, 2))
  FROM final_p
  UNION ALL
  SELECT match_id, 'Betson', 'away_win'::odds_market,
         GREATEST(1.01, ROUND((0.924 / p_a)::NUMERIC, 2))
  FROM final_p
),

-- ── 6. Mercados secundarios fijos (valores representativos WC) ───────────────
sec_vals (bk, mrkt, ov) AS (
  VALUES
    ('Betplay', 'over_0_5',         1.07),
    ('Betplay', 'over_1_5',         1.30),
    ('Betplay', 'over_2_5',         1.95),
    ('Betplay', 'over_3_5',         3.60),
    ('Betplay', 'btts_yes',         1.95),
    ('Betplay', 'btts_no',          1.72),
    ('Betplay', 'clean_sheet_home', 2.10),
    ('Betplay', 'clean_sheet_away', 4.20),
    ('Wplay',   'over_0_5',         1.08),
    ('Wplay',   'over_1_5',         1.32),
    ('Wplay',   'over_2_5',         2.00),
    ('Wplay',   'over_3_5',         3.70),
    ('Wplay',   'btts_yes',         2.00),
    ('Wplay',   'btts_no',          1.75),
    ('Wplay',   'clean_sheet_home', 2.15),
    ('Wplay',   'clean_sheet_away', 4.30),
    ('Betson',  'over_0_5',         1.06),
    ('Betson',  'over_1_5',         1.28),
    ('Betson',  'over_2_5',         1.93),
    ('Betson',  'over_3_5',         3.55),
    ('Betson',  'btts_yes',         1.93),
    ('Betson',  'btts_no',          1.70),
    ('Betson',  'clean_sheet_home', 2.05),
    ('Betson',  'clean_sheet_away', 4.10)
),

sec_per_match AS (
  SELECT
    m.id                        AS match_id,
    s.bk                        AS bk,
    s.mrkt::odds_market         AS mkt,
    s.ov::NUMERIC(6,2)          AS ov
  FROM matches m
  CROSS JOIN sec_vals s
)

-- ── 7. Unir resultado + secundarios ─────────────────────────────────────────
SELECT
  match_id,
  bk                              AS bookmaker,
  mkt                             AS market,
  ov                              AS odds_value,
  ROUND((1.0 / ov)::NUMERIC, 4)  AS implied_probability,
  NOW()                           AS recorded_at
FROM result_markets

UNION ALL

SELECT
  match_id,
  bk,
  mkt,
  ov,
  ROUND((1.0 / ov)::NUMERIC, 4),
  NOW()
FROM sec_per_match;
