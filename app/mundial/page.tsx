import type { Metadata } from 'next'
import Link from 'next/link'
import { Trophy, GitBranch, Users, Crosshair, FlaskConical, Calendar, Grid3X3 } from 'lucide-react'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { COMPETITION_ID, PHASE_LABELS } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Mundial 2026 | Veredicto',
}

export const revalidate = 120

/**
 * Hub del Mundial 2026 (auditoría T2): el torneo deja de ser el universo
 * y se convierte en la primera competición de la casa — con su propio
 * hogar, sus secciones y su estado vital.
 */
export default async function MundialHubPage() {
  const supabase = createStaticSupabaseClient()

  const [{ data: preds }, { count: played }, { data: nextMatches }, { data: simRun }] = await Promise.all([
    supabase
      .from('predictions')
      .select('was_correct, match:matches!inner(competition_id)')
      .eq('match.competition_id', COMPETITION_ID)
      .not('was_correct', 'is', null),
    supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', COMPETITION_ID)
      .eq('status', 'finished'),
    supabase
      .from('matches')
      .select(`
        id, phase, kickoff_time, status,
        home_team:teams!matches_home_team_id_fkey(name, code),
        away_team:teams!matches_away_team_id_fkey(name, code),
        predictions(home_win_probability, draw_probability, away_win_probability)
      `)
      .eq('competition_id', COMPETITION_ID)
      .in('status', ['scheduled', 'live'])
      .order('kickoff_time', { ascending: true })
      .limit(4),
    supabase
      .from('tournament_simulations')
      .select('team_id, winner_prob, simulation_run_id, created_at')
      .eq('competition_id', COMPETITION_ID)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const resolved = preds ?? []
  const correct = resolved.filter((p: any) => p.was_correct === true).length
  const accuracy = resolved.length ? ((correct / resolved.length) * 100).toFixed(1) : null

  // Favorito al título según la última corrida de simulación
  let favorite: { name: string; prob: number } | null = null
  const runId = (simRun?.[0] as any)?.simulation_run_id
  if (runId) {
    const { data: top } = await supabase
      .from('tournament_simulations')
      .select('winner_prob, team:teams(name)')
      .eq('competition_id', COMPETITION_ID)
      .eq('simulation_run_id', runId)
      .order('winner_prob', { ascending: false })
      .limit(1)
    const t = top?.[0] as any
    if (t?.team) favorite = { name: t.team.name, prob: Number(t.winner_prob) }
  }

  const currentPhase = (nextMatches?.[0] as any)?.phase as string | undefined
  const phaseLabel = (currentPhase && PHASE_LABELS[currentPhase]) ?? 'Torneo'

  const kpis = [
    { label: 'Precisión del motor', value: accuracy ? `${accuracy}%` : '—', sub: `${correct}/${resolved.length} · azar 33%` },
    { label: 'Partidos jugados', value: `${played ?? 0}/100`, sub: 'de todo el torneo' },
    { label: 'Favorito al título', value: favorite?.name ?? '—', sub: favorite ? `${(favorite.prob).toFixed(1)}% en simulaciones` : 'sin simulaciones' },
  ]

  const sections = [
    { href: '/bracket', label: 'Eliminatorias', desc: 'Cuadro del torneo con probabilidades por llave', icon: GitBranch },
    { href: '/champion', label: 'Campeón', desc: 'Probabilidades de título por selección', icon: Trophy },
    { href: '/groups', label: 'Grupos', desc: 'Clasificación final de la fase de grupos', icon: Grid3X3 },
    { href: '/scorers', label: 'Goleadores', desc: 'Tabla y proyección de anotadores', icon: Crosshair },
    { href: '/players', label: 'Jugadores', desc: 'Planteles y estado físico', icon: Users },
    { href: '/simulation', label: 'Simulador', desc: 'Escenarios what-if: lesiones, clima, tácticas', icon: FlaskConical },
    { href: '/matches', label: 'Partidos', desc: 'Agenda completa con predicciones', icon: Calendar },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Fútbol · Selecciones · {phaseLabel}
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Mundial 2026</h1>
        <p className="text-sm text-zinc-400">
          México · Estados Unidos · Canadá — la final se juega el 19 de julio.
        </p>
      </div>

      {/* Estado vital del torneo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{k.label}</p>
            <p className="mt-1 truncate text-xl font-bold text-white mono">{k.value}</p>
            <p className="text-xs text-zinc-500">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Próximos partidos del torneo */}
      {(nextMatches?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-bold text-white">Próximos partidos</h2>
          </div>
          <ul className="divide-y divide-zinc-800/60">
            {(nextMatches as any[]).map((m) => {
              const p = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
              return (
                <li key={m.id}>
                  <Link href={`/matches/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-200">
                        {m.home_team?.name} <span className="text-zinc-500">vs</span> {m.away_team?.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {PHASE_LABELS[m.phase] ?? m.phase} · {new Date(m.kickoff_time).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {p && (
                      <span className="shrink-0 text-xs mono text-zinc-400">
                        {Math.round(p.home_win_probability * 100)}·{Math.round(p.draw_probability * 100)}·{Math.round(p.away_win_probability * 100)}%
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Secciones del torneo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map(({ href, label, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Icon className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{label}</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
