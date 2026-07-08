-- ============================================================
-- Verificación de migraciones aplicadas — correr en el SQL Editor
-- Cada fila = una migración con su "firma" (objeto/dato que crea).
-- ok=false → esa migración no está aplicada en esta base de datos.
--
-- Última auditoría completa: 2026-07-03 — 31/31 verificadas ✓
-- (la 017 y 019 se aplicaron ese día; estaban faltantes)
-- ============================================================

SELECT '001 schema inicial' AS migracion, EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='matches') AS ok
UNION ALL SELECT '002 seed 48 equipos', (SELECT count(*)=48 FROM teams WHERE competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890')
UNION ALL SELECT '003 sync_logs + notify', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='sync_logs') AND EXISTS(SELECT 1 FROM pg_proc WHERE proname='notify_value_bet')
UNION ALL SELECT '004 políticas public_read', EXISTS(SELECT 1 FROM pg_policies WHERE policyname='matches_public_read')
UNION ALL SELECT '005 calendario grupos', (SELECT count(*)=12 FROM groups)
UNION ALL SELECT '006 wc_form_score', EXISTS(SELECT 1 FROM pg_proc WHERE proname='wc_form_score')
UNION ALL SELECT '007 grant anon', has_table_privilege('anon','matches','SELECT')
UNION ALL SELECT '009 índice único value_bets', EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='uq_value_bets_match_market_bookmaker')
UNION ALL SELECT '010 grant service_role', has_table_privilege('service_role','matches','INSERT')
UNION ALL SELECT '011 vista market_consensus', EXISTS(SELECT 1 FROM information_schema.views WHERE table_name='match_market_consensus')
UNION ALL SELECT '012a fn recalc standings', EXISTS(SELECT 1 FROM pg_proc WHERE proname='recalculate_group_standings')
UNION ALL SELECT '012b simulation_results', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='simulation_results')
UNION ALL SELECT '014 tournament_simulations', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='tournament_simulations')
UNION ALL SELECT '015 fn resolve_prediction', EXISTS(SELECT 1 FROM pg_proc WHERE proname='resolve_prediction_on_match_finish')
UNION ALL SELECT '017 pesos 5 factores', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='predictions' AND column_name='xg_weight')
UNION ALL SELECT '018 team_stats corners', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='team_statistics' AND column_name='avg_corners')
UNION ALL SELECT '019 value_bets ai fields', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='value_bets' AND column_name='ai_justification')
UNION ALL SELECT '020 model_registry', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='model_registry')
UNION ALL SELECT '021 prediction_audit_log', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='prediction_audit_log')
UNION ALL SELECT '022 market_movements', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='market_movements')
UNION ALL SELECT '023 tournament_predictions', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='tournament_predictions')
UNION ALL SELECT '024 event_simulations', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='event_simulations')
UNION ALL SELECT '025 data_quality_score', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='predictions' AND column_name='data_quality_score')
UNION ALL SELECT '026 jugadores curados (78)', (SELECT count(*)>=78 FROM players)
UNION ALL SELECT '027/028 cuotas seed', (SELECT count(*)>0 FROM odds)
UNION ALL SELECT '029 mercados extendidos', (SELECT count(DISTINCT market)>5 FROM odds)
UNION ALL SELECT '031 amistosos pre-mundial', (SELECT count(*)=72 FROM matches WHERE competition_id='f1f2f3f4-f5f6-7890-abcd-ef1234567890')
UNION ALL SELECT '032 alineaciones', (SELECT count(*)>0 FROM lineups)
UNION ALL SELECT '033 grupos + R32 (WC2026)', (SELECT count(*)=72 FROM matches WHERE status='finished' AND phase='group' AND competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890') AND (SELECT count(*)=16 FROM matches WHERE phase='round_of_32')
UNION ALL SELECT '035 fechas R32 corregidas', EXISTS(SELECT 1 FROM matches WHERE phase='round_of_32' AND kickoff_time='2026-07-04 00:30:00+00')
UNION ALL SELECT '036 backfill match_statistics', (SELECT count(*)>=288 FROM match_statistics)
UNION ALL SELECT '040 procedencia (source)', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='match_statistics' AND column_name='source')
UNION ALL SELECT '041 núcleo multi-deporte', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='sports') AND EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='data_provenance') AND EXISTS(SELECT 1 FROM information_schema.views WHERE table_name='events_v')
UNION ALL SELECT '042 forma sin fuga de amistosos', NOT EXISTS(SELECT 1 FROM team_statistics ts JOIN teams t ON t.id=ts.team_id WHERE t.code='COL' AND array_to_string(ts.form,'') LIKE '%L%' AND ts.matches_played > 4)
UNION ALL SELECT '043 ligas PL/LaLiga', EXISTS(SELECT 1 FROM competitions WHERE name='Premier League' AND season='2024-25') AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='api_football_id') AND 'league' IN (SELECT unnest(enum_range(NULL::match_phase))::text)
UNION ALL SELECT '044 jornadas de liga', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='round') AND (SELECT count(DISTINCT round)=38 FROM matches WHERE competition_id='39000000-0000-4000-8000-000000000039' AND round IS NOT NULL)
ORDER BY 1;

-- Consistencia standings vs marcadores (debe devolver 0 filas):
-- WITH per_team AS (
--   SELECT t.id AS team_id,
--     SUM(CASE WHEN (m.home_team_id=t.id AND m.home_score>m.away_score) OR (m.away_team_id=t.id AND m.away_score>m.home_score) THEN 1 ELSE 0 END) AS w,
--     SUM(CASE WHEN m.home_score=m.away_score THEN 1 ELSE 0 END) AS d,
--     SUM(CASE WHEN (m.home_team_id=t.id AND m.home_score<m.away_score) OR (m.away_team_id=t.id AND m.away_score<m.home_score) THEN 1 ELSE 0 END) AS l,
--     SUM(CASE WHEN m.home_team_id=t.id THEN m.home_score ELSE m.away_score END) AS gf,
--     SUM(CASE WHEN m.home_team_id=t.id THEN m.away_score ELSE m.home_score END) AS ga
--   FROM teams t JOIN matches m ON (m.home_team_id=t.id OR m.away_team_id=t.id)
--   WHERE m.status='finished' AND m.phase='group' AND m.competition_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890'
--   GROUP BY t.id)
-- SELECT * FROM per_team p JOIN group_standings gs ON gs.team_id=p.team_id
-- WHERE gs.won<>p.w OR gs.drawn<>p.d OR gs.lost<>p.l OR gs.goals_for<>p.gf OR gs.goals_against<>p.ga;
