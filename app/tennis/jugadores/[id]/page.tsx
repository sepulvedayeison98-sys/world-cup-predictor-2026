import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchTennisPlayer, fetchRankedPlayerIds } from '@/services/tennis/queries'
import { ResultsList } from '@/components/tennis/ResultsList'
import { SurfaceBadge, StatCard, countryFlag, handLabel } from '@/components/tennis/ui'
import { SURFACE_LABELS, type Surface } from '@/lib/tennis/constants'
import { cn } from '@/lib/utils'

export const revalidate = 600

// Prerenderiza los perfiles de los jugadores rankeados; el resto es on-demand.
export async function generateStaticParams() {
  const ids = await fetchRankedPlayerIds('ATP', 50)
  return ids.map((id) => ({ id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const profile = await fetchTennisPlayer(id)
  if (!profile) return { title: 'Jugador | Veredicto' }
  return {
    title: `${profile.player.name} | Tenis · Veredicto`,
    description: `Perfil de ${profile.player.name}: Win%, Hold%, Break%, aces y forma reciente — todo derivado de partidos reales.`,
  }
}

const pct = (v: number | null) => (v != null ? `${(v * 100).toFixed(1)}%` : '—')

export default async function TennisPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await fetchTennisPlayer(id)
  if (!profile) notFound()
  const { player, stats, rankPosition, rankPoints, recent } = profile

  const surfaces = (Object.keys(SURFACE_LABELS) as Surface[])
    .map((s) => ({ s, e: stats.bySurface[s] }))
    .filter((x) => x.e && x.e.played > 0)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href="/tennis/ranking" className="text-xs font-semibold uppercase tracking-widest text-lime-500 hover:text-lime-400">← Ranking ATP</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-white">
            <span className="mr-2" aria-hidden>{countryFlag(player.country_code)}</span>
            {player.name}
          </h1>
          {rankPosition != null && (
            <span className="rounded-md border border-lime-500/30 bg-lime-500/10 px-2 py-0.5 text-xs font-semibold text-lime-300">
              ATP #{rankPosition}{rankPoints != null ? ` · ${rankPoints.toLocaleString('es-ES')} pts` : ''}
            </span>
          )}
          <Link href={`/tennis/h2h?p1=${player.id}`} className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-300 hover:border-lime-500/40 hover:text-lime-300">
            Cara a cara →
          </Link>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          {[player.country_code, handLabel(player.plays_hand), player.height_cm ? `${player.height_cm} cm` : null]
            .filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Métricas medidas — si la fuente no da saque/resto, se declara "—" */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Win %" value={pct(stats.winRate)} hint={`${stats.won}-${stats.played - stats.won} (${stats.played} partidos)`} accent />
        <StatCard label="Hold % (saque)" value={pct(stats.holdPct)} hint={stats.statsMatches ? `${stats.statsMatches} partidos con stats` : 'sin datos de saque'} />
        <StatCard label="Break % (resto)" value={pct(stats.breakPct)} hint={stats.statsMatches ? 'juegos al resto ganados' : 'sin datos de resto'} />
        <StatCard label="Aces / DF" value={stats.acesPerMatch != null ? `${stats.acesPerMatch} / ${stats.dfPerMatch}` : '—'} hint="por partido" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Rendimiento por superficie */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Por superficie</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            {surfaces.length === 0 ? (
              <p className="text-sm text-zinc-500">Sin partidos registrados.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {surfaces.map(({ s, e }) => {
                  const wr = e!.played ? e!.won / e!.played : 0
                  return (
                    <li key={s} className="flex items-center gap-3">
                      <div className="w-16 shrink-0"><SurfaceBadge surface={s} /></div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                        <div className="h-full rounded-full bg-lime-500/70" style={{ width: `${Math.round(wr * 100)}%` }} />
                      </div>
                      <div className="w-24 shrink-0 text-right mono text-xs text-zinc-300">
                        {(wr * 100).toFixed(0)}% <span className="text-zinc-600">({e!.won}-{e!.played - e!.won})</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Forma reciente */}
          <h2 className="mt-2 text-sm font-bold uppercase tracking-wider text-zinc-400">Forma reciente</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            {stats.last10.length === 0 ? (
              <p className="text-sm text-zinc-500">Sin partidos recientes.</p>
            ) : (
              <div className="flex items-center gap-1.5">
                {stats.last10.map((r, i) => (
                  <span key={i} className={cn('flex h-7 w-7 items-center justify-center rounded text-xs font-bold',
                    r === 'W' ? 'bg-lime-500/20 text-lime-300' : 'bg-red-500/15 text-red-300')}>
                    {r === 'W' ? 'V' : 'D'}
                  </span>
                ))}
                <span className="ml-2 text-[11px] text-zinc-600">más reciente →</span>
              </div>
            )}
          </div>
        </section>

        {/* Últimos resultados */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Últimos resultados</h2>
          <ResultsList rows={recent} />
        </section>
      </div>

      <p className="text-[11px] text-zinc-600">
        Métricas propias del tenis derivadas de partidos reales (fuente:
        TML-Database, CC BY-NC-SA). Hold%/Break% y aces solo aparecen cuando la
        fuente trae estadísticas de saque/resto del partido; si no, se declara
        honestamente, no se estima.
      </p>
    </div>
  )
}
