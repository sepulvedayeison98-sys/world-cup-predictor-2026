import { NextRequest, NextResponse } from 'next/server'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { NBA_COMPETITION_ID } from '@/lib/nba/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/nba/games?date=YYYY-MM-DD — partidos NBA de un día (hora COL).
 * Público y de solo lectura; alimenta el calendario navegable del hub.
 */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? ''
  if (!DATE_RE.test(date)) return NextResponse.json({ error: 'fecha inválida' }, { status: 400 })

  // Día en zona COL (UTC-5) → ventana UTC
  const start = new Date(`${date}T00:00:00-05:00`).toISOString()
  const end = new Date(`${date}T23:59:59-05:00`).toISOString()

  const supabase = createStaticSupabaseClient()
  const { data } = await supabase
    .from('matches')
    .select(`
      id, kickoff_time, status, home_score, away_score,
      home_team:teams!matches_home_team_id_fkey(code, name),
      away_team:teams!matches_away_team_id_fkey(code, name),
      predictions(home_win_probability, away_win_probability, was_correct, predicted_home_score, predicted_away_score)
    `)
    .eq('competition_id', NBA_COMPETITION_ID)
    .gte('kickoff_time', start)
    .lte('kickoff_time', end)
    .order('kickoff_time', { ascending: true })

  const games = ((data ?? []) as any[]).map((m) => {
    const p = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
    return {
      id: m.id,
      kickoff_time: m.kickoff_time,
      status: m.status,
      home_code: m.home_team?.code ?? '?',
      away_code: m.away_team?.code ?? '?',
      home_name: m.home_team?.name ?? '',
      away_name: m.away_team?.name ?? '',
      home_score: m.home_score,
      away_score: m.away_score,
      prob_home: p ? Math.round(Number(p.home_win_probability) * 100) : null,
      prob_away: p ? Math.round(Number(p.away_win_probability) * 100) : null,
      was_correct: p?.was_correct ?? null,
    }
  })

  return NextResponse.json({ date, games }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' },
  })
}
