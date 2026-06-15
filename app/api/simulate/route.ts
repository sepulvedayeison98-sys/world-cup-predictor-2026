import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runMonteCarloSimulation, type Team, type Match } from '@/lib/simulationEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COMPETITION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

/** phase del esquema -> stage que espera el motor de simulación. */
function mapStage(phase: string): Match['stage'] {
  switch (phase) {
    case 'round_of_16': return 'round_of_16'
    case 'quarter_final': return 'quarter_finals'
    case 'semi_final': return 'semi_finals'
    case 'final': return 'final'
    default: return 'group'
  }
}

/**
 * GET /api/simulate — corre la simulación Monte Carlo del torneo y guarda las
 * probabilidades por equipo/fase en `tournament_simulations`.
 * Protegida por CRON_SECRET (la dispara un cron/Action, no es pública).
 *
 * Nota: con solo datos de fase de grupos cargados, se obtiene la probabilidad
 * de avanzar de grupos; las eliminatorias quedan en 0 hasta cargar esos cruces.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  try {
    // Equipos con su letra de grupo
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, code, elo_rating, group:groups(letter)')
      .eq('competition_id', COMPETITION_ID)
    if (teamsError) throw teamsError

    const allTeams: Team[] = (teamsData ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      elo: t.elo_rating ?? 1500,
      group: t.group?.letter,
    }))

    // Partidos con letra de grupo, fase y probabilidades de la predicción
    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select('id, home_team_id, away_team_id, kickoff_time, phase, group:groups(letter), predictions(home_win_probability, draw_probability, away_win_probability)')
      .eq('competition_id', COMPETITION_ID)
    if (matchesError) throw matchesError

    const allMatches: Match[] = (matchesData ?? []).map((m: any) => {
      const pred = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
      return {
        id: m.id,
        home_team_id: m.home_team_id,
        away_team_id: m.away_team_id,
        match_date: m.kickoff_time,
        stage: mapStage(m.phase),
        group_letter: m.group?.letter,
        probabilities: pred
          ? { home: pred.home_win_probability, draw: pred.draw_probability, away: pred.away_win_probability }
          : undefined,
      }
    })

    // Correr la simulación
    const numSimulations = 3000
    const results = runMonteCarloSimulation(allTeams, allMatches, numSimulations)

    const simulationRunId = crypto.randomUUID()
    const rows = results.map((r) => ({
      competition_id: COMPETITION_ID,
      team_id: r.teamId,
      simulation_run_id: simulationRunId,
      group_stage_advance_prob: r.groupStageAdvanceProb,
      round_of_16_prob: r.roundOf16Prob,
      quarter_final_prob: r.quarterFinalProb,
      semi_final_prob: r.semiFinalProb,
      final_prob: r.finalProb,
      winner_prob: r.winnerProb,
    }))

    const { error: insertError } = await supabase.from('tournament_simulations').insert(rows)
    if (insertError) throw insertError

    await supabase.from('sync_logs').insert({
      source: 'monte_carlo', entity_type: 'tournament_simulations', status: 'success',
      records_processed: rows.length, metadata: { simulationRunId, numSimulations },
    })

    return NextResponse.json({
      success: true, simulationRunId, teams: rows.length, numSimulations,
    })
  } catch (err: any) {
    console.error('[GET /api/simulate]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
