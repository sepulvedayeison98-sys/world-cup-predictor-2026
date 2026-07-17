import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchTennisHub } from '@/services/tennis/queries'
import { RankingTable } from '@/components/tennis/RankingTable'
import { ResultsList } from '@/components/tennis/ResultsList'
import { StatCard, shortDate } from '@/components/tennis/ui'
import { TENNIS_MODEL_VERSION } from '@/lib/tennis/constants'

export const metadata: Metadata = {
  title: 'Tenis ATP | Veredicto',
  description: 'Ranking ATP, resultados reales y motor de predicción con métricas medidas por backtest walk-forward.',
}

export const revalidate = 600

export default async function TennisHubPage() {
  const hub = await fetchTennisHub('ATP')
  const acc = hub.backtest?.accuracy != null ? `${(hub.backtest.accuracy * 100).toFixed(1)}%` : '—'

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-lime-500">
          Tenis · Circuito ATP
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">ATP Tour</h1>
        <p className="text-sm text-zinc-400">
          Ranking, resultados y predicciones del motor <span className="mono text-zinc-300">{TENNIS_MODEL_VERSION}</span>
          {' '}— ELO walk-forward por superficie, calibrado con backtest honesto sobre
          partidos reales. WTA llegará cuando haya fuente de datos verificable.
        </p>
      </div>

      {!hub.ready ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-10 text-center">
          <p className="text-sm font-medium text-zinc-300">Datos de tenis en preparación</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
            La estructura del dominio ya está lista; los partidos y el ranking se
            cargan desde la fuente histórica. Vuelve en unos minutos.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs — todos medidos, ninguno inventado */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Precisión del motor"
              value={acc}
              hint={hub.backtest ? `${hub.backtest.sample_size.toLocaleString('es-ES')} partidos · azar 50%` : 'sin backtest'}
              accent
            />
            <StatCard label="Partidos analizados" value={hub.matchesPlayed.toLocaleString('es-ES')} hint="resultados reales" />
            <StatCard label="Jugadores" value={hub.playersCount.toLocaleString('es-ES')} hint="mano · país · altura" />
            <StatCard label="Torneos" value={hub.tournamentsCount.toLocaleString('es-ES')} hint="ATP" />
          </div>

          {/* Secciones del dominio */}
          <section aria-label="Secciones Tenis" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { href: '/tennis/ranking', title: 'Ranking ATP', desc: 'Clasificación oficial a la última fecha' },
              { href: '/tennis/partidos', title: 'Resultados', desc: 'Partidos reales, filtrables por superficie' },
              { href: '/tennis/h2h', title: 'Cara a cara', desc: 'Historial H2H entre dos jugadores' },
              { href: '/tennis/inteligencia', title: 'Inteligencia', desc: 'Precisión, Brier y log-loss del backtest' },
              { href: hub.topRanking[0] ? `/tennis/jugadores/${hub.topRanking[0].player_id}` : '/tennis/ranking', title: 'Jugadores', desc: 'Perfil con Win%, Hold%, Break%' },
            ].map((s) => (
              <Link key={s.href} href={s.href}
                className="group rounded-xl border border-zinc-800 bg-zinc-900 p-3.5 transition-colors hover:border-zinc-700">
                <p className="text-sm font-bold text-zinc-100 group-hover:text-lime-400 transition-colors">{s.title}</p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500">{s.desc}</p>
              </Link>
            ))}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top ranking */}
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Top 15 ATP</h2>
                <Link href="/tennis/ranking" className="text-xs text-lime-500 hover:text-lime-400">ver ranking completo →</Link>
              </div>
              <RankingTable rows={hub.topRanking} compact />
              {hub.lastRankingDate && (
                <p className="text-[11px] text-zinc-600">Última posición conocida por jugador · datos hasta {shortDate(hub.lastRankingDate)}.</p>
              )}
            </section>

            {/* Resultados recientes */}
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Resultados recientes</h2>
              <ResultsList rows={hub.recentResults} />
            </section>
          </div>
        </>
      )}

      <p className="text-[11px] text-zinc-600">
        Fuente: TML-Database (esquema Sackmann, CC BY-NC-SA). Motor {TENNIS_MODEL_VERSION}:
        ranking+ELO walk-forward (con siembra por ranking), ELO por superficie,
        forma, saque/devolución con stats reales y H2H — combinados con
        renormalización honesta cuando falta un dato. Cero datos fabricados.
      </p>
    </div>
  )
}
