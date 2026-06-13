import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * POST /api/predictions
 * Body: { match_id: string, weights?: Partial<Weights> }
 *
 * Generates or updates a prediction for a match.
 * Uses the team_statistics from both teams to compute probabilities.
 */

interface Weights {
  form: number
  squadQuality: number
  playerStatus: number
  advancedStats: number
  tactical: number
  elo: number
  odds: number
  motivation: number
  external: number
  h2h: number
}

const DEFAULT_WEIGHTS: Weights = {
  form: 0.20, squadQuality: 0.15, playerStatus: 0.15,
  advancedStats: 0.15, tactical: 0.10, elo: 0.10,
  odds: 0.05, motivation: 0.05, external: 0.03, h2h: 0.02,
}

function normalizeELO(homeELO: number, awayELO: number): number {
  // Returns 0–1 advantage for home team based on ELO delta
  const delta = homeELO - awayELO
  return 1 / (1 + Math.pow(10, -delta / 400))
}

function formToScore(form: string[]): number {
  if (!form?.length) return 0.5
  const recent = form.slice(-5)
  const score = recent.reduce((s, r) => s + (r === 'W' ? 1 : r === 'D' ? 0.5 : 0), 0)
  return score / recent.length
}

function xGToAdvantage(homeXG: number, awayXG: number): number {
  const total = homeXG + awayXG || 1
  return homeXG / total
}

function computeConfidenceLevel(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 85) return 5
  if (score >= 75) return 4
  if (score >= 65) return 3
  if (score >= 55) return 2
  return 1
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Auth check — only analysts/admins
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'analyst'].includes((profile as any).role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { match_id, weights: customWeights, publish = false } = body

    if (!match_id) {
      return NextResponse.json({ error: 'match_id is required' }, { status: 400 })
    }

    const weights = { ...DEFAULT_WEIGHTS, ...customWeights }

    // Fetch match with team stats
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

    // Fetch active injuries
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

    // Fetch latest odds for signal
    const { data: odds } = await supabase
      .from('odds')
      .select('market, implied_probability')
      .eq('match_id', match_id)
      .eq('market', 'home_win')
      .order('recorded_at', { ascending: false })
      .limit(3)

    const avgOddsSignal = odds?.length
      ? odds.reduce((s, o) => s + o.implied_probability, 0) / odds.length
      : 0.5

    // ── Compute weighted score ───────────────────────

    const inputs = {
      form: formToScore(homeStats.form ?? []) - formToScore(awayStats.form ?? []) + 0.5,
      squadQuality: normalizeELO(m.home_team?.elo_rating ?? 1500, m.away_team?.elo_rating ?? 1500),
      playerStatus: Math.max(0.1, 1 - (homeInjuryImpact / 50)) - Math.max(0, 1 - (awayInjuryImpact / 50)) + 0.5,
      advancedStats: xGToAdvantage(homeStats.avg_xg ?? 1.2, awayStats.avg_xg ?? 1.0),
      tactical: 0.5,         // placeholder — requires manual analyst input
      elo: normalizeELO(m.home_team?.elo_rating ?? 1500, m.away_team?.elo_rating ?? 1500),
      odds: avgOddsSignal,
      motivation: 0.5,       // placeholder — neutral
      external: 0.5,         // placeholder — neutral
      h2h: 0.5,              // placeholder — neutral
    }

    const homeStrength =
      inputs.form           * weights.form +
      inputs.squadQuality   * weights.squadQuality +
      inputs.playerStatus   * weights.playerStatus +
      inputs.advancedStats  * weights.advancedStats +
      inputs.tactical       * weights.tactical +
      inputs.elo            * weights.elo +
      inputs.odds           * weights.odds +
      inputs.motivation     * weights.motivation +
      inputs.external       * weights.external +
      inputs.h2h            * weights.h2h

    // Convert to probabilities using a logistic-style transform
    const drawBase = 0.22 * (1 - Math.abs(homeStrength - 0.5) * 1.8)
    const homeWinRaw = homeStrength * (1 - drawBase)
    const awayWinRaw = (1 - homeStrength) * (1 - drawBase)
    const total = homeWinRaw + drawBase + awayWinRaw

    const homeWin = Math.round((homeWinRaw / total) * 10000) / 10000
    const draw    = Math.round((drawBase / total) * 10000) / 10000
    const awayWin = Math.round((1 - homeWin - draw) * 10000) / 10000

    // Predicted score (Poisson-approximated from xG)
    const homeGoals = Math.round(Math.max(0, homeStats.avg_goals_scored ?? 1.5) * (homeWin + draw * 0.5))
    const awayGoals = Math.round(Math.max(0, awayStats.avg_goals_scored ?? 1.0) * (awayWin + draw * 0.5))

    const confidenceScore = Math.min(95, Math.max(40,
      65 +
      Math.abs(homeStrength - 0.5) * 60 -         // more decisive = more confident
      (homeInjuryImpact + awayInjuryImpact) * 0.5 // injuries reduce confidence
    ))

    // ── Upsert prediction ────────────────────────────

    const predictionData = {
      match_id,
      home_win_probability: homeWin,
      draw_probability: draw,
      away_win_probability: awayWin,
      predicted_home_score: homeGoals,
      predicted_away_score: awayGoals,
      confidence_level: computeConfidenceLevel(confidenceScore),
      confidence_score: confidenceScore,
      model_version: '1.0.0',
      form_weight: weights.form,
      squad_quality_weight: weights.squadQuality,
      player_status_weight: weights.playerStatus,
      advanced_stats_weight: weights.advancedStats,
      tactical_weight: weights.tactical,
      elo_weight: weights.elo,
      odds_weight: weights.odds,
      motivation_weight: weights.motivation,
      external_factors_weight: weights.external,
      h2h_weight: weights.h2h,
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
    } else {
      const { data, error } = await supabase
        .from('predictions')
        .insert(predictionData)
        .select()
        .single()
      if (error) throw error
      prediction = data

      // Generate exact score predictions (top 10)
      const exactScores = generateExactScores(homeWin, draw, awayWin, homeGoals, awayGoals)
      await supabase.from('exact_score_predictions').insert(
        exactScores.map((s, i) => ({
          prediction_id: (prediction as any).id,
          home_score: s.home,
          away_score: s.away,
          probability: s.prob,
          rank: i + 1,
        }))
      )
    }

    return NextResponse.json({
      success: true,
      prediction,
      inputs: { homeStrength, homeWin, draw, awayWin, confidenceScore },
    })

  } catch (err: any) {
    console.error('[POST /api/predictions]', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

function generateExactScores(
  homeWin: number, draw: number, awayWin: number,
  predHome: number, predAway: number
): { home: number; away: number; prob: number }[] {
  const candidates: { home: number; away: number; prob: number }[] = []

  // Win scorelines
  for (let h = Math.max(1, predHome - 1); h <= predHome + 2; h++) {
    for (let a = 0; a < h; a++) {
      const dist = Math.abs(h - predHome) + Math.abs(a - predAway)
      candidates.push({ home: h, away: a, prob: (homeWin * Math.pow(0.55, dist)) })
    }
  }

  // Draw scorelines
  for (let g = 0; g <= 3; g++) {
    candidates.push({ home: g, away: g, prob: draw * (g === 1 ? 0.45 : g === 0 ? 0.35 : g === 2 ? 0.15 : 0.05) })
  }

  // Away win scorelines
  for (let a = Math.max(1, predAway - 1); a <= predAway + 2; a++) {
    for (let h = 0; h < a; h++) {
      const dist = Math.abs(h - predHome) + Math.abs(a - predAway)
      candidates.push({ home: h, away: a, prob: awayWin * Math.pow(0.55, dist) })
    }
  }

  // Normalize and take top 10
  const total = candidates.reduce((s, c) => s + c.prob, 0)
  return candidates
    .map(c => ({ ...c, prob: Math.round((c.prob / total) * 10000) / 10000 }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 10)
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const matchId = req.nextUrl.searchParams.get('match_id')
  let query = supabase.from('predictions').select('*, exact_score_predictions(*)')
  if (matchId) query = query.eq('match_id', matchId)
  else query = query.eq('is_published', true).order('created_at', { ascending: false }).limit(50)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
