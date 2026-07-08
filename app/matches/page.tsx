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
    .eq('competition_id', COMPETITION_ID)
    .gte('kickoff_time', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
    .order('kickoff_time', { ascending: true })
    .limit(1)
    .maybeSingle()
  const { data: lastMatch } = nextMatch
    ? { data: null }
    : await supabase
        .from('matches')
        .select('phase')
        .eq('competition_id', COMPETITION_ID)
        .order('kickoff_time', { ascending: false })
        .limit(1)
        .maybeSingle()
  const currentPhase = (nextMatch ?? lastMatch)?.phase as string | undefined
  const phaseLabel = (currentPhase && PHASE_LABELS[currentPhase]) ?? 'Mundial 2026'

  // Q2 (auditoría C2): la página nunca abre vacía. Si hoy no hay partidos,
  // la fecha por defecto salta a la próxima fecha con partidos (o a la
  // última jugada si el torneo terminó).
  const TZ = 'America/Bogota'
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const dayStart = new Date(`${todayStr}T00:00:00-05:00`).toISOString()
  const dayEnd = new Date(`${todayStr}T23:59:59-05:00`).toISOString()
  const { count: todayCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('competition_id', COMPETITION_ID)
    .gte('kickoff_time', dayStart)
    .lte('kickoff_time', dayEnd)

  let defaultDate = todayStr
  if (!todayCount) {
    const { data: nextDated } = await supabase
      .from('matches')
      .select('kickoff_time')
      .eq('competition_id', COMPETITION_ID)
      .gte('kickoff_time', dayEnd)
      .order('kickoff_time', { ascending: true })
      .limit(1)
      .maybeSingle()
    const { data: lastDated } = nextDated
      ? { data: null }
      : await supabase
          .from('matches')
          .select('kickoff_time')
          .eq('competition_id', COMPETITION_ID)
          .order('kickoff_time', { ascending: false })
          .limit(1)
          .maybeSingle()
    const anchor = (nextDated ?? lastDated)?.kickoff_time
    if (anchor) defaultDate = new Date(anchor).toLocaleDateString('en-CA', { timeZone: TZ })
  }
  const jumped = defaultDate !== todayStr
  const jumpedLabel = jumped
    ? new Date(`${defaultDate}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

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

      {jumped && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-400">
          Hoy no hay partidos programados — mostrando la próxima fecha con
          actividad: <span className="font-semibold text-emerald-400">{jumpedLabel}</span>.
        </div>
      )}

      {/* Filters */}
      <MatchFiltersBar groups={groups ?? []} teams={teams ?? []} defaultDate={defaultDate} />

      {/* Table */}
      <MatchesTable defaultDate={defaultDate} />
    </div>
  )
}
