/**
 * DOMINIO TENNIS — tabla de ranking (Fase 8). Presentacional; los datos
 * son observaciones reales de ranking a la fecha, no un orden editorial.
 */
import Link from 'next/link'
import type { TennisRankingRow } from '@/services/tennis/queries'
import { countryFlag, handLabel } from '@/components/tennis/ui'

export function RankingTable({ rows, compact = false }: { rows: TennisRankingRow[]; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Jugador</th>
              {!compact && <th className="px-2 py-2 text-center hidden sm:table-cell">Mano</th>}
              <th className="px-3 py-2 text-right">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player_id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40 transition-colors">
                <td className="px-3 py-2 text-zinc-400 tabular-nums">{r.position}</td>
                <td className="px-3 py-2">
                  <Link href={`/tennis/jugadores/${r.player_id}`} className="flex items-center gap-2 min-w-0 hover:text-lime-400">
                    <span aria-hidden>{countryFlag(r.country_code)}</span>
                    <span className="truncate font-medium text-zinc-200">{r.name}</span>
                  </Link>
                </td>
                {!compact && (
                  <td className="px-2 py-2 text-center text-zinc-400 hidden sm:table-cell">{handLabel(r.plays_hand)}</td>
                )}
                <td className="px-3 py-2 text-right text-zinc-300 mono tabular-nums">
                  {r.points != null ? r.points.toLocaleString('es-ES') : '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={compact ? 3 : 4} className="px-3 py-6 text-center text-sm text-zinc-500">Sin ranking disponible</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
