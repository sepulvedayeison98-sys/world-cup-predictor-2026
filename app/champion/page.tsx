import type { Metadata } from 'next'
import { Trophy } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ChampionProbabilityBracket } from '@/components/champion/ChampionProbabilityBracket'
import { COMPETITION_ID } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Predicción de Campeón | WC Predictor 2026',
}


export default async function ChampionPage() {
  const supabase = await createServerSupabaseClient()

  // Paso 1: obtener la última corrida de simulación
  const { data: latestRun } = await supabase
    .from('tournament_simulations')
    .select('simulation_run_id, created_at')
    .eq('competition_id', COMPETITION_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Paso 2: traer solo los datos de esa corrida + equipos en paralelo
  const [{ data: simulations }, { data: teams }] = await Promise.all([
    latestRun?.simulation_run_id
      ? supabase
          .from('tournament_simulations')
          .select('team_id, winner_prob, final_prob, semi_final_prob, quarter_final_prob, round_of_16_prob, group_stage_advance_prob')
          .eq('competition_id', COMPETITION_ID)
          .eq('simulation_run_id', latestRun.simulation_run_id)
          .order('winner_prob', { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from('teams')
      .select('id, name, short_name, code, confederation, elo_rating')
      .eq('competition_id', COMPETITION_ID),
  ])

  const teamsMap = new Map((teams ?? []).map((t: any) => [t.id, t]))
  const enriched = (simulations ?? [])
    .map((s: any) => ({ ...s, team: teamsMap.get(s.team_id) }))
    .filter((s: any) => s.team)

  // Validación: suma de probabilidades de campeón (debe ser ~100%)
  const totalWinProb = enriched.reduce((acc, s: any) => acc + (s.winner_prob ?? 0), 0)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Trophy className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Predicción de Campeón</h1>
            <p className="text-sm text-zinc-500">
              Probabilidades por equipo · Monte Carlo {(3000).toLocaleString()} iteraciones
            </p>
          </div>
        </div>

        {/* Metadata de la simulación */}
        {latestRun && (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Última simulación</span>
            <span className="text-xs font-medium text-zinc-400 mono">
              {new Date(latestRun.created_at).toLocaleString('es-CO', {
                timeZone: 'America/Bogota',
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
            <span className={`text-[10px] mono font-semibold ${
              Math.abs(totalWinProb - 1) < 0.05 ? 'text-emerald-500' : 'text-amber-500'
            }`}>
              Σ campeón = {(totalWinProb * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <ChampionProbabilityBracket simulations={enriched} />
    </div>
  )
}
