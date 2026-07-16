/**
 * DOMINIO TENNIS — lista de resultados reales (Fase 8). El ganador se marca
 * en lima; el marcador se muestra tal cual lo entrega la fuente.
 */
import Link from 'next/link'
import type { TennisResultRow } from '@/services/tennis/queries'
import { SurfaceBadge, roundLabel, shortDate } from '@/components/tennis/ui'
import { cn } from '@/lib/utils'

function PlayerCell({ player, isWinner }: { player: { id: string; name: string } | null; isWinner: boolean }) {
  if (!player) return <span className="text-zinc-500">—</span>
  return (
    <Link
      href={`/tennis/jugadores/${player.id}`}
      className={cn('truncate hover:text-lime-400', isWinner ? 'font-semibold text-zinc-100' : 'text-zinc-400')}
    >
      {player.name}
    </Link>
  )
}

export function ResultsList({ rows, showTournament = true }: { rows: TennisResultRow[]; showTournament?: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-8 text-center text-sm text-zinc-500">
        Sin resultados recientes
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800/60">
      {rows.map((m) => {
        const p1Won = m.winner_id != null && m.p1?.id === m.winner_id
        const p2Won = m.winner_id != null && m.p2?.id === m.winner_id
        return (
          <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-16 shrink-0 text-[11px] text-zinc-500">
              {shortDate(m.scheduled_at)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-0.5">
                <PlayerCell player={m.p1} isWinner={p1Won} />
                <PlayerCell player={m.p2} isWinner={p2Won} />
              </div>
            </div>
            <Link href={`/tennis/partidos/${m.id}`} className="hidden sm:flex flex-col items-end gap-1 text-right hover:opacity-80" title="Ver detalle del partido">
              <span className="mono text-xs text-zinc-300">{m.score ?? (m.status === 'retired' ? 'Ret.' : '—')}</span>
              <div className="flex items-center gap-1.5">
                <SurfaceBadge surface={m.surface} />
                {m.round && <span className="text-[10px] text-zinc-500">{roundLabel(m.round)}</span>}
              </div>
            </Link>
            {showTournament && m.tournament && (
              <div className="hidden md:block w-40 shrink-0 truncate text-right text-[11px] text-zinc-500">
                {m.tournament}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
