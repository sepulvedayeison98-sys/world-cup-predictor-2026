import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { KPICardsRealtime } from '@/components/dashboard/KPICardsRealtime'
import { UpcomingMatchesWidgetRealtime } from '@/components/dashboard/UpcomingMatchesWidgetRealtime'
import { ValueBetsWidgetRealtime } from '@/components/dashboard/ValueBetsWidgetRealtime'
import { GroupStandingsWidget } from '@/components/dashboard/GroupStandingsWidget'
import { SimulationResultsWidget } from '@/components/dashboard/SimulationResultsWidget'
import { TournamentPathTracker } from '@/components/dashboard/TournamentPathTracker'
import { TerminalHeader } from '@/components/dashboard/TerminalHeader'
import { IntelligenceFeed } from '@/components/dashboard/IntelligenceFeed'
import { buildFeedEntries } from '@/lib/feed'
import { ChampionStripWidget } from '@/components/dashboard/ChampionStripWidget'
import { TopScorersStripWidget } from '@/components/dashboard/TopScorersStripWidget'
import { MODEL_VERSION } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Dashboard | World Cup Predictor 2026',
  description: 'Análisis en tiempo real del Mundial FIFA 2026',
}

const COMPETITION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const [
    { count: totalMatches },
    { count: analyzedMatches },
    { count: activeBetsCount },
    { data: predictions },
    { data: settledBets },
    { data: nextMatchRows },
    { data: recentPredictions },
    { data: recentValueBets },
    { data: simulations },
    { data: teams },
    { data: statsRaw },
    { data: simForScorers },
    { data: matchCounts },
  ] = await Promise.all([
    supabase.from('matches').select('*', { count: 'exact', head: true }),
    supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('value_bets').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('predictions').select('was_correct').not('was_correct', 'is', null),
    supabase.from('value_bets').select('result, odds_value').in('result', ['won', 'lost']),
    supabase
      .from('matches')
      .select('kickoff_time, group:groups(letter)')
      .not('group_id', 'is', null)
      .gte('kickoff_time', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order('kickoff_time', { ascending: true })
      .limit(1),
    // Intelligence feed: recent predictions with match + team info
    supabase
      .from('predictions')
      .select(`
        id, home_win_probability, draw_probability, away_win_probability, created_at,
        match:matches(id, home_team:teams!matches_home_team_id_fkey(code), away_team:teams!matches_away_team_id_fkey(code))
      `)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(10),
    // Recent value bets
    supabase
      .from('value_bets')
      .select('id, description, edge_percentage, odds_value, bookmaker, model_probability, implied_probability, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5),
    // Champion simulations
    supabase
      .from('tournament_simulations')
      .select('team_id, winner_prob')
      .eq('competition_id', COMPETITION_ID)
      .order('winner_prob', { ascending: false })
      .limit(8),
    supabase.from('teams').select('id, name, short_name, code, confederation').eq('competition_id', COMPETITION_ID),
    // Top scorers for strip
    supabase
      .from('player_statistics')
      .select(`
        player_id, goals, matches_played,
        player:players(id, name, short_name, team_id,
          team:teams(id, code, confederation))
      `)
      .eq('competition_id', COMPETITION_ID)
      .gt('matches_played', 0)
      .order('goals', { ascending: false })
      .limit(10),
    // Sim probs for scorer projection
    supabase
      .from('tournament_simulations')
      .select('team_id, winner_prob, final_prob, semi_final_prob, quarter_final_prob, round_of_16_prob, group_stage_advance_prob')
      .eq('competition_id', COMPETITION_ID),
    // Matches played per team for scorers
    supabase
      .from('matches')
      .select('home_team_id, away_team_id, status')
      .eq('competition_id', COMPETITION_ID)
      .in('status', ['finished', 'live']),
  ])

  // KPI calculations
  const resolved = predictions ?? []
  const correctPredictions = resolved.filter((p) => p.was_correct === true).length
  const totalResolved = resolved.length
  const accuracy = totalResolved > 0 ? correctPredictions / totalResolved : null

  const settled = settledBets ?? []
  const betsWon = settled.filter((b: any) => b.result === 'won').length
  const profit = settled.reduce(
    (acc: number, b: any) => acc + (b.result === 'won' ? Number(b.odds_value) - 1 : -1),
    0
  )
  const roi = settled.length > 0 ? (profit / settled.length) * 100 : null
  const activeBets = activeBetsCount ?? 0

  const initialKPIs = {
    total_matches: totalMatches ?? 0,
    analyzed_matches: analyzedMatches ?? 0,
    active_picks: activeBets,
    historical_accuracy: accuracy,
    roi,
    correct_predictions: correctPredictions,
    total_predictions: totalResolved,
    value_bets_detected: activeBets,
    value_bets_won: betsWon,
    value_bets_pending: activeBets,
  }

  const activeGroupLetter = (nextMatchRows?.[0] as any)?.group?.letter ?? 'A'

  // Intelligence feed entries
  const feedEntries = buildFeedEntries(recentPredictions ?? [], recentValueBets ?? [])

  // Champion strip
  const teamsMap = new Map((teams ?? []).map((t: any) => [t.id, t]))
  const championData = (simulations ?? [])
    .map((s: any) => ({ ...s, team: teamsMap.get(s.team_id) }))
    .filter((s: any) => s.team)

  // Top scorers strip
  const playedByTeam = new Map<string, number>()
  for (const m of (matchCounts ?? []) as any[]) {
    playedByTeam.set(m.home_team_id, (playedByTeam.get(m.home_team_id) ?? 0) + 1)
    playedByTeam.set(m.away_team_id, (playedByTeam.get(m.away_team_id) ?? 0) + 1)
  }
  const simByTeam = new Map((simForScorers ?? []).map((s: any) => [s.team_id, s]))

  const scorersData = (statsRaw ?? []).map((s: any) => {
    const teamId = s.player?.team_id
    const played = s.matches_played || 1
    const goalsPerGame = s.goals / played
    const sim = simByTeam.get(teamId)
    const teamMatchesPlayed = playedByTeam.get(teamId) ?? played
    const groupRemaining = Math.max(0, 3 - teamMatchesPlayed)
    const expectedKnockout = sim
      ? (sim.round_of_16_prob ?? 0) + (sim.quarter_final_prob ?? 0) + (sim.semi_final_prob ?? 0) + (sim.final_prob ?? 0) + (sim.winner_prob ?? 0)
      : 0
    const projectedGoals = Math.round(goalsPerGame * (groupRemaining + expectedKnockout) * 10) / 10
    return { ...s, projectedGoals }
  })

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      {/* Bloomberg terminal header */}
      <TerminalHeader
        modelVersion={MODEL_VERSION}
        accuracy={accuracy}
        totalMatches={totalMatches ?? 0}
        analyzedMatches={analyzedMatches ?? 0}
      />

      {/* KPI Cards */}
      <KPICardsRealtime initialKPIs={initialKPIs} />

      {/* Champion + Scorers strip row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChampionStripWidget simulations={championData} />
        <TopScorersStripWidget scorers={scorersData} />
      </div>

      {/* Tournament path */}
      <TournamentPathTracker />

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left col — 2/3 */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <UpcomingMatchesWidgetRealtime />

          {/* Intelligence Feed */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Intelligence Feed
                </span>
              </div>
              <span className="text-[9px] text-zinc-600 mono">
                {feedEntries.length} señales recientes
              </span>
            </div>
            <IntelligenceFeed entries={feedEntries} />
          </div>
        </div>

        {/* Right col — 1/3 */}
        <div className="flex flex-col gap-5">
          <ValueBetsWidgetRealtime />
          <GroupStandingsWidget competitionId={COMPETITION_ID} groupLetter={activeGroupLetter} />
        </div>
      </div>

      {/* Monte Carlo simulation widget */}
      <SimulationResultsWidget />
    </div>
  )
}
