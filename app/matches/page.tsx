import type { Metadata } from 'next'
import { MatchesTable } from '@/components/matches/MatchesTable'
import { MatchFiltersBar } from '@/components/matches/MatchFiltersBar'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { ACTIVE_COMPETITIONS } from '@/lib/sports'

export const metadata: Metadata = {
  title: 'Partidos',
}

// ISR: cacheado y revalidado cada 60s (sin cookies → renderizado estático)
export const revalidate = 60

/**
 * Agenda de partidos con predicción.
 *
 * Cubre las competiciones ACTIVAS de fútbol, no una sola. Hasta 2026-08 esta
 * página consultaba únicamente el Mundial: cuando el torneo pasó a histórico
 * se quedó sin un solo partido programado que mostrar, aunque las seis ligas
 * en curso sí los tuvieran. Los grupos (concepto exclusivo del Mundial)
 * dejaron paso al filtro por competición.
 */
export default async function MatchesPage() {
  const supabase = createStaticSupabaseClient()

  const competitions = ACTIVE_COMPETITIONS
    .filter((c) => c.sport === 'futbol' && c.id !== null)
    .map((c) => ({ id: c.id as string, name: c.name }))
  const competitionIds = competitions.map((c) => c.id)

  // Equipos de todas las competiciones en curso, para el selector
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, code, competition_id')
    .in('competition_id', competitionIds)
    .order('name')

  // Q2 (auditoría C2): la página nunca abre vacía. Si hoy no hay partidos,
  // la fecha por defecto salta a la próxima fecha con partidos (o a la
  // última jugada si no queda nada por delante).
  const TZ = 'America/Bogota'
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const dayStart = new Date(`${todayStr}T00:00:00-05:00`).toISOString()
  const dayEnd = new Date(`${todayStr}T23:59:59-05:00`).toISOString()
  const { count: todayCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .in('competition_id', competitionIds)
    .gte('kickoff_time', dayStart)
    .lte('kickoff_time', dayEnd)

  let defaultDate = todayStr
  if (!todayCount) {
    const { data: nextDated } = await supabase
      .from('matches')
      .select('kickoff_time')
      .in('competition_id', competitionIds)
      .gte('kickoff_time', dayEnd)
      .order('kickoff_time', { ascending: true })
      .limit(1)
      .maybeSingle()
    const { data: lastDated } = nextDated
      ? { data: null }
      : await supabase
          .from('matches')
          .select('kickoff_time')
          .in('competition_id', competitionIds)
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
          Fútbol · {competitions.length} ligas en curso
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
      <MatchFiltersBar
        competitions={competitions}
        teams={teams ?? []}
        defaultDate={defaultDate}
      />

      {/* Table */}
      <MatchesTable defaultDate={defaultDate} competitions={competitions} />
    </div>
  )
}
