-- ============================================================
-- WORLD CUP PREDICTOR — Migration 011: vista de consenso de mercado
--
-- Promedia la probabilidad implicita de las cuotas 1X2 por partido
-- (ultimas 48h, todas las casas) para la calibracion de predicciones
-- (services/sync/recalibrate.ts mezcla modelo + consenso de mercado).
-- ============================================================

CREATE OR REPLACE VIEW public.match_market_consensus AS
SELECT
  match_id,
  market,
  AVG(implied_probability)::numeric(6,4) AS avg_implied,
  COUNT(*) AS samples
FROM public.odds
WHERE market IN ('home_win', 'draw', 'away_win')
  AND recorded_at > NOW() - INTERVAL '2 days'
GROUP BY match_id, market;

GRANT SELECT ON public.match_market_consensus TO anon, authenticated, service_role;
