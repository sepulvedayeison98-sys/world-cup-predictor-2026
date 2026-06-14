-- ============================================================
-- WORLD CUP PREDICTOR — Migration 009: indice unico value_bets
--
-- El upsert de value bets (en /api/odds y en services/sync/odds.ts) usa
-- onConflict 'match_id,market,bookmaker', pero no existia el indice unico
-- que lo respalda -> el upsert fallaria. Esto lo crea.
--
-- Idempotente. El seed (002) tiene 2 value bets con combinaciones distintas,
-- asi que no hay conflicto al crear el indice.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_value_bets_match_market_bookmaker
  ON public.value_bets (match_id, market, bookmaker);
