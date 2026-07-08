import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MatchHeader } from '@/components/matches/MatchHeader'
import { LiveMatchRefresh } from '@/components/matches/LiveMatchRefresh'
import { MatchAnalysisTabs } from '@/components/matches/MatchAnalysisTabs'
import { fetchTeamForm } from '@/lib/teamForm'
import type { MatchFormEntry } from '@/lib/smartBetsEngine'
import { computeModelPrediction, computeConfidenceLevel } from '@/lib/predictionEngine'
import { MODEL_VERSION } from '@/lib/constants'
import type { GroupContext } from '@/app/api/analysis/match/[id]/route'
import { COMPETITIONS_NAV } from '@/lib/sports'
import { VerdictPanel } from '@/components/matches/VerdictPanel'
import { MatchTimeline } from '@/components/matches/MatchTimeline'

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

  const KNOCKOUT_PHASES = new Set(['round_of_32','round_of_16','quarter_final','semi_final','final','third_place'])
  const isKnockout = KNOCKOUT_PHASES.has(m.phase)

  // Injuries, forma reciente y (para eliminatorias) contexto de grupo — en paralelo
  const homeGroupId: string | null = m.home_team?.group_id ?? null
  const awayGroupId: string | null = m.away_team?.group_id ?? null

  async function fetchGroupContext(groupId: string | null, teamId: string): Promise<GroupContext | null> {
    if (!groupId || !isKnockout) return null
    const { data } = await supabase
      .from('group_standings')
      .select('won, drawn, lost, goals_for, goals_against, points, team_id, groups(letter, name), teams(id, name, short_name)')
      .eq('group_id', groupId)
      .order('points', { ascending: false })
    if (!data || data.length === 0) return null
    const rows = data as any[]
    // Sort by points desc, goal_difference desc for position
    const sorted = [...rows].sort((a, b) =>
      (b.points - a.points) || ((b.goals_for - b.goals_against) - (a.goals_for - a.goals_against))
    )
    const pos = sorted.findIndex((r: any) => r.team_id === teamId)
    const entry = rows.find((r: any) => r.team_id === teamId)
    if (!entry) return null
    const grp = entry.groups as any
    const otherTeams = rows
      .filter((r: any) => r.team_id !== teamId)
      .map((r: any) => (r.teams as any)?.short_name ?? (r.teams as any)?.name ?? '?')
    return {
      groupLetter: grp?.letter ?? '',
      groupName:   grp?.name  ?? '',
      position:    pos >= 0 ? pos + 1 : 0,
      won:         entry.won ?? 0,
      drawn:       entry.drawn ?? 0,
      lost:        entry.lost ?? 0,
      goalsFor:    entry.goals_for ?? 0,
      goalsAgainst:entry.goals_against ?? 0,
      points:      entry.points ?? 0,
      otherTeams,
    }
  }

  const [{ data: injuriesData }, homeRecentMatches, awayRecentMatches, homeGroupContext, awayGroupContext] = await Promise.all([
    supabase
      .from('injuries')
      .select('*, player:players(name, short_name, position, photo_url)')
      .in('team_id', [m.home_team_id, m.away_team_id])
      .eq('is_active', true),
    fetchTeamForm(supabase, m.home_team_id, id, m.competition_id),
    fetchTeamForm(supabase, m.away_team_id, id, m.competition_id),
    fetchGroupContext(homeGroupId, m.home_team_id),
    fetchGroupContext(awayGroupId, m.away_team_id),
  ])

  // PostgREST returns predictions as object (UNIQUE match_id); handle array too
  const savedPrediction = Array.isArray(m.predictions)
    ? (m.predictions[0] ?? null)
    : (m.predictions ?? null)

  const homeStats  = m.home_team?.team_statistics?.[0] ?? null
  const awayStats  = m.away_team?.team_statistics?.[0] ?? null

  // Medias del torneo derivadas de la forma reciente: es la mejor fuente
  // disponible cuando team_statistics está vacía (los partidos del Mundial
  // ya tienen xG/estadísticas por partido en match_statistics).
  function tournamentAverages(form: MatchFormEntry[]) {
    if (form.length === 0) return null
    const n = form.length
    const avg = (sel: (e: MatchFormEntry) => number | null | undefined): number | null => {
      const vals = form.map(sel).filter((v): v is number => v != null)
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
    }
    const goals    = form.reduce((s, e) => s + e.goals_scored, 0) / n
    const conceded = form.reduce((s, e) => s + e.goals_conceded, 0) / n
    return {
      xg:    avg(e => e.xg)  ?? goals,
      xga:   avg(e => e.xga) ?? conceded,
      goals,
      sot:   avg(e => e.shots_on_target) ?? undefined,
      // Cronológico ascendente: formToScore pondera los últimos del array
      form:  [...form].reverse().map(e => e.result),
    }
  }

  // Si no hay predicción guardada (partidos nuevos como octavos R32), calculamos al vuelo
  let prediction = savedPrediction
  if (!savedPrediction && m.status !== 'finished') {
    const homeInjury = (injuriesData ?? [])
      .filter((i: any) => i.team_id === m.home_team_id)
      .reduce((s: number, i: any) => s + (i.impact_score ?? 0), 0)
    const awayInjury = (injuriesData ?? [])
      .filter((i: any) => i.team_id === m.away_team_id)
      .reduce((s: number, i: any) => s + (i.impact_score ?? 0), 0)

    const hDerived = tournamentAverages(homeRecentMatches)
    const aDerived = tournamentAverages(awayRecentMatches)

    const result = computeModelPrediction({
      homeElo: m.home_team?.elo_rating ?? 1500,
      awayElo: m.away_team?.elo_rating ?? 1500,
      homeForm: homeStats?.form ?? hDerived?.form ?? [],
      awayForm: awayStats?.form ?? aDerived?.form ?? [],
      // Prioridad: stats de temporada → medias reales del torneo → default
      // simétrico (en un Mundial no hay ventaja de "local").
      homeXg:   homeStats?.avg_xg  ?? hDerived?.xg  ?? 1.1,
      awayXg:   awayStats?.avg_xg  ?? aDerived?.xg  ?? 1.1,
      homeXga:  homeStats?.avg_xga ?? hDerived?.xga ?? 1.1,
      awayXga:  awayStats?.avg_xga ?? aDerived?.xga ?? 1.1,
      homeShotsOnTarget: homeStats?.avg_shots_on_target ?? hDerived?.sot,
      awayShotsOnTarget: awayStats?.avg_shots_on_target ?? aDerived?.sot,
      homeGoalsScored: homeStats?.avg_goals_scored ?? hDerived?.goals,
      awayGoalsScored: awayStats?.avg_goals_scored ?? aDerived?.goals,
      homeInjuryImpact: homeInjury,
      awayInjuryImpact: awayInjury,
      isKnockout,
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
      model_version:         MODEL_VERSION,
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

  // Contexto de competición para el regreso y la etiqueta (universal):
  // primero el registro (Mundial + ligas); si no está (p. ej. amistosos),
  // el nombre viene de la BD y el regreso cae en /matches.
  const registryEntry = COMPETITIONS_NAV.find((c) => c.id === m.competition_id)
  // Deportes sin modelo de goles (NBA) ocultan Smart Bets / gemelo Poisson
  const isFootball = registryEntry ? registryEntry.sport === 'futbol' : true
  let competitionCtx: { name: string; href: string } | null = registryEntry
    ? { name: registryEntry.name, href: registryEntry.href }
    : null
  if (!competitionCtx) {
    const { data: comp } = await supabase
      .from('competitions')
      .select('name')
      .eq('id', m.competition_id)
      .maybeSingle()
    if (comp) competitionCtx = { name: (comp as any).name, href: '/matches' }
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <LiveMatchRefresh status={m.status} kickoffTime={m.kickoff_time} />
      <MatchHeader match={m} competition={competitionCtx} prediction={savedPrediction} />

      {/* Veredicto post-partido (solo finalizados) + línea de tiempo */}
      {m.status === 'finished' && <VerdictPanel matchId={m.id} />}
      {['finished', 'live'].includes(m.status) && (
        <MatchTimeline
          matchId={m.id}
          homeTeamId={m.home_team_id}
          homeName={m.home_team?.short_name ?? m.home_team?.name ?? 'Local'}
          awayName={m.away_team?.short_name ?? m.away_team?.name ?? 'Visitante'}
          hasSource={m.api_football_id != null}
          status={m.status}
        />
      )}

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
        homeGroupContext={homeGroupContext ?? undefined}
        awayGroupContext={awayGroupContext ?? undefined}
        football={isFootball}
      />
    </div>
  )
}
