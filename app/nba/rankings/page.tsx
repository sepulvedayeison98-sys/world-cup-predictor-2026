import type { Metadata } from 'next'
import Link from 'next/link'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { computeNbaSeasonStats } from '@/lib/nba/stats'
import { fetchNbaSeasonMatches, fetchNbaTeams } from '@/services/nba.service'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Rankings NBA | Veredicto',
  description: 'Ranking de las 30 franquicias por ELO del modelo, ofensiva, defensa y diferencial.',
}

export const revalidate = 300

/** Ranking global de la liga — ELO del modelo + métricas reales de anotación. */
export default async function NbaRankingsPage() {
  const supabase = createStaticSupabaseClient()
  const [teams, matches] = await Promise.all([
    fetchNbaTeams(supabase),
    fetchNbaSeasonMatches(supabase),
  ])
  const stats = computeNbaSeasonStats(matches)

  const rows = teams
    .map((t) => ({ team: t, s: stats.get(t.id) }))
    .filter((r) => r.s)
    .sort((a, b) => (b.team.elo_rating ?? 0) - (a.team.elo_rating ?? 0))

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href="/nba" className="text-xs font-semibold uppercase tracking-widest text-emerald-500 hover:text-emerald-400">← NBA</Link>
        <h1 className="mt-1 text-2xl font-bold text-white">Rankings</h1>
        <p className="text-sm text-zinc-400">
          Las 30 franquicias ordenadas por el ELO del modelo nba-1.0, con su
          anotación real de temporada. El ELO se calibró partido a partido
          con backtest walk-forward — no es un ranking editorial.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="sticky left-0 z-10 bg-zinc-900 px-3 py-2 text-left">#</th>
                <th className="sticky left-8 z-10 bg-zinc-900 px-3 py-2 text-left">Equipo</th>
                <th className="px-2 py-2 text-center">ELO</th>
                <th className="px-2 py-2 text-center">W-L</th>
                <th className="px-2 py-2 text-center hidden sm:table-cell">PPP</th>
                <th className="px-2 py-2 text-center hidden sm:table-cell">PPP perm.</th>
                <th className="px-2 py-2 text-center">Dif</th>
                <th className="px-2 py-2 text-center hidden md:table-cell">Racha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ team, s }, i) => (
                <tr key={team.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40 transition-colors">
                  <td className="sticky left-0 z-10 bg-zinc-900 px-3 py-2 text-zinc-400 tabular-nums">{i + 1}</td>
                  <td className="sticky left-8 z-10 bg-zinc-900 px-3 py-2">
                    <Link href={`/nba/equipos/${team.id}`} className="flex items-center gap-2 min-w-0 hover:text-emerald-400">
                      {team.logo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={team.logo_url} alt="" className="h-5 w-5 shrink-0 object-contain" loading="lazy" />
                      )}
                      <span className="truncate font-medium text-zinc-200">{team.name}</span>
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-center font-bold text-emerald-400 mono">{Math.round(team.elo_rating ?? 0)}</td>
                  <td className="px-2 py-2 text-center text-zinc-300 mono">{s!.won}-{s!.lost}</td>
                  <td className="px-2 py-2 text-center text-zinc-400 mono hidden sm:table-cell">{s!.ppg.toFixed(1)}</td>
                  <td className="px-2 py-2 text-center text-zinc-400 mono hidden sm:table-cell">{s!.papg.toFixed(1)}</td>
                  <td className={cn('px-2 py-2 text-center font-bold mono', s!.margin > 0 ? 'text-emerald-400' : s!.margin < 0 ? 'text-red-400' : 'text-zinc-300')}>
                    {s!.margin > 0 ? '+' : ''}{s!.margin.toFixed(1)}
                  </td>
                  <td className={cn('px-2 py-2 text-center mono hidden md:table-cell', s!.streak > 0 ? 'text-emerald-400' : s!.streak < 0 ? 'text-red-400' : 'text-zinc-500')}>
                    {s!.streak === 0 ? '—' : s!.streak > 0 ? `W${s!.streak}` : `L${-s!.streak}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-zinc-800 px-4 py-2.5 text-[11px] text-zinc-600">
          PPP = puntos por partido (anotados / permitidos). Dif = diferencial
          medio. Temporada 2024-25 completa (regular + playoffs), datos reales.
        </p>
      </div>
    </div>
  )
}
