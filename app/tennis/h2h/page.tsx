import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchPlayersForPicker, fetchTennisH2H } from '@/services/tennis/queries'
import { H2HPicker } from '@/components/tennis/H2HPicker'
import { ResultsList } from '@/components/tennis/ResultsList'
import { SurfaceBadge, countryFlag } from '@/components/tennis/ui'
import { SURFACE_LABELS, type Surface } from '@/lib/tennis/constants'

export const metadata: Metadata = {
  title: 'Cara a cara ATP | Veredicto',
  description: 'Historial cabeza a cabeza entre dos tenistas del circuito ATP, con datos reales por superficie.',
}

export const revalidate = 600

export default async function TennisH2HPage({
  searchParams,
}: { searchParams: Promise<{ p1?: string; p2?: string }> }) {
  const sp = await searchParams
  const [players, h2h] = await Promise.all([
    fetchPlayersForPicker('ATP'),
    sp.p1 && sp.p2 ? fetchTennisH2H(sp.p1, sp.p2) : Promise.resolve(null),
  ])

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href="/tennis" className="text-xs font-semibold uppercase tracking-widest text-lime-500 hover:text-lime-400">← Tenis</Link>
        <h1 className="mt-1 text-2xl font-bold text-white">Cara a cara</h1>
        <p className="text-sm text-zinc-400">
          Historial real entre dos jugadores del circuito ATP. Elige a ambos y
          compara su balance global y por superficie.
        </p>
      </div>

      <H2HPicker players={players} initial1={sp.p1} initial2={sp.p2} />

      {sp.p1 && sp.p2 && !h2h && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-8 text-center text-sm text-zinc-400">
          No se encontró a alguno de los jugadores.
        </div>
      )}

      {h2h && (
        <>
          {/* Marcador global */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between gap-4">
              <Link href={`/tennis/jugadores/${h2h.p1.id}`} className="min-w-0 flex-1 text-left hover:text-lime-400">
                <span aria-hidden className="mr-1.5">{countryFlag(h2h.p1.country_code)}</span>
                <span className="font-semibold text-zinc-100">{h2h.p1.name}</span>
              </Link>
              <div className="shrink-0 text-center">
                <p className="mono text-3xl font-bold text-white">
                  <span className={h2h.p1Wins >= h2h.p2Wins ? 'text-lime-400' : 'text-zinc-400'}>{h2h.p1Wins}</span>
                  <span className="text-zinc-600"> – </span>
                  <span className={h2h.p2Wins >= h2h.p1Wins ? 'text-lime-400' : 'text-zinc-400'}>{h2h.p2Wins}</span>
                </p>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">{h2h.p1Wins + h2h.p2Wins} partidos</p>
              </div>
              <Link href={`/tennis/jugadores/${h2h.p2.id}`} className="min-w-0 flex-1 text-right hover:text-lime-400">
                <span className="font-semibold text-zinc-100">{h2h.p2.name}</span>
                <span aria-hidden className="ml-1.5">{countryFlag(h2h.p2.country_code)}</span>
              </Link>
            </div>

            {/* Balance por superficie */}
            {Object.keys(h2h.bySurface).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                {(Object.keys(SURFACE_LABELS) as Surface[])
                  .filter((s) => h2h.bySurface[s])
                  .map((s) => (
                    <div key={s} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                      <SurfaceBadge surface={s} />
                      <span className="mono text-xs text-zinc-300">{h2h.bySurface[s].p1}–{h2h.bySurface[s].p2}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Historial de enfrentamientos */}
          {h2h.matches.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Enfrentamientos</h2>
              <ResultsList rows={h2h.matches} />
            </section>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-8 text-center text-sm text-zinc-400">
              Estos jugadores no se han enfrentado en el histórico disponible.
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-zinc-600">
        Fuente: TML-Database (esquema Sackmann, CC BY-NC-SA). Balance sobre
        partidos con tenis jugado (walkover excluido).
      </p>
    </div>
  )
}
