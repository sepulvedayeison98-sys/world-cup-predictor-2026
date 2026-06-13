import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * POST /api/odds
 * Ingests odds for a match and auto-generates value bets.
 *
 * Body: {
 *   match_id: string
 *   bookmaker: string
 *   odds: Array<{ market: string; odds_value: number }>
 * }
 */

type OddsMarket =
  | 'home_win' | 'draw' | 'away_win'
  | 'over_0_5' | 'over_1_5' | 'over_2_5' | 'over_3_5'
  | 'btts_yes' | 'btts_no'
  | 'clean_sheet_home' | 'clean_sheet_away'

function gradeEV(ev: number): 'high' | 'medium' | 'low' | 'none' {
  if (ev >= 0.10) return 'high'
  if (ev >= 0.04) return 'medium'
  if (ev >= 0.01) return 'low'
  return 'none'
}

function kellyFraction(modelProb: number, odds: number): number {
  const b = odds - 1
  const q = 1 - modelProb
  const k = (modelProb * b - q) / b
  return Math.max(0, Math.min(k * 0.25, 0.05)) // quarter Kelly, max 5%
}

// Simple model probability for secondary markets (based on prediction data)
function getModelProbForMarket(market: OddsMarket, prediction: any): number {
  const homeWin = (prediction as any).home_win_probability
  const draw    = (prediction as any).draw_probability
  const awayWin = (prediction as any).away_win_probability
  const predH   = (prediction as any).predicted_home_score ?? 1
  const predA   = (prediction as any).predicted_away_score ?? 1
  const totalGoals = predH + predA

  switch (market) {
    case 'home_win': return homeWin
    case 'draw':     return draw
    case 'away_win': return awayWin
    case 'over_0_5': return Math.min(0.98, 0.75 + totalGoals * 0.07)
    case 'over_1_5': return Math.min(0.95, 0.50 + totalGoals * 0.12)
    case 'over_2_5': return Math.min(0.90, 0.25 + totalGoals * 0.15)
    case 'over_3_5': return Math.min(0.70, 0.05 + totalGoals * 0.12)
    case 'btts_yes': return Math.min(0.80, 0.20 + (Math.min(predH, 1) + Math.min(predA, 1)) * 0.20)
    case 'btts_no':  return 1 - (Math.min(0.80, 0.20 + (Math.min(predH, 1) + Math.min(predA, 1)) * 0.20))
    case 'clean_sheet_home': return Math.max(0.10, 0.60 - predA * 0.20)
    case 'clean_sheet_away': return Math.max(0.10, 0.45 - predH * 0.18)
    default: return 0.33
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'analyst'].includes((profile as any).role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { match_id, bookmaker, odds } = body

    if (!match_id || !bookmaker || !odds?.length) {
      return NextResponse.json({ error: 'match_id, bookmaker and odds[] required' }, { status: 400 })
    }

    // Fetch existing prediction for this match
    const { data: prediction } = await supabase
      .from('predictions')
      .select('*')
      .eq('match_id', match_id)
      .single()

    if (!prediction) {
      return NextResponse.json({
        error: 'No prediction found for this match. Generate prediction first.',
      }, { status: 422 })
    }

    const now = new Date().toISOString()
    const oddsInserts: any[] = []
    const valueBetUpserts: any[] = []

    for (const odd of odds) {
      const { market, odds_value } = odd
      if (!odds_value || odds_value <= 1) continue

      const impliedProb = 1 / odds_value
      const modelProb = getModelProbForMarket(market as OddsMarket, prediction)
      const ev = modelProb * odds_value - 1
      const edge = modelProb - impliedProb
      const grade = gradeEV(ev)
      const kelly = kellyFraction(modelProb, odds_value)

      oddsInserts.push({
        match_id,
        bookmaker,
        market,
        odds_value,
        implied_probability: impliedProb,
        recorded_at: now,
      })

      if (ev > 0) {
        valueBetUpserts.push({
          match_id,
          prediction_id: (prediction as any).id,
          market,
          bookmaker,
          odds_value,
          implied_probability: impliedProb,
          model_probability: modelProb,
          expected_value: ev,
          edge,
          grade,
          stake_suggestion_percent: kelly * 100,
          is_active: true,
          result: 'pending',
        })
      }
    }

    // Insert odds
    const { error: oddsErr } = await supabase.from('odds').insert(oddsInserts)
    if (oddsErr) throw oddsErr

    // Upsert value bets (update existing for same match+market+bookmaker)
    let valueBetsInserted = 0
    if (valueBetUpserts.length > 0) {
      const { error: vbErr } = await supabase
        .from('value_bets')
        .upsert(valueBetUpserts, {
          onConflict: 'match_id,market,bookmaker',
          ignoreDuplicates: false,
        })
      if (vbErr) throw vbErr
      valueBetsInserted = valueBetUpserts.length
    }

    return NextResponse.json({
      success: true,
      odds_recorded: oddsInserts.length,
      value_bets_generated: valueBetsInserted,
      value_bets: valueBetUpserts.map(vb => ({
        market: vb.market,
        ev: vb.expected_value.toFixed(3),
        grade: vb.grade,
        odds: vb.odds_value,
        model: vb.model_probability.toFixed(3),
      })),
    })

  } catch (err: any) {
    console.error('[POST /api/odds]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const matchId = req.nextUrl.searchParams.get('match_id')
  if (!matchId) return NextResponse.json({ error: 'match_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('odds')
    .select('*')
    .eq('match_id', matchId)
    .order('recorded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
