import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MatchHeader } from '@/components/matches/MatchHeader'
import { MatchPredictionPanel } from '@/components/matches/MatchPredictionPanel'
import { TeamComparisonRadar } from '@/components/charts/TeamComparisonRadar'
import { ExactScoresTable } from '@/components/matches/ExactScoresTable'
import { ProbabilityHistoryChart } from '@/components/charts/ProbabilityHistoryChart'
import { MatchStatsComparison } from '@/components/matches/MatchStatsComparison'
import { LineupDisplay } from '@/components/matches/LineupDisplay'
import { InjuriesPanel } from '@/components/matches/InjuriesPanel'

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

  const { data: match } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(*, team_statistics(*)),
      away_team:teams!matches_away_team_id_fkey(*, team_statistics(*)),
      predictions(*, exact_score_predictions(*)),
      match_statistics(*)
    `)
    .eq('id', id)
    .single()

  if (!match) notFound()

  const m = match as any
  const prediction = Array.isArray(m.predictions) ? m.predictions[0] : null
  const homeStats = m.home_team?.team_statistics?.[0] ?? null
  const awayStats = m.away_team?.team_statistics?.[0] ?? null
  const matchStats = (m.match_statistics ?? []) as any[]

  // Injuries for both teams
  const { data: injuries } = await supabase
    .from('injuries')
    .select('*, player:players(name, short_name, position, photo_url)')
    .in('team_id', [m.home_team_id, m.away_team_id])
    .eq('is_active', true)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Match header — teams, score, status, meta */}
      <MatchHeader match={m} />

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Left / center — 2 cols */}
        <div className="space-y-6 lg:col-span-2">

          {/* Stats comparison (if match has stats) */}
          {matchStats.length > 0 && (
            <MatchStatsComparison
              stats={matchStats}
              homeTeam={m.home_team}
              awayTeam={m.away_team}
            />
          )}

          {/* Team comparison radar */}
          {homeStats && awayStats && (
            <TeamComparisonRadar
              homeTeam={m.home_team}
              awayTeam={m.away_team}
              homeStats={homeStats}
              awayStats={awayStats}
            />
          )}

          {/* Probability history chart */}
          <ProbabilityHistoryChart matchId={id} />

          {/* Lineup */}
          <LineupDisplay matchId={id} homeTeam={m.home_team} awayTeam={m.away_team} />
        </div>

        {/* Right — 1 col */}
        <div className="space-y-6">
          {/* Prediction panel */}
          {prediction && (
            <MatchPredictionPanel prediction={prediction} match={m} />
          )}

          {/* Exact scores */}
          {prediction?.exact_score_predictions?.length > 0 && (
            <ExactScoresTable scores={prediction.exact_score_predictions} />
          )}

          {/* Injuries */}
          <InjuriesPanel
            injuries={injuries ?? []}
            homeTeamId={m.home_team_id}
            awayTeamId={m.away_team_id}
            homeTeam={m.home_team}
            awayTeam={m.away_team}
          />
        </div>
      </div>
    </div>
  )
}
