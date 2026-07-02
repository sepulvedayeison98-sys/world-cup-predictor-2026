import type { Metadata } from 'next'
import { Crosshair } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { TopScorersPrediction } from '@/components/scorers/TopScorersPrediction'
import { COMPETITION_ID } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Predicción Goleadores | WC Predictor 2026',
}


export default async function ScorersPage() {
  const supabase = await createServerSupabaseClient()

  // Paso 1: obtener última corrida de simulación
  const { data: latestSimRun } = await supabase
    .from('tournament_simulations')
    .select('simulation_run_id')
    .eq('competition_id', COMPETITION_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestRunId = latestSimRun?.simulation_run_id

  // Paso 2: estadísticas + simulaciones + partidos en paralelo
  const [{ data: statsRaw }, { data: simulations }, { data: matchCounts }] = await Promise.all([
    supabase
      .from('player_statistics')
      .select(`
        player_id, goals, assists, matches_played, shots, shots_on_target,
        avg_rating, form_score, physical_condition,
        player:players(id, name, short_name, position, photo_url, team_id,
          team:teams(id, name, short_name, code, confederation))
      `)
      .eq('competition_id', COMPETITION_ID)
      .gt('matches_played', 0)
      .order('goals', { ascending: false })
      .limit(50),

    // Probabilidades filtradas por última corrida
    latestRunId
      ? supabase
          .from('tournament_simulations')
          .select('team_id, winner_prob, final_prob, semi_final_prob, quarter_final_prob, round_of_16_prob, group_stage_advance_prob')
          .eq('competition_id', COMPETITION_ID)
          .eq('simulation_run_id', latestRunId)
      : Promise.resolve({ data: [] }),

    // Partidos ya jugados por equipo (para calcular restantes)
    supabase
      .from('matches')
      .select('home_team_id, away_team_id, status')
      .eq('competition_id', COMPETITION_ID)
      .in('status', ['finished', 'live']),
  ])

  // Mapa de partidos jugados por equipo
  const playedByTeam = new Map<string, number>()
  for (const m of (matchCounts ?? []) as any[]) {
    playedByTeam.set(m.home_team_id, (playedByTeam.get(m.home_team_id) ?? 0) + 1)
    playedByTeam.set(m.away_team_id, (playedByTeam.get(m.away_team_id) ?? 0) + 1)
  }

  // Mapa de probabilidades de avance por equipo
  const simByTeam = new Map((simulations ?? []).map((s: any) => [s.team_id, s]))

  // Proyección de goles: goals_per_game × expected_remaining_matches
  const enriched = (statsRaw ?? []).map((s: any) => {
    const teamId = s.player?.team_id
    const played = s.matches_played || 1
    const goalsPerGame = s.goals / played
    const sim = simByTeam.get(teamId)

    const teamMatchesPlayed = playedByTeam.get(teamId) ?? played
    const groupRemaining = Math.max(0, 3 - teamMatchesPlayed)
    const expectedKnockout = sim
      ? (sim.round_of_16_prob ?? 0) +
        (sim.quarter_final_prob ?? 0) +
        (sim.semi_final_prob ?? 0) +
        (sim.final_prob ?? 0) +
        (sim.winner_prob ?? 0)
      : 0

    const expectedRemaining = groupRemaining + expectedKnockout
    const projectedGoals = goalsPerGame * expectedRemaining

    return {
      ...s,
      goalsPerGame: Math.round(goalsPerGame * 100) / 100,
      expectedRemaining: Math.round(expectedRemaining * 10) / 10,
      projectedGoals: Math.round(projectedGoals * 10) / 10,
      teamAdvanceProb: sim?.group_stage_advance_prob ?? 0,
    }
  }).sort((a: any, b: any) => b.goals - a.goals || b.projectedGoals - a.projectedGoals)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Crosshair className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Predicción Goleadores</h1>
          <p className="text-sm text-zinc-500">
            Proyección de goles basada en rendimiento actual y partidos restantes esperados
          </p>
        </div>
      </div>

      <TopScorersPrediction players={enriched} />
    </div>
  )
}
