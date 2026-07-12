import { createAdminClient } from '@/lib/supabase/admin'
import { computeModelPrediction, computeConfidenceLevel, type Probabilities } from '@/lib/predictionEngine'
import { COMPETITION_ID, MODEL_VERSION } from '@/lib/constants'
import { revalidatePredictionPaths } from '@/lib/revalidate'

const KNOCKOUT_PHASES = new Set(['round_of_32','round_of_16','quarter_final','semi_final','third_place','final'])


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
  ok: boolean; matches: number; withMarket: number; modelOnly: number; inserted: number
}> {
  const started = Date.now()
  const supabase = createAdminClient()

  // Consenso de mercado por partido -> { home, draw, away } (implicitas promedio)
  const { data: consensus, error: cErr } = await supabase
    .from('match_market_consensus').select('match_id, market, avg_implied')
  if (cErr) throw cErr
  const market = new Map<string, { home?: number; draw?: number; away?: number }>()
  for (const r of (consensus ?? [])) {
    if (!r.match_id) continue // la vista expone columnas nullable
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
  for (const i of (injuries ?? []))
    injuryByTeam.set(i.team_id, (injuryByTeam.get(i.team_id) ?? 0) + Number(i.impact_score))

  // Partidos con datos de equipo y prediccion
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select(`
      id, home_team_id, away_team_id, phase, status,
      home_team:teams!matches_home_team_id_fkey(elo_rating, team_statistics(form, avg_xg, avg_xga, avg_shots_on_target, avg_goals_scored)),
      away_team:teams!matches_away_team_id_fkey(elo_rating, team_statistics(form, avg_xg, avg_xga, avg_shots_on_target, avg_goals_scored)),
      predictions(id)
    `)
    .eq('competition_id', COMPETITION_ID)
  if (mErr) throw mErr

  let withMarket = 0, modelOnly = 0, inserted = 0

  for (const m of (matches ?? [])) {
    const pred = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
    // Partidos SIN predicción guardada: se inserta solo si aún no se juegan
    // (crear predicciones para partidos ya terminados sería "predecir el
    // pasado" y contaminaría la métrica de precisión). Con la fila guardada,
    // el sync de cuotas puede generar value bets contra Pinnacle.
    const isUpcoming = m.status === 'scheduled' || m.status === 'live'
    if (!pred?.id && !isUpcoming) continue

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

    // ModelInput extraído a una variable para (1) predecir y (2) snapshotear
    // los features (F0, docs/WEIGHT_TUNING_DESIGN.md). Es EXACTAMENTE el mismo
    // objeto que antes iba inline — la predicción no cambia en nada.
    const modelInput = {
      homeElo: m.home_team?.elo_rating ?? 1500, awayElo: m.away_team?.elo_rating ?? 1500,
      homeForm: hStats?.form ?? [], awayForm: aStats?.form ?? [],
      homeXg: hStats?.avg_xg ?? 1.1, awayXg: aStats?.avg_xg ?? 1.1,
      homeXga: hStats?.avg_xga ?? 1.1, awayXga: aStats?.avg_xga ?? 1.1,
      homeShotsOnTarget: hStats?.avg_shots_on_target, awayShotsOnTarget: aStats?.avg_shots_on_target,
      homeGoalsScored: hStats?.avg_goals_scored, awayGoalsScored: aStats?.avg_goals_scored,
      homeInjuryImpact, awayInjuryImpact,
      marketProbabilities,
      isKnockout: KNOCKOUT_PHASES.has(m.phase),
    }

    const final = computeModelPrediction(modelInput)

    const predictionData = {
      home_win_probability: final.home,
      draw_probability: final.draw,
      away_win_probability: final.away,
      predicted_home_score: final.predictedHome,
      predicted_away_score: final.predictedAway,
      confidence_level: computeConfidenceLevel(final.confidenceScore),
      confidence_score: final.confidenceScore,
      model_version: MODEL_VERSION,
      xg_weight: 0.40, elo_weight: 0.25, form_weight: 0.15, market_weight: 0.10, news_weight: 0.10,
    }

    let predId = pred?.id as string | undefined
    if (predId) {
      const { error: uErr } = await supabase.from('predictions').update(predictionData).eq('id', predId)
      if (uErr) throw uErr
    } else {
      const { data: created, error: iErr } = await supabase
        .from('predictions')
        .insert({ match_id: m.id, ...predictionData, is_published: true })
        .select('id')
        .single()
      if (iErr) throw iErr
      predId = created.id
      inserted++
    }

    // F0 · Feature store: snapshot del ModelInput SOLO mientras el partido está
    // por jugarse. Al finalizar dejamos de tocarlo, congelando los features en
    // el último estado pre-partido → par de entrenamiento fiel (features
    // pre-partido, resultado real). Best-effort: nunca bloquea la predicción.
    if (isUpcoming) {
      try {
        // Cast del cliente a any: prediction_features es nueva y aún no está en
        // los tipos generados de Supabase (el nombre de tabla no está en la
        // unión de `.from`). Se regenerarán los tipos en una pasada aparte.
        await (supabase as any).from('prediction_features').upsert({
          match_id: m.id,
          competition_id: COMPETITION_ID,
          inputs: modelInput,
          model_version: MODEL_VERSION,
          captured_at: new Date().toISOString(),
        }, { onConflict: 'match_id' })
      } catch (e) {
        console.error('[recalibrate] prediction_features (no bloqueante):', e)
      }
    }

    // Regenerar marcadores exactos
    await supabase.from('exact_score_predictions').delete().eq('prediction_id', predId)
    if (final.exactScores.length) {
      await supabase.from('exact_score_predictions').insert(
        final.exactScores.map((s, idx) => ({
          prediction_id: predId, home_score: s.home, away_score: s.away, probability: s.prob, rank: idx + 1,
        }))
      )
    }
  }

  await supabase.from('sync_logs').insert({
    source: 'recalibrate', entity_type: 'predictions', status: 'success',
    records_processed: withMarket + modelOnly, records_failed: 0,
    metadata: { withMarket, modelOnly, inserted, model_version: MODEL_VERSION }, duration_ms: Date.now() - started,
  })

  // Revalidación por evento (capa 3): las páginas con probabilidades reflejan
  // la recalibración de inmediato.
  revalidatePredictionPaths()

  return { ok: true, matches: withMarket + modelOnly, withMarket, modelOnly, inserted }
}
