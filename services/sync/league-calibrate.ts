/**
 * Calibración del motor de ligas (Fase 4).
 *
 * Corre el backtest walk-forward (lib/leagueEngine) sobre los partidos
 * ya ingestados de cada liga y persiste:
 *   - teams.elo_rating       → ELO final de la temporada por club
 *   - team_statistics        → agregados de temporada (forma, goles, etc.)
 *   - predictions            → predicción pre-partido de cada jornada
 *     evaluada (was_correct/actual_outcome), model_version 'liga-1.0'.
 *     is_published=true: la política RLS solo deja leer publicadas y las
 *     páginas /ligas las muestran. Las vistas del Mundial están blindadas
 *     por competition_id, así que no se mezclan.
 *
 * No consume cuota de API-Football: trabaja 100% con datos ya en la BD.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { runLeagueBacktest, type LeagueBacktestMetrics } from '@/lib/leagueEngine'
import { computeConfidenceLevel } from '@/lib/predictionEngine'
import { LEAGUE_COMPETITION_IDS } from '@/lib/constants'
import { syncSmartBetTracking } from '@/services/smartBetTracking'

export const LEAGUE_MODEL_VERSION = 'liga-1.0'

export interface LeagueCalibrationResult {
  key: string
  competitionId: string
  teamsUpdated: number
  statsUpserted: number
  predictionsUpserted: number
  metrics: LeagueBacktestMetrics
}

export async function calibrateLeagues(): Promise<{
  ok: boolean
  leagues: LeagueCalibrationResult[]
}> {
  const supabase = createAdminClient()
  const results: LeagueCalibrationResult[] = []

  for (const [key, competitionId] of Object.entries(LEAGUE_COMPETITION_IDS)) {
    const { data: matches, error: mErr } = await supabase
      .from('matches')
      .select('id, home_team_id, away_team_id, home_score, away_score, status, kickoff_time')
      .eq('competition_id', competitionId)
      // Solo temporada regular: los playoffs de descenso (round NULL) no
      // entran ni al ELO ni al backtest
      .not('round', 'is', null)
    if (mErr) throw new Error(`matches ${key}: ${mErr.message}`)
    if (!matches?.length) continue

    const backtest = runLeagueBacktest(matches as any[])

    // ── ELO final por club ───────────────────────────────────
    // Solo equipos con partidos jugados: en pretemporada no se pisa el
    // ELO existente con la base 1500.
    let teamsUpdated = 0
    for (const [teamId, elo] of backtest.finalElo) {
      if ((backtest.teamSeason.get(teamId)?.played ?? 0) === 0) continue
      const { error } = await (supabase.from('teams') as any)
        .update({ elo_rating: elo })
        .eq('id', teamId)
        .eq('competition_id', competitionId) // cinturón y tirantes
      if (error) throw new Error(`elo ${key}: ${error.message}`)
      teamsUpdated++
    }

    // ── Agregados de temporada → team_statistics ─────────────
    const statRows = [...backtest.teamSeason.entries()]
      .filter(([, t]) => t.played > 0)
      .map(([teamId, t]) => ({
      team_id: teamId,
      competition_id: competitionId,
      matches_played: t.played,
      goals_scored: t.goals_for,
      goals_conceded: t.goals_against,
      clean_sheets: t.clean_sheets,
      avg_goals_scored: t.played ? Math.round((t.goals_for / t.played) * 100) / 100 : 0,
      avg_goals_conceded: t.played ? Math.round((t.goals_against / t.played) * 100) / 100 : 0,
      // Sin boxscores de liga todavía: xG proxy = goles (documentado)
      avg_xg: t.played ? Math.round((t.goals_for / t.played) * 100) / 100 : 0,
      avg_xga: t.played ? Math.round((t.goals_against / t.played) * 100) / 100 : 0,
      form: t.form,
      updated_at: new Date().toISOString(),
      }))
    const { error: sErr } = await (supabase.from('team_statistics') as any)
      .upsert(statRows, { onConflict: 'team_id,competition_id' })
    if (sErr) throw new Error(`team_statistics ${key}: ${sErr.message}`)

    // ── Predicciones del backtest → predictions ──────────────
    const predRows = backtest.predictions.map((p) => ({
      match_id: p.match_id,
      home_win_probability: p.home_win_probability,
      draw_probability: p.draw_probability,
      away_win_probability: p.away_win_probability,
      predicted_home_score: p.predicted_home_score,
      predicted_away_score: p.predicted_away_score,
      confidence_level: computeConfidenceLevel(p.confidence_score),
      confidence_score: p.confidence_score,
      model_version: LEAGUE_MODEL_VERSION,
      is_published: true,
      was_correct: p.correct,
      actual_outcome: p.actual,
      updated_at: new Date().toISOString(),
    }))
    // Partidos programados/en vivo: predicción pre-partido con el estado
    // actual del modelo (modo "en vivo" para la temporada 2026-27).
    const upcomingRows = backtest.upcoming.map((p) => ({
      match_id: p.match_id,
      home_win_probability: p.home_win_probability,
      draw_probability: p.draw_probability,
      away_win_probability: p.away_win_probability,
      predicted_home_score: p.predicted_home_score,
      predicted_away_score: p.predicted_away_score,
      confidence_level: computeConfidenceLevel(p.confidence_score),
      confidence_score: p.confidence_score,
      model_version: LEAGUE_MODEL_VERSION,
      is_published: true,
      was_correct: null,
      actual_outcome: null,
      updated_at: new Date().toISOString(),
    }))

    let predictionsUpserted = 0
    for (const rows of [predRows, upcomingRows]) {
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200)
        const { error } = await (supabase.from('predictions') as any)
          .upsert(chunk, { onConflict: 'match_id' })
        if (error) throw new Error(`predictions ${key}: ${error.message}`)
        predictionsUpserted += chunk.length
      }
    }

    results.push({
      key,
      competitionId,
      teamsUpdated,
      statsUpserted: statRows.length,
      predictionsUpserted,
      metrics: backtest.metrics,
    })
  }

  await (supabase.from('sync_logs') as any).insert({
    source: 'api_football',
    entity_type: 'league_calibrate',
    status: 'success',
    records_processed: results.reduce((s, r) => s + r.predictionsUpserted, 0),
    records_failed: 0,
    metadata: { model_version: LEAGUE_MODEL_VERSION, leagues: results },
  })

  // Best-effort: congela/resuelve Smart Bets de las ligas (nunca rompe la calibración)
  await syncSmartBetTracking()

  return { ok: results.length > 0, leagues: results }
}
