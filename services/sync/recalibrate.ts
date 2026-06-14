import { createAdminClient } from '@/lib/supabase/admin'
import {
  computeModelPrediction, blend, finalizeResult, computeConfidenceLevel,
  generateExactScores, type Probabilities,
} from '@/lib/predictionEngine'

const COMPETITION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

/**
 * Recalibra las predicciones mezclando la base del modelo (ELO/forma/xG) con
 * el consenso de mercado (vista match_market_consensus, de cuotas reales).
 *
 * Sin deriva: la base del modelo se recomputa desde los datos del equipo cada
 * corrida; solo se mezcla con el mercado actual. alpha = peso del mercado.
 *
 * Env: RECALIBRATE_ALPHA (opcional, def 0.6)
 */
export async function recalibratePredictions(): Promise<{
  ok: boolean; matches: number; calibrated: number; modelOnly: number
}> {
  const started = Date.now()
  const supabase = createAdminClient()
  const alpha = Math.min(1, Math.max(0, Number(process.env.RECALIBRATE_ALPHA ?? '0.6')))

  // Consenso de mercado por partido -> { home, draw, away } (implicitas promedio)
  const { data: consensus, error: cErr } = await supabase
    .from('match_market_consensus').select('match_id, market, avg_implied')
  if (cErr) throw cErr
  const market = new Map<string, { home?: number; draw?: number; away?: number }>()
  for (const r of (consensus ?? []) as any[]) {
    const e = market.get(r.match_id) ?? {}
    if (r.market === 'home_win') e.home = Number(r.avg_implied)
    else if (r.market === 'draw') e.draw = Number(r.avg_implied)
    else if (r.market === 'away_win') e.away = Number(r.avg_implied)
    market.set(r.match_id, e)
  }

  // Lesiones activas -> impacto por equipo
  const { data: injuries } = await supabase
    .from('injuries').select('team_id, impact_score').eq('is_active', true)
  const injuryByTeam = new Map<string, number>()
  for (const i of (injuries ?? []) as any[])
    injuryByTeam.set(i.team_id, (injuryByTeam.get(i.team_id) ?? 0) + Number(i.impact_score))

  // Partidos con datos de equipo y prediccion
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_team:teams!matches_home_team_id_fkey(elo_rating, team_statistics(form, avg_xg, avg_goals_scored)), away_team:teams!matches_away_team_id_fkey(elo_rating, team_statistics(form, avg_xg, avg_goals_scored)), predictions(id)')
    .eq('competition_id', COMPETITION_ID)
  if (mErr) throw mErr

  let calibrated = 0, modelOnly = 0

  for (const m of (matches ?? []) as any[]) {
    const pred = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
    if (!pred?.id) continue

    const hStats = m.home_team?.team_statistics?.[0]
    const aStats = m.away_team?.team_statistics?.[0]
    const homeGoals = hStats?.avg_goals_scored ?? 1.5
    const awayGoals = aStats?.avg_goals_scored ?? 1.0
    const totalInjury = (injuryByTeam.get(m.home_team_id) ?? 0) + (injuryByTeam.get(m.away_team_id) ?? 0)

    const model = computeModelPrediction({
      homeElo: m.home_team?.elo_rating ?? 1500, awayElo: m.away_team?.elo_rating ?? 1500,
      homeForm: hStats?.form ?? [], awayForm: aStats?.form ?? [],
      homeXg: hStats?.avg_xg ?? 1.2, awayXg: aStats?.avg_xg ?? 1.0,
      homeGoals, awayGoals,
      homeInjuryImpact: injuryByTeam.get(m.home_team_id) ?? 0,
      awayInjuryImpact: injuryByTeam.get(m.away_team_id) ?? 0,
    })

    // Consenso de mercado de-vigueado (normalizar las tres implicitas)
    const mk = market.get(m.id)
    let final = model
    if (mk && mk.home != null && mk.draw != null && mk.away != null) {
      const sum = mk.home + mk.draw + mk.away
      if (sum > 0) {
        const marketProbs: Probabilities = { home: mk.home / sum, draw: mk.draw / sum, away: mk.away / sum }
        final = finalizeResult(blend(model, marketProbs, alpha), homeGoals, awayGoals, totalInjury)
        calibrated++
      } else { modelOnly++ }
    } else { modelOnly++ }

    const { error: uErr } = await supabase.from('predictions').update({
      home_win_probability: final.home,
      draw_probability: final.draw,
      away_win_probability: final.away,
      predicted_home_score: final.predictedHome,
      predicted_away_score: final.predictedAway,
      confidence_level: computeConfidenceLevel(final.confidenceScore),
      confidence_score: final.confidenceScore,
      model_version: '1.1.0',
    }).eq('id', pred.id)
    if (uErr) throw uErr

    // Regenerar marcadores exactos
    await supabase.from('exact_score_predictions').delete().eq('prediction_id', pred.id)
    const scores = generateExactScores(final.home, final.draw, final.away, final.predictedHome, final.predictedAway)
    if (scores.length) {
      await supabase.from('exact_score_predictions').insert(
        scores.map((s, idx) => ({
          prediction_id: pred.id, home_score: s.home, away_score: s.away, probability: s.prob, rank: idx + 1,
        }))
      )
    }
  }

  await supabase.from('sync_logs').insert({
    source: 'recalibrate', entity_type: 'predictions', status: 'success',
    records_processed: calibrated + modelOnly, records_failed: 0,
    metadata: { alpha, calibrated, modelOnly }, duration_ms: Date.now() - started,
  })

  return { ok: true, matches: calibrated + modelOnly, calibrated, modelOnly }
}
