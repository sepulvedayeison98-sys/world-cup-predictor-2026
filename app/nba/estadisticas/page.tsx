import type { Metadata } from 'next'
import Link from 'next/link'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { computeNbaLeagueStats, computeNbaSeasonStats } from '@/lib/nba/stats'
import { fetchNbaSeasonMatches, fetchNbaTeams } from '@/services/nba.service'

export const metadata: Metadata = {
  title: 'Estadísticas NBA | Veredicto',
  description: 'Estadísticas reales de la liga: anotación, ventaja de local, prórrogas y perfil por cuarto.',
}

export const revalidate = 300

/** Estadísticas de liga — todo calculado de partidos reales de la BD. */
export default async function NbaEstadisticasPage() {
  const supabase = createStaticSupabaseClient()
  const [teams, matches] = await Promise.all([
    fetchNbaTeams(supabase),
    fetchNbaSeasonMatches(supabase),
  ])
  const league = computeNbaLeagueStats(matches)
  const stats = computeNbaSeasonStats(matches)
  const teamById = new Map(teams.map((t) => [t.id, t]))

  const ranked = teams
    .map((t) => ({ team: t, s: stats.get(t.id) }))
    .filter((r) => r.s)
  const topOffense = [...ranked].sort((a, b) => b.s!.ppg - a.s!.ppg).slice(0, 5)
  const topDefense = [...ranked].sort((a, b) => a.s!.papg - b.s!.papg).slice(0, 5)

  const highMatch = league.highestScoring
    ? matches.find((m) => m.id === league.highestScoring!.match_id)
    : null

  const TopTable = ({ title, rows, value }: {
    title: string
    rows: typeof topOffense
    value: (s: NonNullable<(typeof topOffense)[number]['s']>) => string
  }) => (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      <ul className="divide-y divide-zinc-800/60">
        {rows.map(({ team, s }, i) => (
          <li key={team.id}>
            <Link href={`/nba/equipos/${team.id}`} className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800/40 transition-colors">
              <span className="flex items-center gap-2 text-sm">
                <span className="w-4 text-zinc-500 tabular-nums">{i + 1}</span>
                <span className="font-medium text-zinc-200">{team.name}</span>
              </span>
              <span className="text-sm font-bold text-emerald-400 mono">{value(s!)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href="/nba" className="text-xs font-semibold uppercase tracking-widest text-emerald-500 hover:text-emerald-400">← NBA</Link>
        <h1 className="mt-1 text-2xl font-bold text-white">Estadísticas de la liga</h1>
        <p className="text-sm text-zinc-400">
          Temporada 2024-25 (regular + playoffs). Solo métricas medibles con
          los datos reales cargados: marcadores finales y puntos por cuarto.
        </p>
      </div>

      {/* KPIs de liga */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Partidos jugados', value: String(league.games) },
          { label: 'Puntos por partido (total)', value: league.avgTotalPoints.toFixed(1) },
          { label: 'Victorias de local', value: (league.homeWinPct * 100).toFixed(1) + '%' },
          { label: 'Partidos con prórroga', value: String(league.otGames) },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{k.label}</p>
            <p className="mt-1 text-xl font-bold text-white mono">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopTable title="Mejores ofensivas (puntos por partido)" rows={topOffense} value={(s) => s.ppg.toFixed(1)} />
        <TopTable title="Mejores defensas (puntos permitidos)" rows={topDefense} value={(s) => s.papg.toFixed(1)} />
      </div>

      {/* Perfil por cuarto de la liga */}
      {league.quarterAvgTotal.length === 4 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-bold text-white">Anotación por cuarto (promedio liga)</h2>
            <p className="text-[11px] text-zinc-500">Puntos totales (ambos equipos) por cuarto — prórrogas fuera del perfil.</p>
          </div>
          <div className="grid grid-cols-4 divide-x divide-zinc-800/60">
            {league.quarterAvgTotal.map((v, i) => (
              <div key={i} className="px-4 py-3 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Q{i + 1}</p>
                <p className="mt-1 text-lg font-bold text-white mono">{v.toFixed(1)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {highMatch && (
        <Link
          href={`/matches/${highMatch.id}`}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Partido con más puntos de la temporada</p>
          <p className="mt-1 text-sm font-bold text-white">
            {teamById.get(highMatch.home_team_id)?.name} {highMatch.home_score}-{highMatch.away_score} {teamById.get(highMatch.away_team_id)?.name}
            <span className="ml-2 text-emerald-400 mono">{league.highestScoring!.total} pts</span>
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Ver el detalle del partido →</p>
        </Link>
      )}

      <p className="text-[11px] text-zinc-600">
        Nota de honestidad: métricas de posesión (Offensive/Defensive Rating,
        Pace, eFG%, TS%) requieren datos de tiros y rebotes que la fuente
        actual no provee — no se estiman ni se fabrican. Están en el roadmap
        junto a las estadísticas de jugadores.
      </p>
    </div>
  )
}
