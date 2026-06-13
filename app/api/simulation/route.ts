import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * POST /api/simulation
 * Saves a simulation result to the database.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      match_id, input, result, scenario_name,
    } = body

    if (!match_id || !input || !result) {
      return NextResponse.json({ error: 'match_id, input, and result are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('simulation_results')
      .insert({
        match_id,
        user_id: user.id,
        input,
        home_win_probability: result.home_win_probability,
        draw_probability: result.draw_probability,
        away_win_probability: result.away_win_probability,
        predicted_home_score: result.predicted_home_score,
        predicted_away_score: result.predicted_away_score,
        confidence_score: result.confidence_score,
        top_scorelines: result.top_scorelines ?? [],
        delta_vs_base: result.delta ?? {},
        scenario_name: scenario_name ?? 'Sin nombre',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * GET /api/simulation?match_id=xxx
 * Returns saved simulations for a match (own user only — RLS enforced).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const matchId = req.nextUrl.searchParams.get('match_id')
    let query = supabase
      .from('simulation_results')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (matchId) query = query.eq('match_id', matchId)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ data })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
