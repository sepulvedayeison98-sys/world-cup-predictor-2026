import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MatchHeader } from '@/components/matches/MatchHeader'
import { MatchAnalysisTabs } from '@/components/matches/MatchAnalysisTabs'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: match } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)')
    .eq('id', id)
    .single()

  if (!match) return { title: 'Partido | WC Predictor' }
  return {
    title: `${(match as any).home_team?.name} vs ${(match as any).away_team?.name} | WC Predictor`,
  }
}

export default async function MatchDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // Fetch match data, odds y smart bets en paralelo
  const [{ data: match }, { data: oddsRaw }, { data: smartBetsRaw }] = await Promise.all([
    supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*, team_statistics(*)),
        away_team:teams!matches_away_team_id_fkey(*, team_statistics(*)),
        predictions(*, exact_score_predictions(*)),
        match_statistics(*)
      `)
      .eq('id', id)
      .single(),

    supabase
      .from('odds')
      .select('bookmaker, market, odds_value, implied_probability, recorded_at')
      .eq('match_id', id)
      .order('recorded_at', { ascending: false }),

    supabase
      .from('value_bets')
      .select('*')
      .eq('match_id', id)
      .in('grade', ['high', 'medium'])
      .eq('is_active', true)
      .order('expected_value', { ascending: false })
      .limit(15),
  ])

  if (!match) notFound()

  const m = match as any

  // Injuries require team IDs from the match row
  const { data: injuriesData } = await supabase
    .from('injuries')
    .select('*, player:players(name, short_name, position, photo_url)')
    .in('team_id', [m.home_team_id, m.away_team_id])
    .eq('is_active', true)

  // PostgREST returns predictions as object (UNIQUE match_id); handle array too
  const prediction = Array.isArray(m.predictions)
    ? (m.predictions[0] ?? null)
    : (m.predictions ?? null)

  const homeStats  = m.home_team?.team_statistics?.[0] ?? null
  const awayStats  = m.away_team?.team_statistics?.[0] ?? null
  const matchStats = (m.match_statistics ?? []) as any[]

  // Keep only the most recent odds per bookmaker + market combination
  const oddsMap = new Map<string, any>()
  for (const o of (oddsRaw ?? []) as any[]) {
    const key = `${o.bookmaker}||${o.market}`
    if (!oddsMap.has(key)) oddsMap.set(key, o)
  }
  const odds = Array.from(oddsMap.values())

  // Smart Bets: un mercado único por tarjeta (mejor EV por mercado), máximo 3
  const smartBetsMarkets = new Set<string>()
  const smartBets = (smartBetsRaw ?? []).filter((b: any) => {
    if (smartBetsMarkets.has(b.market)) return false
    smartBetsMarkets.add(b.market)
    return true
  }).slice(0, 3)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <MatchHeader match={m} />

      <MatchAnalysisTabs
        match={m}
        prediction={prediction}
        matchStats={matchStats}
        homeStats={homeStats}
        awayStats={awayStats}
        injuries={injuriesData ?? []}
        odds={odds}
        smartBets={smartBetsRaw ?? []}
      />
    </div>
  )
}
