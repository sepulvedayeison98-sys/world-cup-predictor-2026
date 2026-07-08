import { cn } from '@/lib/utils'
import type { LeagueStandingRow } from '@/lib/leagueStandings'

/**
 * Tabla de posiciones de liga (presentacional, sin estado).
 * Zonas: 1-4 Champions · 5 Europa League · últimos 3 descenso.
 */
function zoneClass(position: number, total: number): string {
  if (position <= 4) return 'border-l-2 border-l-emerald-500'
  if (position === 5) return 'border-l-2 border-l-sky-500'
  if (position > total - 3) return 'border-l-2 border-l-red-500'
  return 'border-l-2 border-l-transparent'
}

const FORM_STYLE: Record<string, string> = {
  W: 'bg-emerald-500/20 text-emerald-400',
  D: 'bg-zinc-600/30 text-zinc-300',
  L: 'bg-red-500/20 text-red-400',
}
const FORM_LABEL: Record<string, string> = { W: 'V', D: 'E', L: 'P' }

export function StandingsTable({ standings }: { standings: LeagueStandingRow[] }) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left">Equipo</th>
              <th className="px-2 py-2 text-center">PJ</th>
              <th className="px-2 py-2 text-center">G</th>
              <th className="px-2 py-2 text-center">E</th>
              <th className="px-2 py-2 text-center">P</th>
              <th className="px-2 py-2 text-center hidden sm:table-cell">GF</th>
              <th className="px-2 py-2 text-center hidden sm:table-cell">GC</th>
              <th className="px-2 py-2 text-center">DG</th>
              <th className="px-2 py-2 text-center font-bold">Pts</th>
              <th className="px-3 py-2 text-center hidden md:table-cell">Forma</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr
                key={row.team.id}
                className={cn(
                  'border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors',
                  zoneClass(row.position, standings.length),
                )}
              >
                <td className="px-3 py-2 text-zinc-400 tabular-nums">{row.position}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {row.team.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.team.logo_url} alt="" className="h-5 w-5 shrink-0 object-contain" loading="lazy" />
                    )}
                    <span className="truncate font-medium text-zinc-200">{row.team.name}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center text-zinc-400 tabular-nums">{row.played}</td>
                <td className="px-2 py-2 text-center text-zinc-400 tabular-nums">{row.won}</td>
                <td className="px-2 py-2 text-center text-zinc-400 tabular-nums">{row.drawn}</td>
                <td className="px-2 py-2 text-center text-zinc-400 tabular-nums">{row.lost}</td>
                <td className="px-2 py-2 text-center text-zinc-500 tabular-nums hidden sm:table-cell">{row.goals_for}</td>
                <td className="px-2 py-2 text-center text-zinc-500 tabular-nums hidden sm:table-cell">{row.goals_against}</td>
                <td className={cn('px-2 py-2 text-center tabular-nums', row.goal_difference > 0 ? 'text-emerald-400' : row.goal_difference < 0 ? 'text-red-400' : 'text-zinc-400')}>
                  {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                </td>
                <td className="px-2 py-2 text-center font-bold text-white tabular-nums">{row.points}</td>
                <td className="px-3 py-2 hidden md:table-cell">
                  <div className="flex justify-center gap-1">
                    {row.form.map((r, i) => (
                      <span key={i} className={cn('flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold', FORM_STYLE[r])}>
                        {FORM_LABEL[r]}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 border-t border-zinc-800 px-4 py-2.5 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Champions League</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" /> Europa League</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Descenso</span>
      </div>
    </>
  )
}
