import type { Metadata } from 'next'
import { GitBranch } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { TournamentBracket } from '@/components/bracket/TournamentBracket'

export const metadata: Metadata = {
  title: 'Cuadro Eliminatorio | WC Predictor 2026',
}

const COMPETITION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default async function BracketPage() {
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

  // Paso 2: partidos eliminatorios + simulaciones + equipos en paralelo
  const [{ data: matchesRaw }, { data: simsRaw }, { data: teamsRaw }] = await Promise.all([
    supabase
      .from('matches')
      .select(`
        id, phase, match_number, status, home_score, away_score, kickoff_time, venue, city,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name, code, confederation),
        away_team:teams!matches_away_team_id_fkey(id, name, short_name, code, confederation)
      `)
      .eq('competition_id', COMPETITION_ID)
      .neq('phase', 'group')
      .order('match_number', { ascending: true }),

    latestRunId
      ? supabase
          .from('tournament_simulations')
          .select('team_id, winner_prob, final_prob, semi_final_prob, quarter_final_prob, round_of_16_prob')
          .eq('competition_id', COMPETITION_ID)
          .eq('simulation_run_id', latestRunId)
      : Promise.resolve({ data: [] }),

    supabase
      .from('teams')
      .select('id, name, short_name, code, confederation')
      .eq('competition_id', COMPETITION_ID),
  ])

  // Build simulation map by team id (única corrida)
  const simMap: Record<string, any> = {}
  for (const s of simsRaw ?? []) {
    simMap[(s as any).team_id] = s
  }

  // Compute per-match win probabilities from tournament simulations
  const matches = (matchesRaw ?? []).map((m: any) => {
    const homeId = m.home_team?.id
    const awayId = m.away_team?.id
    const homeSim = homeId ? simMap[homeId] : null
    const awaySim = awayId ? simMap[awayId] : null

    let homeWinProb: number | undefined
    let awayWinProb: number | undefined

    if (homeSim && awaySim) {
      const phaseKey = m.phase === 'round_of_32' ? 'round_of_16_prob'
        : m.phase === 'round_of_16' ? 'quarter_final_prob'
        : m.phase === 'quarter_final' ? 'semi_final_prob'
        : m.phase === 'semi_final' ? 'final_prob'
        : 'winner_prob'
      const hp = homeSim[phaseKey] ?? 0
      const ap = awaySim[phaseKey] ?? 0
      const total = hp + ap
      if (total > 0) {
        homeWinProb = hp / total
        awayWinProb = ap / total
      }
    }

    return {
      id: m.id,
      matchId: m.id,
      phase: m.phase,
      matchNumber: m.match_number,
      status: m.status,
      homeTeam: m.home_team ?? null,
      awayTeam: m.away_team ?? null,
      homeScore: m.home_score,
      awayScore: m.away_score,
      kickoffTime: m.kickoff_time,
      venue: m.venue,
      city: m.city,
      homeWinProb,
      awayWinProb,
    }
  })

  const knockoutMatchCount = matches.length

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <GitBranch className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Cuadro Eliminatorio</h1>
          <p className="text-sm text-zinc-500">
            {knockoutMatchCount > 0
              ? `${knockoutMatchCount} partido${knockoutMatchCount !== 1 ? 's' : ''} en fase eliminatoria`
              : 'Fase eliminatoria pendiente — se actualizará al finalizar la fase de grupos'
            }
          </p>
        </div>
      </div>

      <TournamentBracket matches={matches} simulations={simMap} />
    </div>
  )
}
