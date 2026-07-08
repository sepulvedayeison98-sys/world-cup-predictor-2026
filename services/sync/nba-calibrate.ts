/**
 * Calibración del motor NBA: corre el backtest walk-forward sobre los
 * partidos ingestados y persiste ELO final, estadísticas de temporada
 * (récord W-L, puntos) y las predicciones evaluadas + las pre-partido
 * de los juegos por jugarse. No consume cuota de API.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { runNbaBacktest } from '@/lib/nbaEngine'
import { computeConfidenceLevel } from '@/lib/predictionEngine'
import { NBA_COMPETITION_ID, NBA_MODEL_VERSION } from '@/lib/nba'
import { fetchAllRows } from '@/lib/fetchAll'
import { syncSmartBetTracking } from '@/services/smartBetTracking'

export interface NbaCalibrationResult {
  teamsUpdated: number
  statsUpserted: number
  predictionsUpserted: number
  metrics: ReturnType<typeof runNbaBacktest>['metrics']
}

export async function calibrateNba(): Promise<NbaCalibrationResult> {
  const supabase = createAdminClient()

  // Paginado: la NBA supera el tope de 1000 filas de PostgREST
  const matches = await fetchAllRows((from, to) => supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_score, away_score, status, kickoff_time')
    .eq('competition_id', NBA_COMPETITION_ID)
    .range(from, to))
  if (!matches.length) throw new Error('No hay partidos NBA ingestados')

  const backtest = runNbaBacktest(matches as any[])

  // ── ELO final (solo equipos con partidos jugados) ─────────
  let teamsUpdated = 0
  for (const [teamId, elo] of backtest.finalElo) {
    if ((backtest.teamSeason.get(teamId)?.played ?? 0) === 0) continue
    const { error } = await (supabase.from('teams') as any)
      .update({ elo_rating: elo }).eq('id', teamId).eq('competition_id', NBA_COMPETITION_ID)
    if (error) throw new Error(`elo NBA: ${error.message}`)
    teamsUpdated++
  }

  // ── team_statistics: récord y anotación de temporada ──────
  const statRows = [...backtest.teamSeason.entries()]
    .filter(([, t]) => t.played > 0)
    .map(([teamId, t]) => ({
      team_id: teamId,
      competition_id: NBA_COMPETITION_ID,
      matches_played: t.played,
      goals_scored: t.points_for,       // en NBA: puntos a favor
      goals_conceded: t.points_against, // puntos en contra
      clean_sheets: 0,
      avg_goals_scored: t.played ? Math.round((t.points_for / t.played) * 10) / 10 : 0,
      avg_goals_conceded: t.played ? Math.round((t.points_against / t.played) * 10) / 10 : 0,
      // form del enum es W/D/L; NBA solo usa W/L
      form: t.form,
      updated_at: new Date().toISOString(),
    }))
  const { error: sErr } = await (supabase.from('team_statistics') as any)
    .upsert(statRows, { onConflict: 'team_id,competition_id' })
  if (sErr) throw new Error(`team_statistics NBA: ${sErr.message}`)

  // ── Predicciones (evaluadas + pre-partido) ────────────────
  const evaluated = backtest.predictions.map((p) => ({
    match_id: p.match_id,
    home_win_probability: p.home_win_probability,
    draw_probability: 0,
    away_win_probability: p.away_win_probability,
    predicted_home_score: p.predicted_home_score,
    predicted_away_score: p.predicted_away_score,
    confidence_level: computeConfidenceLevel(p.confidence_score),
    confidence_score: p.confidence_score,
    model_version: NBA_MODEL_VERSION,
    is_published: true,
    was_correct: p.correct,
    actual_outcome: p.actual,
    updated_at: new Date().toISOString(),
  }))
  const upcoming = backtest.upcoming.map((p) => ({
    match_id: p.match_id,
    home_win_probability: p.home_win_probability,
    draw_probability: 0,
    away_win_probability: p.away_win_probability,
    predicted_home_score: p.predicted_home_score,
    predicted_away_score: p.predicted_away_score,
    confidence_level: computeConfidenceLevel(p.confidence_score),
    confidence_score: p.confidence_score,
    model_version: NBA_MODEL_VERSION,
    is_published: true,
    was_correct: null,
    actual_outcome: null,
    updated_at: new Date().toISOString(),
  }))

  let predictionsUpserted = 0
  for (const rows of [evaluated, upcoming]) {
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200)
      const { error } = await (supabase.from('predictions') as any)
        .upsert(chunk, { onConflict: 'match_id' })
      if (error) throw new Error(`predictions NBA: ${error.message}`)
      predictionsUpserted += chunk.length
    }
  }

  await (supabase.from('sync_logs') as any).insert({
    source: 'api_basketball',
    entity_type: 'nba_calibrate',
    status: 'success',
    records_processed: predictionsUpserted,
    records_failed: 0,
    metadata: { model_version: NBA_MODEL_VERSION, metrics: backtest.metrics },
  })

  await syncSmartBetTracking()

  return { teamsUpdated, statsUpserted: statRows.length, predictionsUpserted, metrics: backtest.metrics }
}
