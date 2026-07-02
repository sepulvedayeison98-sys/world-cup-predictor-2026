import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SimulationEngine } from '@/components/simulation/SimulationEngine'
import { COMPETITION_ID } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Simulador | World Cup Predictor',
}


export default async function SimulationPage() {
  const supabase = await createServerSupabaseClient()
  // Load scheduled matches with predictions (base scenarios)
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, kickoff_time, venue, city, status, phase,
      home_team:teams!matches_home_team_id_fkey(
        id, name, short_name, code, fifa_ranking, elo_rating,
        team_statistics(*),
        players(id, name, short_name, number, position, status)
      ),
      away_team:teams!matches_away_team_id_fkey(
        id, name, short_name, code, fifa_ranking, elo_rating,
        team_statistics(*),
        players(id, name, short_name, number, position, status)
      ),
      predictions(
        home_win_probability, draw_probability, away_win_probability,
        predicted_home_score, predicted_away_score, confidence_score, confidence_level
      )
    `)
    .eq('status', 'scheduled')
    .order('kickoff_time', { ascending: true })
    .limit(20)

  // Load active injuries for context
  const { data: injuries } = await supabase
    .from('injuries')
    .select('player_id, team_id, impact_score, description')
    .eq('competition_id', COMPETITION_ID)
    .eq('is_active', true)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Motor de predicción · Modo interactivo
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Simulador de Escenarios</h1>
        <p className="text-sm text-zinc-400">
          Modifica lesiones, alineaciones y condiciones para recalcular predicciones en tiempo real
        </p>
      </div>

      <SimulationEngine
        matches={matches ?? []}
        activeInjuries={injuries ?? []}
        userId="anonymous"
      />
    </div>
  )
}
