import type { Metadata } from 'next'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { PlayersTable } from '@/components/players/PlayersTable'
import { PlayersFiltersBar } from '@/components/players/PlayersFiltersBar'
import { COMPETITION_ID } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Jugadores | World Cup Predictor',
}


// ISR: cacheado y revalidado cada 300s (sin cookies → renderizado estático)
export const revalidate = 300

export default async function PlayersPage() {
  const supabase = createStaticSupabaseClient()
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, code')
    .eq('competition_id', COMPETITION_ID)
    .order('name')

  // Aggregate stats for summary KPIs
  const { data: statsAgg } = await supabase
    .from('player_statistics')
    .select('goals, assists, minutes_played')
    .eq('competition_id', COMPETITION_ID)

  const totalGoals    = (statsAgg ?? []).reduce((s, r) => s + (r.goals ?? 0), 0)
  const totalAssists  = (statsAgg ?? []).reduce((s, r) => s + (r.assists ?? 0), 0)
  const totalMinutes  = (statsAgg ?? []).reduce((s, r) => s + (r.minutes_played ?? 0), 0)

  const { count: injuredCount } = await supabase
    .from('injuries')
    .select('*', { count: 'exact', head: true })
    .eq('competition_id', COMPETITION_ID)
    .eq('is_active', true)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Mundial 2026 · Plantillas
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Jugadores</h1>
        <p className="text-sm text-zinc-400">
          Estadísticas individuales, estado físico y rendimiento
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Goles totales',   value: totalGoals.toString(),   color: 'text-emerald-400' },
          { label: 'Asistencias',     value: totalAssists.toString(), color: 'text-blue-400' },
          { label: 'Minutos jugados', value: `${(totalMinutes / 1000).toFixed(0)}k`, color: 'text-zinc-300' },
          { label: 'Jugadores lesionados', value: (injuredCount ?? 0).toString(), color: 'text-red-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <p className="text-[11px] text-zinc-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mono ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <PlayersFiltersBar teams={teams ?? []} />
      <PlayersTable competitionId={COMPETITION_ID} />
    </div>
  )
}
