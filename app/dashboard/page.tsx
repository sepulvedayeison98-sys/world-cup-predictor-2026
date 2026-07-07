import type { Metadata } from 'next'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { KPICardsRealtime } from '@/components/dashboard/KPICardsRealtime'
import { UpcomingMatchesWidgetRealtime } from '@/components/dashboard/UpcomingMatchesWidgetRealtime'
import { ValueBetsWidgetRealtime } from '@/components/dashboard/ValueBetsWidgetRealtime'
import { KnockoutBracketWidget } from '@/components/dashboard/KnockoutBracketWidget'
import { ModelPerformancePanel } from '@/components/dashboard/ModelPerformancePanel'
import { TournamentPathTracker } from '@/components/dashboard/TournamentPathTracker'
import { TerminalHeader } from '@/components/dashboard/TerminalHeader'
import { IntelligenceFeed } from '@/components/dashboard/IntelligenceFeed'
import { buildFeedEntries } from '@/lib/feed'
import { ChampionStripWidget } from '@/components/dashboard/ChampionStripWidget'
import { TopScorersStripWidget } from '@/components/dashboard/TopScorersStripWidget'
import { MODEL_VERSION, COMPETITION_ID } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Dashboard | World Cup Predictor 2026',
  description: 'Análisis en tiempo real del Mundial FIFA 2026',
}


// ISR: el HTML se cachea 60s — el dashboard hace ~14 queries por render,
// así la mayoría de visitas no golpean Supabase. Los widgets realtime
// del cliente se actualizan solos tras la carga.
export const revalidate = 60

export default async function DashboardPage() {
  const supabase = createStaticSupabaseClient()

  // Paso 1: obtener la última corrida de simulación (secuencial, necesario para filtrar)
  const { data: latestSimRun } = await supabase
    .from('tournament_simulations')
    .select('simulation_run_id')
    .eq('competition_id', COMPETITION_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestRunId = latestSimRun?.simulation_run_id

  // Paso 2: todas las demás queries en paralelo
  const [
    { count: totalMatches },
    { count: analyzedMatches },
    { count: activeBetsCount },
    { count: highGradeBetsCount },
    { data: predictions },
    { data: settledBets },
    { data: knockoutMatches },
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
    supabase.from('value_bets').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('grade', 'high'),
    supabase
      .from('predictions')
      .select(`
        was_correct, home_win_probability, draw_probability, away_win_probability,
        match:matches(phase, home_score, away_score, kickoff_time,
          home_team:teams!matches_home_team_id_fkey(code),
          away_team:teams!matches_away_team_id_fkey(code))
      `)
      .not('was_correct', 'is', null),
    supabase.from('value_bets').select('result, odds_value').in('result', ['won', 'lost']),
    // Cuadro eliminatorio para el widget del dashboard
    supabase
      .from('matches')
      .select(`
        id, phase, kickoff_time, status, home_score, away_score,
        home_team:teams!matches_home_team_id_fkey(code, short_name, elo_rating),
        away_team:teams!matches_away_team_id_fkey(code, short_name, elo_rating),
        predictions(home_win_probability, draw_probability, away_win_probability)
      `)
      .eq('competition_id', COMPETITION_ID)
      .in('phase', ['round_of_32','round_of_16','quarter_final','semi_final','third_place','final'])
      .order('kickoff_time', { ascending: true })
      .limit(32),
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
    // Recent value bets — solo columnas que existen en el schema
    supabase
      .from('value_bets')
      .select('id, market, odds_value, bookmaker, model_probability, implied_probability, edge, grade, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5),
    // Champion simulations — filtrado por última corrida
    latestRunId
      ? supabase
          .from('tournament_simulations')
          .select('team_id, winner_prob')
          .eq('competition_id', COMPETITION_ID)
          .eq('simulation_run_id', latestRunId)
          .order('winner_prob', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
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
    // Sim probs for scorer projection — filtrado por última corrida
    latestRunId
      ? supabase
          .from('tournament_simulations')
          .select('team_id, winner_prob, final_prob, semi_final_prob, quarter_final_prob, round_of_16_prob, group_stage_advance_prob')
          .eq('competition_id', COMPETITION_ID)
          .eq('simulation_run_id', latestRunId)
      : Promise.resolve({ data: [] }),
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

  // Predicciones resueltas ordenadas por fecha (más reciente primero) para el panel
  const resolvedByDate = [...resolved].sort(
    (a: any, b: any) => new Date(b.match?.kickoff_time ?? 0).getTime() - new Date(a.match?.kickoff_time ?? 0).getTime()
  )

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
    active_picks: highGradeBetsCount ?? 0,   // picks de alto valor (no duplica value_bets_detected)
    historical_accuracy: accuracy,
    roi,
    correct_predictions: correctPredictions,
    total_predictions: totalResolved,
    value_bets_detected: activeBets,
    value_bets_won: betsWon,
    value_bets_pending: activeBets,
  }

  // Intelligence feed entries
  const feedEntries = buildFeedEntries(recentPredictions ?? [], recentValueBets ?? [])

  // Champion strip — equipos enriquecidos con datos del equipo
  const teamsMap = new Map((teams ?? []).map((t: any) => [t.id, t]))
  const championData = (simulations ?? [])
    .map((s: any) => ({ ...s, team: teamsMap.get(s.team_id) }))
    .filter((s: any) => s.team)

  // Top scorers strip
  const playedByTeam = new Map<string, number>()
  for (const m of (matchCounts ?? [])) {
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
              <span className="text-[10px] text-zinc-600 mono">
                {feedEntries.length} señales recientes
              </span>
            </div>
            <IntelligenceFeed entries={feedEntries} />
          </div>
        </div>

        {/* Right col — 1/3 */}
        <div className="flex flex-col gap-5">
          <ModelPerformancePanel resolved={resolvedByDate as any[]} />
          <ValueBetsWidgetRealtime />
          <KnockoutBracketWidget matches={(knockoutMatches ?? []) as any[]} />
        </div>
      </div>

    </div>
  )
}
