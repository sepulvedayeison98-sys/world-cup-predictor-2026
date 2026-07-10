import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { NBA_COMPETITION_ID } from '@/lib/nba/constants'
import { computeNbaSeasonStats } from '@/lib/nba/stats'
import { fetchNbaSeasonMatches, fetchNbaTeams } from '@/services/nba.service'
import { cn } from '@/lib/utils'

export const revalidate = 300
// generateStaticParams (vacío) habilita el caché ISR on-demand en Next 15:
// sin él, un segmento [id] se sirve dinámico (no-store) en cada visita.
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = createStaticSupabaseClient()
  const { data } = await supabase.from('teams').select('name').eq('id', id)
    .eq('competition_id', NBA_COMPETITION_ID).maybeSingle()
  return { title: `${(data as any)?.name ?? 'Equipo'} | NBA | Veredicto` }
}

/**
 * Perfil de franquicia NBA — solo métricas reales de la temporada
 * (marcadores y cuartos de la BD). Sin datos de posesión no se publican
 * ORtg/Pace/eFG%: mejor una métrica menos que una inventada.
 */
export default async function NbaTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createStaticSupabaseClient()

  const [teams, matches] = await Promise.all([
    fetchNbaTeams(supabase),
    fetchNbaSeasonMatches(supabase),
  ])
  const team = teams.find((t) => t.id === id)
  if (!team) notFound()

  const stats = computeNbaSeasonStats(matches).get(id)
  const teamById = new Map(teams.map((t) => [t.id, t]))

  const recent = matches
    .filter((m) => m.status === 'finished' && (m.home_team_id === id || m.away_team_id === id))
    .slice(-10)
    .reverse()

  const streakLabel = !stats || stats.streak === 0
    ? '—'
    : stats.streak > 0 ? `${stats.streak} victorias` : `${-stats.streak} derrotas`

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href="/nba" className="text-xs font-semibold uppercase tracking-widest text-emerald-500 hover:text-emerald-400">
          ← NBA · {team.conference ? `Conferencia ${team.conference}` : 'Baloncesto'}
          {team.division ? ` · División ${team.division}` : ''}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          {team.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo_url} alt="" className="h-10 w-10 object-contain" />
          )}
          <h1 className="text-2xl font-bold text-white">{team.name}</h1>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-bold text-zinc-300 mono">{team.code}</span>
        </div>
      </div>

      {!stats ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-10 text-center">
          <p className="text-sm text-zinc-400">Aún no hay partidos jugados de este equipo en la base.</p>
        </div>
      ) : (
        <>
          {/* KPIs de temporada */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Récord', value: `${stats.won}-${stats.lost}`, accent: true },
              { label: '% victorias', value: (stats.win_pct * 100).toFixed(1) + '%' },
              { label: 'Puntos por partido', value: stats.ppg.toFixed(1) },
              { label: 'Puntos permitidos', value: stats.papg.toFixed(1) },
              { label: 'Diferencial', value: (stats.margin > 0 ? '+' : '') + stats.margin.toFixed(1) },
              { label: 'ELO del modelo', value: team.elo_rating != null ? String(Math.round(team.elo_rating)) : '—' },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{k.label}</p>
                <p className={cn('mt-1 text-xl font-bold mono', k.accent ? 'text-emerald-400' : 'text-white')}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Splits y rachas */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="text-sm font-bold text-white">Local / visitante</h2>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-400">En casa</span><span className="font-bold text-zinc-200 mono">{stats.home_won}-{stats.home_lost}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Fuera</span><span className="font-bold text-zinc-200 mono">{stats.away_won}-{stats.away_lost}</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="text-sm font-bold text-white">Forma</h2>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Últimos 5</span>
                  <span className="flex gap-1">
                    {stats.last5.map((r, i) => (
                      <span key={i} className={cn('flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold', r === 'W' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>{r}</span>
                    ))}
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-zinc-400">Últimos 10</span><span className="font-bold text-zinc-200 mono">{stats.last10Won}-{stats.last10Lost}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Racha actual</span><span className={cn('font-bold mono', stats.streak > 0 ? 'text-emerald-400' : stats.streak < 0 ? 'text-red-400' : 'text-zinc-300')}>{streakLabel}</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="text-sm font-bold text-white">Situaciones especiales</h2>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-400">Con prórroga</span><span className="font-bold text-zinc-200 mono">{stats.otWon}-{stats.otPlayed - stats.otWon}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Cerrados (≤5 pts)</span><span className="font-bold text-zinc-200 mono">{stats.closeWon}-{stats.closePlayed - stats.closeWon}</span></div>
              </div>
            </div>
          </div>

          {/* Perfil por cuarto */}
          {stats.quarterAvgFor.length === 4 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="border-b border-zinc-800 px-4 py-3">
                <h2 className="text-sm font-bold text-white">Perfil por cuarto</h2>
                <p className="text-[11px] text-zinc-500">Promedio de puntos anotados y permitidos en cada cuarto (prórrogas fuera del perfil).</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-2 text-left"></th>
                      {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => <th key={q} className="px-3 py-2 text-center">{q}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-zinc-800/60">
                      <td className="px-4 py-2 text-zinc-400">Anotados</td>
                      {stats.quarterAvgFor.map((v, i) => (
                        <td key={i} className={cn('px-3 py-2 text-center mono', v >= stats.quarterAvgAgainst[i] ? 'font-bold text-emerald-400' : 'text-zinc-300')}>{v.toFixed(1)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-zinc-400">Permitidos</td>
                      {stats.quarterAvgAgainst.map((v, i) => <td key={i} className="px-3 py-2 text-center text-zinc-300 mono">{v.toFixed(1)}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Últimos partidos — cada uno abre su detalle completo */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-bold text-white">Últimos partidos</h2>
            </div>
            <ul className="divide-y divide-zinc-800/60">
              {recent.map((m) => {
                const isHome = m.home_team_id === id
                const rival = teamById.get(isHome ? m.away_team_id : m.home_team_id)
                const own = isHome ? m.home_score : m.away_score
                const opp = isHome ? m.away_score : m.home_score
                const won = (own ?? 0) > (opp ?? 0)
                return (
                  <li key={m.id}>
                    <Link href={`/matches/${m.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/40 transition-colors">
                      <span className="flex items-center gap-2 text-sm text-zinc-300">
                        <span className={cn('flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold', won ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>{won ? 'W' : 'L'}</span>
                        <span className="text-zinc-500">{isHome ? 'vs' : '@'}</span>
                        <span className="font-medium">{rival?.name ?? '—'}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-sm font-bold text-white mono">{own}-{opp}</span>
                        <span className="text-[11px] text-zinc-500">{new Date(m.kickoff_time).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })}</span>
                      </span>
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
