-- ─── Migración 029: Extender odds_market ENUM + cuotas DC/corners/tarjetas/disparos ──
-- Agrega los mercados que sí ofrecen Betplay, Wplay y Betson pero faltaban en el ENUM.

-- ── 1. Ampliar el ENUM ───────────────────────────────────────────────────────────
ALTER TYPE odds_market ADD VALUE IF NOT EXISTS 'dc_1x';
ALTER TYPE odds_market ADD VALUE IF NOT EXISTS 'dc_x2';
ALTER TYPE odds_market ADD VALUE IF NOT EXISTS 'corners_8_5';
ALTER TYPE odds_market ADD VALUE IF NOT EXISTS 'corners_9_5';
ALTER TYPE odds_market ADD VALUE IF NOT EXISTS 'corners_10_5';
ALTER TYPE odds_market ADD VALUE IF NOT EXISTS 'cards_2_5';
ALTER TYPE odds_market ADD VALUE IF NOT EXISTS 'cards_3_5';
ALTER TYPE odds_market ADD VALUE IF NOT EXISTS 'cards_4_5';
ALTER TYPE odds_market ADD VALUE IF NOT EXISTS 'shots_ot_5_5';
ALTER TYPE odds_market ADD VALUE IF NOT EXISTS 'shots_ot_7_5';

-- ── 2. Insertar cuotas para todos los partidos ────────────────────────────────────
-- dc_1x / dc_x2 → derivados del Elo (p_h + p_d) y (p_d + p_a)
-- Resto → valores representativos fijos (típicos WC 2026)

INSERT INTO odds (match_id, bookmaker, market, odds_value, implied_probability, recorded_at)
WITH

elo_base AS (
  SELECT
    m.id                                   AS match_id,
    COALESCE(ht.elo_rating, 1700)::FLOAT   AS he,
    COALESCE(at.elo_rating, 1700)::FLOAT   AS ae
  FROM matches m
  JOIN teams ht ON m.home_team_id = ht.id
  JOIN teams at ON m.away_team_id = at.id
),

raw_probs AS (
  SELECT
    match_id,
    1.0 / (1.0 + power(10.0, -(he - ae + 60.0) / 400.0)) AS p_h_raw
  FROM elo_base
),

draw_est AS (
  SELECT
    match_id,
    p_h_raw,
    GREATEST(0.17, LEAST(0.30,
      0.255 - ABS(p_h_raw - 0.5) * 0.28
    )) AS p_d
  FROM raw_probs
),

final_p AS (
  SELECT
    match_id,
    p_h_raw                                     AS p_h,
    p_d                                         AS p_d,
    GREATEST(0.05, 1.0 - p_h_raw - p_d)        AS p_a
  FROM draw_est
),

-- ── Doble oportunidad (Elo-derived) ──────────────────────────────────────────────
dc_markets AS (
  -- dc_1x = p_h + p_d
  SELECT match_id, 'Betplay'::TEXT AS bk, 'dc_1x'::odds_market AS mkt,
         GREATEST(1.01, ROUND((0.918 / NULLIF(p_h + p_d, 0))::NUMERIC, 2)) AS ov
  FROM final_p
  UNION ALL
  SELECT match_id, 'Wplay',  'dc_1x'::odds_market,
         GREATEST(1.01, ROUND((0.908 / NULLIF(p_h + p_d, 0))::NUMERIC, 2))
  FROM final_p
  UNION ALL
  SELECT match_id, 'Betson', 'dc_1x'::odds_market,
         GREATEST(1.01, ROUND((0.924 / NULLIF(p_h + p_d, 0))::NUMERIC, 2))
  FROM final_p

  -- dc_x2 = p_d + p_a
  UNION ALL
  SELECT match_id, 'Betplay', 'dc_x2'::odds_market,
         GREATEST(1.01, ROUND((0.918 / NULLIF(p_d + p_a, 0))::NUMERIC, 2))
  FROM final_p
  UNION ALL
  SELECT match_id, 'Wplay',  'dc_x2'::odds_market,
         GREATEST(1.01, ROUND((0.908 / NULLIF(p_d + p_a, 0))::NUMERIC, 2))
  FROM final_p
  UNION ALL
  SELECT match_id, 'Betson', 'dc_x2'::odds_market,
         GREATEST(1.01, ROUND((0.924 / NULLIF(p_d + p_a, 0))::NUMERIC, 2))
  FROM final_p
),

-- ── Mercados fijos (corners, tarjetas, disparos) ─────────────────────────────────
fixed_vals (bk, mrkt, ov) AS (
  VALUES
    -- Corners
    ('Betplay', 'corners_8_5',  1.87),
    ('Betplay', 'corners_9_5',  2.22),
    ('Betplay', 'corners_10_5', 2.82),
    ('Wplay',   'corners_8_5',  1.90),
    ('Wplay',   'corners_9_5',  2.28),
    ('Wplay',   'corners_10_5', 2.88),
    ('Betson',  'corners_8_5',  1.85),
    ('Betson',  'corners_9_5',  2.19),
    ('Betson',  'corners_10_5', 2.78),
    -- Tarjetas
    ('Betplay', 'cards_2_5',    1.75),
    ('Betplay', 'cards_3_5',    2.50),
    ('Betplay', 'cards_4_5',    3.80),
    ('Wplay',   'cards_2_5',    1.78),
    ('Wplay',   'cards_3_5',    2.55),
    ('Wplay',   'cards_4_5',    3.90),
    ('Betson',  'cards_2_5',    1.72),
    ('Betson',  'cards_3_5',    2.45),
    ('Betson',  'cards_4_5',    3.70),
    -- Disparos a puerta
    ('Betplay', 'shots_ot_5_5', 1.65),
    ('Betplay', 'shots_ot_7_5', 2.30),
    ('Wplay',   'shots_ot_5_5', 1.68),
    ('Wplay',   'shots_ot_7_5', 2.35),
    ('Betson',  'shots_ot_5_5', 1.62),
    ('Betson',  'shots_ot_7_5', 2.25)
),

fixed_per_match AS (
  SELECT
    m.id                    AS match_id,
    f.bk                    AS bk,
    f.mrkt::odds_market     AS mkt,
    f.ov::NUMERIC(6,2)      AS ov
  FROM matches m
  CROSS JOIN fixed_vals f
)

SELECT
  match_id,
  bk                              AS bookmaker,
  mkt                             AS market,
  ov                              AS odds_value,
  ROUND((1.0 / ov)::NUMERIC, 4)  AS implied_probability,
  NOW()                           AS recorded_at
FROM dc_markets

UNION ALL

SELECT
  match_id,
  bk,
  mkt,
  ov,
  ROUND((1.0 / ov)::NUMERIC, 4),
  NOW()
FROM fixed_per_match;
