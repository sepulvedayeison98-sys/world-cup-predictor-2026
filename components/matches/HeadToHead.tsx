import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { H2HResult } from '@/lib/h2h'

interface Props {
  h2h: H2HResult
  homeName: string
  awayName: string
  /** id del equipo local del partido actual, para orientar el resumen */
  homeIsA: boolean
}

/**
 * Head-to-head (playbook Sofascore, mejora 10). Muestra el balance real de
 * enfrentamientos y los últimos cruces. El módulo normaliza a "A"; aquí A
 * es el local del partido actual cuando homeIsA, si no se invierte para
 * presentarlo siempre como Local vs Visitante del partido en pantalla.
 */
export function HeadToHead({ h2h, homeName, awayName, homeIsA }: Props) {
  if (h2h.total === 0) return null

  // Orientar el balance al local del partido actual
  const homeWins = homeIsA ? h2h.aWins : h2h.bWins
  const awayWins = homeIsA ? h2h.bWins : h2h.aWins
  const homeGoals = homeIsA ? h2h.aGoals : h2h.bGoals
  const awayGoals = homeIsA ? h2h.bGoals : h2h.aGoals

  const seg = (v: number) => (h2h.total ? `${(v / h2h.total) * 100}%` : '0%')

  return (
    <section aria-label="Historial de enfrentamientos" className="card overflow-hidden">
      <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
        <h3 className="text-sm font-bold text-white">Historial de enfrentamientos</h3>
        <p className="text-[11px] text-zinc-500">{h2h.total} {h2h.total === 1 ? 'partido' : 'partidos'} en nuestros datos</p>
      </div>

      <div className="p-4">
        {/* Balance */}
        <div className="mb-1 flex items-center justify-between text-xs font-semibold">
          <span className="text-emerald-400">{homeWins} <span className="text-zinc-500 font-normal">{homeName}</span></span>
          <span className="text-amber-400">{h2h.draws} empates</span>
          <span className="text-red-400"><span className="text-zinc-500 font-normal">{awayName}</span> {awayWins}</span>
        </div>
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full bg-emerald-500" style={{ width: seg(homeWins) }} />
          <div className="h-full bg-amber-500" style={{ width: seg(h2h.draws) }} />
          <div className="h-full bg-red-500" style={{ width: seg(awayWins) }} />
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">
          Goles totales: <span className="mono text-zinc-300">{homeGoals}</span> — <span className="mono text-zinc-300">{awayGoals}</span>
        </p>

        {/* Últimos cruces */}
        <ul className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">
          {h2h.recent.map((r) => {
            // Marcador desde la óptica del local actual
            const hs = homeIsA ? r.aScore : r.bScore
            const as = homeIsA ? r.bScore : r.aScore
            const homeWon = hs > as
            const draw = hs === as
            return (
              <li key={r.id}>
                <Link href={`/matches/${r.id}`} className="flex items-center justify-between gap-2 text-xs hover:bg-zinc-800/40 rounded px-1.5 py-1 transition-colors">
                  <span className="text-zinc-500 mono text-[10px] w-16 shrink-0">
                    {new Date(r.date).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', year: '2-digit', month: 'short' })}
                  </span>
                  <span className="truncate text-zinc-300">{homeName} vs {awayName}</span>
                  <span className={cn(
                    'mono font-bold shrink-0',
                    draw ? 'text-amber-400' : homeWon ? 'text-emerald-400' : 'text-red-400',
                  )}>
                    {hs}–{as}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
