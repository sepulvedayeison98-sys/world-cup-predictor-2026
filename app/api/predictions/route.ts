import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { computeModelPrediction, computeConfidenceLevel, devigMarket } from '@/lib/predictionEngine'
import { MODEL_VERSION } from '@/lib/constants'

/**
 * POST /api/predictions
 * Body: { match_id: string }
 *
 * Genera o actualiza la prediccion de un partido con el motor compartido
 * (lib/predictionEngine.ts — modelo hibrido de 5 factores). Misma logica
 * que usa la recalibracion por lote (services/sync/recalibrate.ts).
 */

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Auth check — solo analistas/admins
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'analyst'].includes((profile as any).role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { match_id, publish = false } = body

    if (!match_id) {
      return NextResponse.json({ error: 'match_id is required' }, { status: 400 })
    }

    // Fetch match con estadisticas de ambos equipos
    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*, team_statistics(*)),
        away_team:teams!matches_away_team_id_fkey(*, team_statistics(*))
      `)
      .eq('id', match_id)
      .single()

    if (matchErr || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const m = match as any
    const homeStats = m.home_team?.team_statistics?.[0] ?? {}
    const awayStats = m.away_team?.team_statistics?.[0] ?? {}

    // Lesiones activas
    const { data: injuries } = await supabase
      .from('injuries')
      .select('team_id, impact_score')
      .in('team_id', [m.home_team_id, m.away_team_id])
      .eq('is_active', true)

    const homeInjuryImpact = (injuries ?? [])
      .filter(i => i.team_id === m.home_team_id)
      .reduce((s, i) => s + i.impact_score, 0)
    const awayInjuryImpact = (injuries ?? [])
      .filter(i => i.team_id === m.away_team_id)
      .reduce((s, i) => s + i.impact_score, 0)

    // Cuotas 1X2 mas recientes -> consenso de mercado de-vigueado
    const { data: odds } = await supabase
      .from('odds')
      .select('market, odds_value')
      .eq('match_id', match_id)
      .in('market', ['home_win', 'draw', 'away_win'])
      .order('recorded_at', { ascending: false })
      .limit(30)

    const latestByMarket: Record<string, number> = {}
    for (const o of (odds ?? []) as any[]) {
      if (!(o.market in latestByMarket)) latestByMarket[o.market] = o.odds_value
    }
    const marketProbabilities =
      latestByMarket.home_win && latestByMarket.draw && latestByMarket.away_win
        ? devigMarket(latestByMarket.home_win, latestByMarket.draw, latestByMarket.away_win) ?? undefined
        : undefined

    const KNOCKOUT_PHASES = new Set(['round_of_32','round_of_16','quarter_final','semi_final','third_place','final'])

    const final = computeModelPrediction({
      homeElo: m.home_team?.elo_rating ?? 1500,
      awayElo: m.away_team?.elo_rating ?? 1500,
      homeForm: homeStats.form ?? [],
      awayForm: awayStats.form ?? [],
      homeXg: homeStats.avg_xg ?? 1.1,
      awayXg: awayStats.avg_xg ?? 1.1,
      homeXga: homeStats.avg_xga ?? 1.1,
      awayXga: awayStats.avg_xga ?? 1.1,
      isKnockout: KNOCKOUT_PHASES.has(m.phase),
      homeShotsOnTarget: homeStats.avg_shots_on_target,
      awayShotsOnTarget: awayStats.avg_shots_on_target,
      homeGoalsScored: homeStats.avg_goals_scored,
      awayGoalsScored: awayStats.avg_goals_scored,
      homeInjuryImpact,
      awayInjuryImpact,
      marketProbabilities,
    })

    const predictionData = {
      match_id,
      home_win_probability: final.home,
      draw_probability: final.draw,
      away_win_probability: final.away,
      predicted_home_score: final.predictedHome,
      predicted_away_score: final.predictedAway,
      confidence_level: computeConfidenceLevel(final.confidenceScore),
      confidence_score: final.confidenceScore,
      model_version: MODEL_VERSION,
      xg_weight: 0.40,
      elo_weight: 0.25,
      form_weight: 0.15,
      market_weight: 0.10,
      news_weight: 0.10,
      is_published: publish,
    }

    const { data: existing } = await supabase
      .from('predictions').select('id').eq('match_id', match_id).single()

    let prediction: any
    if (existing) {
      const { data, error } = await supabase
        .from('predictions')
        .update(predictionData)
        .eq('match_id', match_id)
        .select()
        .single()
      if (error) throw error
      prediction = data

      await supabase.from('exact_score_predictions').delete().eq('prediction_id', (prediction as any).id)
      await supabase.from('exact_score_predictions').insert(
        final.exactScores.map((s, i) => ({
          prediction_id: (prediction as any).id,
          home_score: s.home,
          away_score: s.away,
          probability: s.prob,
          rank: i + 1,
        }))
      )
    } else {
      const { data, error } = await supabase
        .from('predictions')
        .insert(predictionData)
        .select()
        .single()
      if (error) throw error
      prediction = data

      await supabase.from('exact_score_predictions').insert(
        final.exactScores.map((s, i) => ({
          prediction_id: (prediction as any).id,
          home_score: s.home,
          away_score: s.away,
          probability: s.prob,
          rank: i + 1,
        }))
      )
    }

    return NextResponse.json({ success: true, prediction })

  } catch (err: any) {
    console.error('[POST /api/predictions]', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const matchId = req.nextUrl.searchParams.get('match_id')
  let query = supabase.from('predictions').select('*, exact_score_predictions(*)')
  if (matchId) query = query.eq('match_id', matchId)
  else query = query.eq('is_published', true).order('created_at', { ascending: false }).limit(50)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
