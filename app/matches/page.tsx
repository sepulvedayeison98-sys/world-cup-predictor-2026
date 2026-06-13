import type { Metadata } from 'next'
import { MatchesTable } from '@/components/matches/MatchesTable'
import { MatchFiltersBar } from '@/components/matches/MatchFiltersBar'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Partidos | World Cup Predictor',
}

export default async function MatchesPage() {
  const supabase = await createServerSupabaseClient()
  // Fetch groups for filter dropdown (server-side)
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, letter')
    .eq('competition_id', process.env.NEXT_PUBLIC_COMPETITION_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    .order('letter')

  // Fetch teams for filter dropdown
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, code')
    .eq('competition_id', process.env.NEXT_PUBLIC_COMPETITION_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    .order('name')

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Mundial 2026 · Fase de Grupos
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Partidos</h1>
        <p className="text-sm text-zinc-400">
          Tabla avanzada con predicciones y probabilidades del motor
        </p>
      </div>

      {/* Filters */}
      <MatchFiltersBar groups={groups ?? []} teams={teams ?? []} />

      {/* Table */}
      <MatchesTable />
    </div>
  )
}
