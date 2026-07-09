import type { Metadata } from 'next'
import Link from 'next/link'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { computeNbaSeasonStats } from '@/lib/nba/stats'
import { fetchNbaSeasonMatches, fetchNbaTeams } from '@/services/nba.service'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Tendencias NBA | Veredicto',
  description: 'Rachas, forma reciente y especialistas: local, visitante, partidos cerrados y prórrogas.',
}

export const revalidate = 300

/** Tendencias de la liga — rachas y especialistas, todo de partidos reales. */
export default async function NbaTendenciasPage() {
  const supabase = createStaticSupabaseClient()
  const [teams, matches] = await Promise.all([
    fetchNbaTeams(supabase),
    fetchNbaSeasonMatches(supabase),
  ])
  const stats = computeNbaSeasonStats(matches)

  const rows = teams
    .map((t) => ({ team: t, s: stats.get(t.id) }))
    .filter((r) => r.s)

  const hotStreaks = [...rows].sort((a, b) => b.s!.streak - a.s!.streak).slice(0, 5)
  const coldStreaks = [...rows].sort((a, b) => a.s!.streak - b.s!.streak).slice(0, 5)
  const bestLast10 = [...rows].sort((a, b) => b.s!.last10Won - a.s!.last10Won).slice(0, 5)
  const bestHome = [...rows]
    .sort((a, b) => (b.s!.home_won / Math.max(1, b.s!.home_won + b.s!.home_lost)) - (a.s!.home_won / Math.max(1, a.s!.home_won + a.s!.home_lost)))
    .slice(0, 5)
  const bestAway = [...rows]
    .sort((a, b) => (b.s!.away_won / Math.max(1, b.s!.away_won + b.s!.away_lost)) - (a.s!.away_won / Math.max(1, a.s!.away_won + a.s!.away_lost)))
    .slice(0, 5)
  const bestClose = [...rows]
    .filter((r) => r.s!.closePlayed >= 5)
    .sort((a, b) => (b.s!.closeWon / b.s!.closePlayed) - (a.s!.closeWon / a.s!.closePlayed))
    .slice(0, 5)

  const TrendCard = ({ title, desc, items }: {
    title: string
    desc: string
    items: { team: (typeof rows)[number]['team']; value: string; positive?: boolean }[]
  }) => (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <p className="text-[11px] text-zinc-500">{desc}</p>
      </div>
      <ul className="divide-y divide-zinc-800/60">
        {items.map(({ team, value, positive }, i) => (
          <li key={team.id}>
            <Link href={`/nba/equipos/${team.id}`} className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800/40 transition-colors">
              <span className="flex items-center gap-2 text-sm">
                <span className="w-4 text-zinc-500 tabular-nums">{i + 1}</span>
                {team.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={team.logo_url} alt="" className="h-5 w-5 shrink-0 object-contain" loading="lazy" />
                )}
                <span className="font-medium text-zinc-200">{team.name}</span>
              </span>
              <span className={cn('text-sm font-bold mono', positive === false ? 'text-red-400' : 'text-emerald-400')}>{value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )

  const pct = (w: number, l: number) => {
    const t = w + l
    return t ? ((w / t) * 100).toFixed(0) + '%' : '—'
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href="/nba" className="text-xs font-semibold uppercase tracking-widest text-emerald-500 hover:text-emerald-400">← NBA</Link>
        <h1 className="mt-1 text-2xl font-bold text-white">Tendencias</h1>
        <p className="text-sm text-zinc-400">
          Rachas y especialistas al cierre de la temporada 2024-25 — cada
          tendencia sale del historial real de partidos, no de percepción.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendCard
          title="Rachas positivas"
          desc="Victorias consecutivas al cierre de temporada."
          items={hotStreaks.map(({ team, s }) => ({ team, value: s!.streak > 0 ? `W${s!.streak}` : '—' }))}
        />
        <TrendCard
          title="Rachas negativas"
          desc="Derrotas consecutivas al cierre de temporada."
          items={coldStreaks.map(({ team, s }) => ({ team, value: s!.streak < 0 ? `L${-s!.streak}` : '—', positive: false }))}
        />
        <TrendCard
          title="Mejor forma (últimos 10)"
          desc="Récord en los últimos 10 partidos jugados."
          items={bestLast10.map(({ team, s }) => ({ team, value: `${s!.last10Won}-${s!.last10Lost}` }))}
        />
        <TrendCard
          title="Fortines (mejor % en casa)"
          desc="Porcentaje de victorias como local."
          items={bestHome.map(({ team, s }) => ({ team, value: `${pct(s!.home_won, s!.home_lost)} (${s!.home_won}-${s!.home_lost})` }))}
        />
        <TrendCard
          title="Viajeros (mejor % fuera)"
          desc="Porcentaje de victorias como visitante."
          items={bestAway.map(({ team, s }) => ({ team, value: `${pct(s!.away_won, s!.away_lost)} (${s!.away_won}-${s!.away_lost})` }))}
        />
        <TrendCard
          title="Cerebros del clutch (cerrados ≤5)"
          desc="Récord en partidos definidos por 5 puntos o menos (mín. 5 jugados)."
          items={bestClose.map(({ team, s }) => ({ team, value: `${pct(s!.closeWon, s!.closePlayed - s!.closeWon)} (${s!.closeWon}-${s!.closePlayed - s!.closeWon})` }))}
        />
      </div>

      <p className="text-[11px] text-zinc-600">
        Las rachas de cierre quedan congeladas hasta que arranque la
        temporada 2025-26 — entonces estas tablas vuelven a moverse a diario.
      </p>
    </div>
  )
}
