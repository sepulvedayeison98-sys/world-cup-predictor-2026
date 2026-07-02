import type { Metadata } from 'next'
import { MatchesTable } from '@/components/matches/MatchesTable'
import { MatchFiltersBar } from '@/components/matches/MatchFiltersBar'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PHASE_LABELS, COMPETITION_ID } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Partidos | World Cup Predictor',
}

export default async function MatchesPage() {
  const supabase = await createServerSupabaseClient()
  // Fetch groups for filter dropdown (server-side)
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, letter')
    .eq('competition_id', COMPETITION_ID)
    .order('letter')

  // Fetch teams for filter dropdown
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, code')
    .eq('competition_id', COMPETITION_ID)
    .order('name')

  // Fase actual: la del próximo partido (o el más reciente si no hay próximos)
  const { data: nextMatch } = await supabase
    .from('matches')
    .select('phase')
    .gte('kickoff_time', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
    .order('kickoff_time', { ascending: true })
    .limit(1)
    .maybeSingle()
  const { data: lastMatch } = nextMatch
    ? { data: null }
    : await supabase
        .from('matches')
        .select('phase')
        .order('kickoff_time', { ascending: false })
        .limit(1)
        .maybeSingle()
  const currentPhase = (nextMatch ?? lastMatch)?.phase as string | undefined
  const phaseLabel = (currentPhase && PHASE_LABELS[currentPhase]) ?? 'Mundial 2026'

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Mundial 2026 · {phaseLabel}
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
