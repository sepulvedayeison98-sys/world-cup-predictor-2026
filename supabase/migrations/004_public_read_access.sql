-- ============================================================
-- Migration 004 — Acceso de lectura público (anon)
-- Permite que visitantes sin login lean los datos del Mundial.
-- La escritura sigue restringida a admin/analyst.
-- ============================================================

-- Otorgar lectura al rol anónimo en tablas de consulta pública
CREATE POLICY "competitions_public_read"    ON competitions    FOR SELECT TO anon USING (TRUE);
CREATE POLICY "groups_public_read"          ON groups          FOR SELECT TO anon USING (TRUE);
CREATE POLICY "teams_public_read"           ON teams           FOR SELECT TO anon USING (TRUE);
CREATE POLICY "team_statistics_public_read" ON team_statistics FOR SELECT TO anon USING (TRUE);
CREATE POLICY "group_standings_public_read" ON group_standings FOR SELECT TO anon USING (TRUE);
CREATE POLICY "players_public_read"         ON players         FOR SELECT TO anon USING (TRUE);
CREATE POLICY "player_statistics_public_read" ON player_statistics FOR SELECT TO anon USING (TRUE);
CREATE POLICY "matches_public_read"         ON matches         FOR SELECT TO anon USING (TRUE);
CREATE POLICY "match_statistics_public_read" ON match_statistics FOR SELECT TO anon USING (TRUE);
CREATE POLICY "lineups_public_read"         ON lineups         FOR SELECT TO anon USING (TRUE);
CREATE POLICY "lineup_players_public_read"  ON lineup_players  FOR SELECT TO anon USING (TRUE);
CREATE POLICY "injuries_public_read"        ON injuries        FOR SELECT TO anon USING (TRUE);
CREATE POLICY "odds_public_read"            ON odds            FOR SELECT TO anon USING (TRUE);
CREATE POLICY "value_bets_public_read"      ON value_bets      FOR SELECT TO anon USING (TRUE);
CREATE POLICY "exact_scores_public_read"    ON exact_score_predictions FOR SELECT TO anon USING (TRUE);
CREATE POLICY "prediction_history_public_read" ON prediction_history FOR SELECT TO anon USING (TRUE);

-- Solo predicciones publicadas visibles al público
CREATE POLICY "predictions_public_read" ON predictions FOR SELECT TO anon USING (is_published = TRUE);
