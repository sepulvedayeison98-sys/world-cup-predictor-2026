import { createAdminClient } from '@/lib/supabase/admin'
import { computeModelPrediction, computeConfidenceLevel, type Probabilities } from '@/lib/predictionEngine'

const COMPETITION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

/**
 * Recalcula la prediccion de TODOS los partidos de la competicion con el
 * modelo hibrido de 5 factores (xG 40%, ELO 25%, forma 15%, mercado 10%,
 * noticias/lesiones 10% — ver lib/predictionEngine.ts). El mercado entra
 * como uno de los 5 factores ponderados (consenso de cuotas de
 * match_market_consensus, de-vigueado), no como una mezcla posterior.
 *
 * Sin deriva: todo se recomputa desde los datos actuales de cada equipo en
 * cada corrida.
 */
export async function recalibratePredictions(): Promise<{
  ok: boolean; matches: number; withMarket: number; modelOnly: number
}> {
  const started = Date.now()
  const supabase = createAdminClient()

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
    .select(`
      id, home_team_id, away_team_id,
      home_team:teams!matches_home_team_id_fkey(elo_rating, team_statistics(form, avg_xg, avg_xga, avg_shots_on_target, avg_goals_scored)),
      away_team:teams!matches_away_team_id_fkey(elo_rating, team_statistics(form, avg_xg, avg_xga, avg_shots_on_target, avg_goals_scored)),
      predictions(id)
    `)
    .eq('competition_id', COMPETITION_ID)
  if (mErr) throw mErr

  let withMarket = 0, modelOnly = 0

  for (const m of (matches ?? []) as any[]) {
    const pred = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
    if (!pred?.id) continue

    const hStats = m.home_team?.team_statistics?.[0]
    const aStats = m.away_team?.team_statistics?.[0]

    // Consenso de mercado de-vigueado (normalizar las tres implicitas)
    const mk = market.get(m.id)
    let marketProbabilities: Probabilities | undefined
    if (mk && mk.home != null && mk.draw != null && mk.away != null) {
      const sum = mk.home + mk.draw + mk.away
      if (sum > 0) {
        marketProbabilities = { home: mk.home / sum, draw: mk.draw / sum, away: mk.away / sum }
        withMarket++
      } else { modelOnly++ }
    } else { modelOnly++ }

    const homeInjuryImpact = injuryByTeam.get(m.home_team_id) ?? 0
    const awayInjuryImpact = injuryByTeam.get(m.away_team_id) ?? 0

    const final = computeModelPrediction({
      homeElo: m.home_team?.elo_rating ?? 1500, awayElo: m.away_team?.elo_rating ?? 1500,
      homeForm: hStats?.form ?? [], awayForm: aStats?.form ?? [],
      homeXg: hStats?.avg_xg ?? 1.2, awayXg: aStats?.avg_xg ?? 1.0,
      homeXga: hStats?.avg_xga ?? 1.0, awayXga: aStats?.avg_xga ?? 1.2,
      homeShotsOnTarget: hStats?.avg_shots_on_target, awayShotsOnTarget: aStats?.avg_shots_on_target,
      homeGoalsScored: hStats?.avg_goals_scored, awayGoalsScored: aStats?.avg_goals_scored,
      homeInjuryImpact, awayInjuryImpact,
      marketProbabilities,
    })

    const { error: uErr } = await supabase.from('predictions').update({
      home_win_probability: final.home,
      draw_probability: final.draw,
      away_win_probability: final.away,
      predicted_home_score: final.predictedHome,
      predicted_away_score: final.predictedAway,
      confidence_level: computeConfidenceLevel(final.confidenceScore),
      confidence_score: final.confidenceScore,
      model_version: '2.0.0',
      xg_weight: 0.40, elo_weight: 0.25, form_weight: 0.15, market_weight: 0.10, news_weight: 0.10,
    }).eq('id', pred.id)
    if (uErr) throw uErr

    // Regenerar marcadores exactos
    await supabase.from('exact_score_predictions').delete().eq('prediction_id', pred.id)
    if (final.exactScores.length) {
      await supabase.from('exact_score_predictions').insert(
        final.exactScores.map((s, idx) => ({
          prediction_id: pred.id, home_score: s.home, away_score: s.away, probability: s.prob, rank: idx + 1,
        }))
      )
    }
  }

  await supabase.from('sync_logs').insert({
    source: 'recalibrate', entity_type: 'predictions', status: 'success',
    records_processed: withMarket + modelOnly, records_failed: 0,
    metadata: { withMarket, modelOnly, model_version: '2.0.0' }, duration_ms: Date.now() - started,
  })

  return { ok: true, matches: withMarket + modelOnly, withMarket, modelOnly }
}
