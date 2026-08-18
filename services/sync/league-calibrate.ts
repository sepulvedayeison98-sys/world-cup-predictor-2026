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
import { LEAGUE_COMPETITION_IDS, LIBERTADORES_COMPETITION_ID } from '@/lib/constants'
import { syncSmartBetTracking } from '@/services/smartBetTracking'

export const LEAGUE_MODEL_VERSION = 'liga-1.0'
// Copa Libertadores reutiliza el MISMO motor walk-forward (runLeagueBacktest
// no asume tabla de temporada continua: solo recorre partidos en orden
// cronológico), pero es una calibración aparte — versión de modelo propia
// para no mezclar la métrica de precisión con la de las ligas.
export const LIBERTADORES_MODEL_VERSION = 'copa-1.0'

export interface LeagueCalibrationResult {
  key: string
  competitionId: string
  teamsUpdated: number
  statsUpserted: number
  predictionsUpserted: number
  metrics: LeagueBacktestMetrics
}

/**
 * Corre el backtest walk-forward sobre los partidos de UNA competición y
 * persiste ELO, agregados de temporada y predicciones evaluadas. Compartido
 * por `calibrateLeagues` (una liga por clave) y `calibrateLibertadores` (una
 * sola competición, sin clave de liga).
 *
 * `requireRound`: las ligas excluyen partidos con `round` NULL (playoffs de
 * descenso, fuera del backtest). Libertadores NO tiene ese filtro — sus
 * eliminatorias (ida/vuelta) se guardan justamente con `round` NULL
 * (services/sync/libertadores-ingest.ts), así que exigirlo dejaría fuera
 * toda la fase de eliminación directa, que es donde más importa el ELO.
 */
async function calibrateCompetition(
  supabase: ReturnType<typeof createAdminClient>,
  label: string,
  competitionId: string,
  modelVersion: string,
  requireRound: boolean,
): Promise<Omit<LeagueCalibrationResult, 'key' | 'competitionId'> | null> {
  let query = supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_score, away_score, status, kickoff_time')
    .eq('competition_id', competitionId)
  if (requireRound) query = query.not('round', 'is', null)
  const { data: matches, error: mErr } = await query
  if (mErr) throw new Error(`matches ${label}: ${mErr.message}`)
  if (!matches?.length) return null

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
    if (error) throw new Error(`elo ${label}: ${error.message}`)
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
    // Sin boxscores propios todavía: xG proxy = goles (documentado)
    avg_xg: t.played ? Math.round((t.goals_for / t.played) * 100) / 100 : 0,
    avg_xga: t.played ? Math.round((t.goals_against / t.played) * 100) / 100 : 0,
    form: t.form,
    updated_at: new Date().toISOString(),
    }))
  const { error: sErr } = await (supabase.from('team_statistics') as any)
    .upsert(statRows, { onConflict: 'team_id,competition_id' })
  if (sErr) throw new Error(`team_statistics ${label}: ${sErr.message}`)

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
    model_version: modelVersion,
    is_published: true,
    was_correct: p.correct,
    actual_outcome: p.actual,
    updated_at: new Date().toISOString(),
  }))
  // Partidos programados/en vivo: predicción pre-partido con el estado
  // actual del modelo (modo "en vivo").
  const upcomingRows = backtest.upcoming.map((p) => ({
    match_id: p.match_id,
    home_win_probability: p.home_win_probability,
    draw_probability: p.draw_probability,
    away_win_probability: p.away_win_probability,
    predicted_home_score: p.predicted_home_score,
    predicted_away_score: p.predicted_away_score,
    confidence_level: computeConfidenceLevel(p.confidence_score),
    confidence_score: p.confidence_score,
    model_version: modelVersion,
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
      if (error) throw new Error(`predictions ${label}: ${error.message}`)
      predictionsUpserted += chunk.length
    }
  }

  return { teamsUpdated, statsUpserted: statRows.length, predictionsUpserted, metrics: backtest.metrics }
}

/**
 * Calibra el motor por liga. `onlyKeys` acota la corrida: con la temporada en
 * curso cada liga implica cientos de partidos (jugados + próximos) y las seis
 * juntas superan el límite de 60 s de la función serverless.
 */
export async function calibrateLeagues(onlyKeys?: string[], withSmartBets = false): Promise<{
  ok: boolean
  leagues: LeagueCalibrationResult[]
}> {
  const supabase = createAdminClient()
  const results: LeagueCalibrationResult[] = []

  const entries = Object.entries(LEAGUE_COMPETITION_IDS)
    .filter(([key]) => !onlyKeys?.length || onlyKeys.includes(key))
  if (entries.length === 0) throw new Error(`Ninguna liga coincide con: ${onlyKeys?.join(',')}`)

  for (const [key, competitionId] of entries) {
    const outcome = await calibrateCompetition(supabase, key, competitionId, LEAGUE_MODEL_VERSION, true)
    if (!outcome) continue
    results.push({ key, competitionId, ...outcome })
  }

  await (supabase.from('sync_logs') as any).insert({
    source: 'api_football',
    entity_type: 'league_calibrate',
    status: 'success',
    records_processed: results.reduce((s, r) => s + r.predictionsUpserted, 0),
    records_failed: 0,
    metadata: { model_version: LEAGUE_MODEL_VERSION, leagues: results },
  })

  // Smart Bets: DESACOPLADO a propósito (2026-08). Iba aquí como
  // "best-effort", pero al pasar a una competición por temporada la lista
  // blanca de fútbol creció de 7 a 13 competiciones y esta llamada pasó a
  // costar ~160 s medidos — ella sola agotaba el límite de 60 s de la
  // función y hacía fallar con 504 toda la calibración (que en sí tarda
  // ~2,4 s). Tiene su propio endpoint: GET /api/sync/smart-bets.
  // Se puede seguir encadenando con ?withBets=1 cuando haya presupuesto.
  if (withSmartBets) await syncSmartBetTracking()

  return { ok: results.length > 0, leagues: results }
}

/**
 * Calibra Copa Libertadores con el mismo motor walk-forward de las ligas.
 * Antes quedaba fuera: `teams.elo_rating` de sus 32 clubes se quedaba fijo
 * en la base 1500 (libertadores-ingest.ts nunca lo toca) y las páginas de
 * partido calculaban la predicción al vuelo, sin guardarla, cada vez.
 *
 * Sin `?league=`: es una sola competición, no una lista para acotar. Sin
 * filtro de `round` (a diferencia de las ligas): sus eliminatorias
 * (ida/vuelta) se ingestan justamente con `round` NULL, y excluirlas
 * dejaría fuera toda la fase que más le importa al ELO.
 */
export async function calibrateLibertadores(): Promise<{
  ok: boolean
  result: LeagueCalibrationResult | null
}> {
  const supabase = createAdminClient()
  const key = 'copa_libertadores'
  const outcome = await calibrateCompetition(
    supabase, key, LIBERTADORES_COMPETITION_ID, LIBERTADORES_MODEL_VERSION, false,
  )
  const result = outcome ? { key, competitionId: LIBERTADORES_COMPETITION_ID, ...outcome } : null

  await (supabase.from('sync_logs') as any).insert({
    source: 'api_football',
    entity_type: 'libertadores_calibrate',
    status: 'success',
    records_processed: result?.predictionsUpserted ?? 0,
    records_failed: 0,
    metadata: { model_version: LIBERTADORES_MODEL_VERSION, result },
  })

  return { ok: result !== null, result }
}
