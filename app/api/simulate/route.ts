import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { runMonteCarloSimulation, Team, Match } from '@/lib/simulationEngine';

export async function GET() {
  const supabase = createAdminClient();

  try {
    // 1. Obtener todos los equipos
    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, code, elo, group");

    if (teamsError) throw teamsError;
    const allTeams: Team[] = teamsData.map(t => ({ ...t, elo: t.elo || 1500 })); // Asegurar ELO por defecto

    // 2. Obtener todos los partidos con sus probabilidades (si existen)
    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select(`
        id,
        home_team_id,
        away_team_id,
        match_date,
        stage,
        group_letter,
        predictions(home_win_probability, draw_probability, away_win_probability)
      `);

    if (matchesError) throw matchesError;

    const allMatches: Match[] = matchesData.map(m => ({
      ...m,
      probabilities: m.predictions && m.predictions.length > 0 ? {
        home: m.predictions[0].home_win_probability,
        draw: m.predictions[0].draw_probability,
        away: m.predictions[0].away_win_probability,
      } : undefined,
      predictions: undefined, // Limpiar para evitar conflictos de tipo
    }));

    // 3. Ejecutar la simulación de Monte Carlo
    const numSimulations = 1000; // Puedes ajustar este número
    const simulationResults = runMonteCarloSimulation(allTeams, allMatches, numSimulations);

    // Generar un ID único para esta corrida de simulación
    const simulationRunId = crypto.randomUUID();

    // 4. Guardar los resultados en la base de datos
    const resultsToInsert = simulationResults.map(sr => ({
      competition_id: allMatches[0]?.competition_id || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // Asumir una competition_id
      team_id: sr.teamId,
      simulation_run_id: simulationRunId,
      group_stage_advance_prob: sr.groupStageAdvanceProb,
      round_of_16_prob: sr.roundOf16Prob,
      quarter_final_prob: sr.quarterFinalProb,
      semi_final_prob: sr.semiFinalProb,
      final_prob: sr.finalProb,
      winner_prob: sr.winnerProb,
    }));

    const { error: insertError } = await supabase
      .from("simulation_results")
      .insert(resultsToInsert);

    if (insertError) throw insertError;

    return NextResponse.json({ message: "Simulación de Monte Carlo ejecutada y resultados guardados.", simulationRunId });
  } catch (error: any) {
    console.error("Error en la simulación de Monte Carlo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
