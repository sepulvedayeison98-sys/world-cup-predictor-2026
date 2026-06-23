import type { Metadata } from 'next'
import { Trophy } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ChampionProbabilityBracket } from '@/components/champion/ChampionProbabilityBracket'

export const metadata: Metadata = {
  title: 'Predicción de Campeón | WC Predictor 2026',
}

const COMPETITION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default async function ChampionPage() {
  const supabase = await createServerSupabaseClient()

  const [{ data: simulations }, { data: teams }] = await Promise.all([
    supabase
      .from('tournament_simulations')
      .select('team_id, winner_prob, final_prob, semi_final_prob, quarter_final_prob, round_of_16_prob, group_stage_advance_prob')
      .eq('competition_id', COMPETITION_ID)
      .order('winner_prob', { ascending: false })
      .limit(48),
    supabase
      .from('teams')
      .select('id, name, short_name, code, confederation, elo_rating')
      .eq('competition_id', COMPETITION_ID),
  ])

  const teamsMap = new Map((teams ?? []).map((t: any) => [t.id, t]))
  const enriched = (simulations ?? [])
    .map((s: any) => ({ ...s, team: teamsMap.get(s.team_id) }))
    .filter((s: any) => s.team)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Trophy className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Predicción de Campeón</h1>
          <p className="text-sm text-zinc-500">
            Probabilidades de campeonato por equipo · Monte Carlo {(3000).toLocaleString()} iteraciones
          </p>
        </div>
      </div>

      <ChampionProbabilityBracket simulations={enriched} />
    </div>
  )
}
