import type { Metadata } from 'next'
import Link from 'next/link'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { NBA_COMPETITION_ID } from '@/lib/nba/constants'
import { computeNbaRecords } from '@/lib/nba/engine'
import { fetchAllRows } from '@/lib/fetchAll'
import { ConferenceStandings, type NbaStandingView } from '@/components/nba/ConferenceStandings'
import { NbaSchedule } from '@/components/nba/NbaSchedule'

export const metadata: Metadata = {
  title: 'NBA | Veredicto',
  description: 'Clasificación por conferencia, calendario y predicciones del motor para la NBA.',
}

export const revalidate = 300

export default async function NbaHubPage() {
  const supabase = createStaticSupabaseClient()

  // Standings = solo temporada regular. Paginado: la NBA supera las 1000
  // filas de PostgREST (~1230 partidos), que si no truncaría los récords.
  const matchesPromise = fetchAllRows((from, to) => supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_score, away_score, status, kickoff_time')
    .eq('competition_id', NBA_COMPETITION_ID)
    .eq('phase', 'regular_season')
    .range(from, to))

  const [{ data: teams }, matches, { data: preds }, { data: anchorRow }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, code, logo_url, conference, elo_rating')
      .eq('competition_id', NBA_COMPETITION_ID),
    matchesPromise,
    supabase
      .from('predictions')
      .select('was_correct, match:matches!inner(competition_id)')
      .eq('match.competition_id', NBA_COMPETITION_ID)
      .not('was_correct', 'is', null),
    // Fecha ancla del calendario: el próximo partido, o el último jugado
    supabase
      .from('matches')
      .select('kickoff_time')
      .eq('competition_id', NBA_COMPETITION_ID)
      .gte('kickoff_time', new Date().toISOString())
      .order('kickoff_time', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  let anchor = (anchorRow as any)?.kickoff_time
  if (!anchor) {
    const { data: last } = await supabase
      .from('matches')
      .select('kickoff_time')
      .eq('competition_id', NBA_COMPETITION_ID)
      .order('kickoff_time', { ascending: false })
      .limit(1)
      .maybeSingle()
    anchor = (last as any)?.kickoff_time
  }
  const initialDate = anchor
    ? new Date(anchor).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  const dataReady = (teams?.length ?? 0) > 0 && (matches?.length ?? 0) > 0

  // Standings por conferencia
  const records = dataReady ? computeNbaRecords(matches as any[]) : new Map()
  const rows: NbaStandingView[] = ((teams ?? []) as any[]).map((t) => {
    const r = records.get(t.id)
    return {
      team_id: t.id,
      name: t.name,
      code: t.code,
      logo_url: t.logo_url,
      conference: t.conference ?? '',
      won: r?.won ?? 0,
      lost: r?.lost ?? 0,
      win_pct: r?.win_pct ?? 0,
      points_for: r?.points_for ?? 0,
      points_against: r?.points_against ?? 0,
      form: r?.form ?? [],
    }
  })
  const sortFn = (a: NbaStandingView, b: NbaStandingView) =>
    b.win_pct - a.win_pct || (b.won - b.lost) - (a.won - a.lost)
  const east = rows.filter((r) => r.conference === 'Este').sort(sortFn)
  const west = rows.filter((r) => r.conference === 'Oeste').sort(sortFn)

  // Precisión del motor
  const resolved = preds ?? []
  const correct = resolved.filter((p: any) => p.was_correct === true).length
  const accuracy = resolved.length ? ((correct / resolved.length) * 100).toFixed(1) : null

  const played = (matches ?? []).filter((m: any) => m.status === 'finished').length

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Baloncesto · Estados Unidos
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">NBA</h1>
        <p className="text-sm text-zinc-400">
          Temporada 2024-25 — clasificación por conferencia y predicciones del
          motor de baloncesto (ELO sin empates, calibrado con backtest honesto).
        </p>
      </div>

      {!dataReady ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-10 text-center">
          <p className="text-sm font-medium text-zinc-300">Datos de la NBA en preparación</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
            La estructura ya está lista; el calendario y los equipos se cargan
            desde API-Basketball. Vuelve en unos minutos.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Precisión del motor</p>
              <p className="mt-1 text-xl font-bold text-emerald-400 mono">{accuracy ? `${accuracy}%` : '—'}</p>
              <p className="text-xs text-zinc-500">{correct}/{resolved.length} · azar 50%</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Partidos jugados</p>
              <p className="mt-1 text-xl font-bold text-white mono">{played}</p>
              <p className="text-xs text-zinc-500">temporada regular</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Equipos</p>
              <p className="mt-1 text-xl font-bold text-white mono">{rows.length}</p>
              <p className="text-xs text-zinc-500">2 conferencias · 6 divisiones</p>
            </div>
          </div>

          {/* Secciones del dominio NBA */}
          <section aria-label="Secciones NBA" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { href: '/nba/rankings', title: 'Rankings', desc: 'Las 30 franquicias por ELO del modelo' },
              { href: '/nba/estadisticas', title: 'Estadísticas', desc: 'Anotación real de la liga, por cuarto' },
              { href: '/nba/tendencias', title: 'Tendencias', desc: 'Rachas, fortines y clutch' },
              { href: '/nba/predicciones', title: 'Predicciones', desc: 'Precisión y calibración del modelo' },
            ].map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="group rounded-xl border border-zinc-800 bg-zinc-900 p-3.5 transition-colors hover:border-zinc-700"
              >
                <p className="text-sm font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">{s.title}</p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500">{s.desc}</p>
              </Link>
            ))}
          </section>

          <ConferenceStandings east={east} west={west} />

          {/* Calendario navegable: cualquier partido abre su detalle */}
          <NbaSchedule initialDate={initialDate} />
        </>
      )}

      <p className="text-[11px] text-zinc-600">
        Fuente: API-Basketball (api-sports.io) · Modelo nba-1.0: ELO con ventaja
        de local, sin empates. Métricas honestas, backtest sin mirar el futuro.
      </p>
    </div>
  )
}
