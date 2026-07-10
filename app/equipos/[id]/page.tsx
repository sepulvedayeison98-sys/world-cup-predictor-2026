import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { computeFootballTeamStats, type FbMatch } from '@/lib/footballTeamStats'
import { competitionHref, sportOfCompetition } from '@/lib/sports'
import { COMPETITIONS_NAV } from '@/lib/sports'
import { Flag } from '@/components/ui/Flag'
import { cn } from '@/lib/utils'

export const revalidate = 300
// generateStaticParams (vacío) habilita el caché ISR on-demand en Next 15.
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = createStaticSupabaseClient()
  const { data } = await supabase.from('teams').select('name').eq('id', id).maybeSingle()
  const name = (data as any)?.name
  return name
    ? { title: `${name} — perfil y forma | Veredicto`, description: `Récord, forma reciente, splits local/visitante y últimos partidos de ${name}, con el ELO del modelo.` }
    : { title: 'Equipo' }
}

/**
 * Perfil universal de equipo de fútbol (playbook Sofascore + paridad con NBA).
 * Sirve a selecciones del Mundial y clubes de liga: un equipo juega en una
 * sola competición, así que todo se filtra por ella (regla de oro). Solo
 * métricas reales de partidos jugados.
 */
export default async function FootballTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createStaticSupabaseClient()

  const { data: team } = await supabase
    .from('teams')
    .select('id, name, short_name, code, logo_url, elo_rating, fifa_ranking, competition_id')
    .eq('id', id)
    .maybeSingle()
  if (!team) notFound()
  const t = team as any

  // Solo equipos de deportes de fútbol (NBA tiene su propia página)
  if (sportOfCompetition(t.competition_id) !== 'futbol') notFound()

  const { data: matchesRaw } = await supabase
    .from('matches')
    .select(`
      id, home_team_id, away_team_id, home_score, away_score, status, kickoff_time, phase, round,
      home_team:teams!matches_home_team_id_fkey(short_name, code),
      away_team:teams!matches_away_team_id_fkey(short_name, code)
    `)
    .eq('competition_id', t.competition_id)
    .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
    .order('kickoff_time', { ascending: false })
    .limit(500)

  const matches = (matchesRaw ?? []) as any[]
  const stats = computeFootballTeamStats(matches as FbMatch[], id)

  const compName = COMPETITIONS_NAV.find((c) => c.id === t.competition_id)?.name ?? 'Fútbol'
  const backHref = competitionHref(t.competition_id)

  const recent = matches
    .filter((m) => m.status === 'finished' && m.home_score != null)
    .slice(0, 10)

  const streakLabel = stats.streak === 0 ? '—'
    : stats.streak > 0 ? `${stats.streak} ${stats.streak === 1 ? 'victoria' : 'victorias'}`
    : `${-stats.streak} ${-stats.streak === 1 ? 'derrota' : 'derrotas'}`

  const FormPill = ({ r }: { r: 'W' | 'D' | 'L' }) => (
    <span className={cn(
      'inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold',
      r === 'W' && 'bg-emerald-500/20 text-emerald-400',
      r === 'D' && 'bg-amber-500/20 text-amber-400',
      r === 'L' && 'bg-red-500/20 text-red-400',
    )}>{r}</span>
  )

  const kpis = [
    { label: 'Récord (G-E-P)', value: `${stats.won}-${stats.drawn}-${stats.lost}`, color: 'text-emerald-400' },
    { label: 'Puntos por partido', value: stats.ppg.toFixed(2), color: 'text-white' },
    { label: 'Goles a favor / p', value: stats.gfpg.toFixed(1), color: 'text-white' },
    { label: 'Goles en contra / p', value: stats.gapg.toFixed(1), color: 'text-white' },
    { label: 'Diferencia', value: `${stats.goal_diff > 0 ? '+' : ''}${stats.goal_diff}`, color: stats.goal_diff > 0 ? 'text-emerald-400' : stats.goal_diff < 0 ? 'text-red-400' : 'text-zinc-300' },
    { label: 'ELO del modelo', value: String(t.elo_rating), color: 'text-white' },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-500 hover:text-emerald-400">
          <ArrowLeft className="h-3.5 w-3.5" /> {compName}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          {t.logo_url
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={t.logo_url} alt="" className="h-9 w-9 object-contain" />
            : <Flag code={t.code} className="h-7 w-10 rounded" />}
          <h1 className="text-2xl font-bold text-white">{t.name}</h1>
          <span className="rounded bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs font-bold text-zinc-400">{t.code}</span>
        </div>
        {t.fifa_ranking > 0 && (
          <p className="mt-1 text-xs text-zinc-500">Ranking FIFA #{t.fifa_ranking}</p>
        )}
      </div>

      {stats.played === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="text-sm text-zinc-400">Sin partidos jugados registrados para este equipo.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {kpis.map((k) => (
              <div key={k.label} className="kpi-card">
                <p className="text-[11px] text-zinc-500">{k.label}</p>
                <p className={cn('text-2xl font-bold mono', k.color)}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Splits */}
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-bold text-white">Local / visitante</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">En casa</span>
                  <span className="mono text-zinc-200">{stats.homeW}-{stats.homeD}-{stats.homeL}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Fuera</span>
                  <span className="mono text-zinc-200">{stats.awayW}-{stats.awayD}-{stats.awayL}</span>
                </div>
                <p className="border-t border-zinc-800 pt-2 text-[11px] text-zinc-600">
                  {stats.played} partidos jugados · {stats.points} puntos · {(stats.won / stats.played * 100).toFixed(0)}% de victorias
                </p>
              </div>
            </div>

            {/* Forma */}
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-bold text-white">Forma</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Últimos 5</span>
                  <span className="flex gap-1">
                    {stats.last5.length ? stats.last5.map((r, i) => <FormPill key={i} r={r} />) : <span className="text-zinc-600">—</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Últimos 10</span>
                  <span className="mono text-zinc-200">{stats.last10W}-{stats.last10D}-{stats.last10L}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Racha actual</span>
                  <span className={cn('font-semibold', stats.streak > 0 ? 'text-emerald-400' : stats.streak < 0 ? 'text-red-400' : 'text-zinc-500')}>{streakLabel}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Últimos partidos */}
          <div className="card overflow-hidden">
            <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
              <h2 className="text-sm font-bold text-white">Últimos partidos</h2>
            </div>
            <ul className="divide-y divide-zinc-800/60">
              {recent.map((m) => {
                const isHome = m.home_team_id === id
                const gf = isHome ? m.home_score : m.away_score
                const ga = isHome ? m.away_score : m.home_score
                const opp = isHome ? m.away_team : m.home_team
                const res = gf > ga ? 'W' : gf < ga ? 'L' : 'D'
                return (
                  <li key={m.id}>
                    <Link href={`/matches/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-zinc-800/40 transition-colors">
                      <span className="flex items-center gap-2 text-xs">
                        <FormPill r={res as 'W' | 'D' | 'L'} />
                        <span className="text-zinc-500">{isHome ? 'vs' : '@'}</span>
                        <Flag code={opp?.code} />
                        <span className="text-zinc-300">{opp?.short_name ?? opp?.code}</span>
                      </span>
                      <span className="mono text-xs font-bold text-zinc-200">{gf}–{ga}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
