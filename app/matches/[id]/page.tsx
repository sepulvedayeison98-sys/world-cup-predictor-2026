import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MatchHeader } from '@/components/matches/MatchHeader'
import { MatchAnalysisTabs } from '@/components/matches/MatchAnalysisTabs'
import type { MatchFormEntry } from '@/lib/smartBetsEngine'
import { computeModelPrediction, computeConfidenceLevel } from '@/lib/predictionEngine'

interface Props {
  params: Promise<{ id: string }>
}

async function fetchTeamForm(
  supabase: any,
  teamId: string,
  excludeMatchId: string,
): Promise<MatchFormEntry[]> {
  const { data } = await supabase
    .from('matches')
    .select(`
      id, kickoff_time, home_score, away_score, home_team_id, away_team_id,
      home_team:teams!matches_home_team_id_fkey(name, short_name),
      away_team:teams!matches_away_team_id_fkey(name, short_name),
      match_statistics(team_id, shots, shots_on_target, corners, fouls,
        yellow_cards, red_cards, possession, xg, xga, big_chances)
    `)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq('status', 'finished')
    .neq('id', excludeMatchId)
    .order('kickoff_time', { ascending: false })
    .limit(10)

  if (!data) return []

  return (data as any[]).map((m) => {
    const isHome    = m.home_team_id === teamId
    const teamScore = isHome ? (m.home_score ?? 0) : (m.away_score ?? 0)
    const oppScore  = isHome ? (m.away_score ?? 0) : (m.home_score ?? 0)
    const opp       = isHome ? m.away_team : m.home_team
    const stats     = (m.match_statistics ?? []).find((s: any) => s.team_id === teamId)
    const result: 'W' | 'D' | 'L' = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D'

    return {
      kickoff_time:    m.kickoff_time,
      result,
      goals_scored:    teamScore,
      goals_conceded:  oppScore,
      is_clean_sheet:  oppScore === 0,
      btts:            teamScore > 0 && oppScore > 0,
      over_2_5:        (teamScore + oppScore) > 2,
      over_1_5:        (teamScore + oppScore) > 1,
      opponent_name:   opp?.short_name ?? opp?.name ?? 'Oponente',
      xg:              stats?.xg              ?? null,
      xga:             stats?.xga             ?? null,
      shots:           stats?.shots           ?? null,
      shots_on_target: stats?.shots_on_target ?? null,
      corners:         stats?.corners         ?? null,
      yellow_cards:    stats?.yellow_cards    ?? null,
      red_cards:       stats?.red_cards       ?? null,
      fouls:           stats?.fouls           ?? null,
      possession:      stats?.possession      ?? null,
      big_chances:     stats?.big_chances     ?? null,
    } satisfies MatchFormEntry
  })
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

  // Fetch match data y odds en paralelo
  const [{ data: match }, { data: oddsRaw }] = await Promise.all([
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
  ])

  if (!match) notFound()

  const m = match as any

  // Injuries y forma reciente en paralelo
  const [{ data: injuriesData }, homeRecentMatches, awayRecentMatches] = await Promise.all([
    supabase
      .from('injuries')
      .select('*, player:players(name, short_name, position, photo_url)')
      .in('team_id', [m.home_team_id, m.away_team_id])
      .eq('is_active', true),
    fetchTeamForm(supabase, m.home_team_id, id),
    fetchTeamForm(supabase, m.away_team_id, id),
  ])

  // PostgREST returns predictions as object (UNIQUE match_id); handle array too
  const savedPrediction = Array.isArray(m.predictions)
    ? (m.predictions[0] ?? null)
    : (m.predictions ?? null)

  const homeStats  = m.home_team?.team_statistics?.[0] ?? null
  const awayStats  = m.away_team?.team_statistics?.[0] ?? null

  // Si no hay predicción guardada (partidos nuevos como octavos R32), calculamos al vuelo
  let prediction = savedPrediction
  if (!savedPrediction && m.status !== 'finished') {
    const homeInjury = (injuriesData ?? [])
      .filter((i: any) => i.team_id === m.home_team_id)
      .reduce((s: number, i: any) => s + (i.impact_score ?? 0), 0)
    const awayInjury = (injuriesData ?? [])
      .filter((i: any) => i.team_id === m.away_team_id)
      .reduce((s: number, i: any) => s + (i.impact_score ?? 0), 0)

    const result = computeModelPrediction({
      homeElo: m.home_team?.elo_rating ?? 1500,
      awayElo: m.away_team?.elo_rating ?? 1500,
      homeForm: homeStats?.form ?? [],
      awayForm: awayStats?.form ?? [],
      homeXg:   homeStats?.avg_xg  ?? 1.2,
      awayXg:   awayStats?.avg_xg  ?? 1.0,
      homeXga:  homeStats?.avg_xga ?? 1.0,
      awayXga:  awayStats?.avg_xga ?? 1.2,
      homeShotsOnTarget: homeStats?.avg_shots_on_target,
      awayShotsOnTarget: awayStats?.avg_shots_on_target,
      homeGoalsScored: homeStats?.avg_goals_scored,
      awayGoalsScored: awayStats?.avg_goals_scored,
      homeInjuryImpact: homeInjury,
      awayInjuryImpact: awayInjury,
    })

    prediction = {
      id: 'computed',
      match_id: id,
      home_win_probability:  result.home,
      draw_probability:      result.draw,
      away_win_probability:  result.away,
      predicted_home_score:  result.predictedHome,
      predicted_away_score:  result.predictedAway,
      confidence_level:      computeConfidenceLevel(result.confidenceScore),
      confidence_score:      result.confidenceScore,
      model_version:         '2.0.0',
      is_published:          false,
      exact_score_predictions: result.exactScores.map((s, i) => ({
        id: `computed-${i}`,
        home_score: s.home,
        away_score: s.away,
        probability: s.prob,
        rank: i + 1,
      })),
    }
  }
  const matchStats = (m.match_statistics ?? []) as any[]

  // Keep only the most recent odds per bookmaker + market combination
  const oddsMap = new Map<string, any>()
  for (const o of (oddsRaw ?? []) as any[]) {
    const key = `${o.bookmaker}||${o.market}`
    if (!oddsMap.has(key)) oddsMap.set(key, o)
  }
  const odds = Array.from(oddsMap.values())

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
        homeRecentMatches={homeRecentMatches}
        awayRecentMatches={awayRecentMatches}
      />
    </div>
  )
}
