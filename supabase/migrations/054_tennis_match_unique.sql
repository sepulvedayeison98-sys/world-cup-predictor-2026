-- ============================================================
-- Migration 054: idempotencia de la ingesta de partidos de tenis
--
-- El sync de Sackmann (Fase 4) upserta partidos por external_id
-- (tourney_id-match_num). El id de torneo puede repetirse entre ATP y
-- WTA, así que la unicidad se ancla al torneo resuelto (UUID por
-- tour+temporada): (tournament_id, external_id). Re-correr el sync es
-- no-op — misma lección del fix de eventos duplicados (051).
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_tennis_matches_tournament_external
  ON tennis_matches (tournament_id, external_id);
