import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface NbaStandingView {
  team_id: string
  name: string
  code: string
  logo_url: string | null
  conference: string
  won: number
  lost: number
  win_pct: number
  points_for: number
  points_against: number
  form: ('W' | 'L')[]
}

const FORM_STYLE: Record<string, string> = {
  W: 'bg-emerald-500/20 text-emerald-400',
  L: 'bg-red-500/20 text-red-400',
}

/** Diferencia de partidos respecto al líder de la conferencia (Games Behind). */
function gamesBehind(leader: NbaStandingView, row: NbaStandingView): string {
  const gb = ((leader.won - leader.lost) - (row.won - row.lost)) / 2
  return gb <= 0 ? '—' : gb.toFixed(1)
}

function ConferenceTable({ title, rows, accent }: { title: string; rows: NbaStandingView[]; accent: string }) {
  const leader = rows[0]
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <span className={cn('h-2 w-2 rounded-full', accent)} />
        <h2 className="text-sm font-bold text-white">Conferencia {title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="sticky left-0 z-10 bg-zinc-900 px-3 py-2 text-left w-8">#</th>
              <th className="sticky left-8 z-10 bg-zinc-900 px-3 py-2 text-left">Equipo</th>
              <th className="px-2 py-2 text-center">V</th>
              <th className="px-2 py-2 text-center">D</th>
              <th className="px-2 py-2 text-center">%</th>
              <th className="px-2 py-2 text-center hidden sm:table-cell">GB</th>
              <th className="px-2 py-2 text-center hidden md:table-cell">PF</th>
              <th className="px-2 py-2 text-center hidden md:table-cell">PC</th>
              <th className="px-3 py-2 text-center hidden lg:table-cell">Forma</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.team_id}
                className={cn(
                  'border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors',
                  // 1-6 clasifican directo · 7-10 play-in · resto fuera
                  i < 6 ? 'border-l-2 border-l-emerald-500' : i < 10 ? 'border-l-2 border-l-sky-500' : 'border-l-2 border-l-transparent',
                )}
              >
                <td className="sticky left-0 z-10 bg-zinc-900 px-3 py-2 text-zinc-400 tabular-nums">{i + 1}</td>
                <td className="sticky left-8 z-10 bg-zinc-900 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {row.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.logo_url} alt="" className="h-5 w-5 shrink-0 object-contain" loading="lazy" />
                    )}
                    <span className="truncate font-medium text-zinc-200">{row.name}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center font-bold text-white tabular-nums">{row.won}</td>
                <td className="px-2 py-2 text-center text-zinc-400 tabular-nums">{row.lost}</td>
                <td className="px-2 py-2 text-center text-zinc-300 tabular-nums">{row.win_pct.toFixed(3).replace(/^0/, '')}</td>
                <td className="px-2 py-2 text-center text-zinc-500 tabular-nums hidden sm:table-cell">{gamesBehind(leader, row)}</td>
                <td className="px-2 py-2 text-center text-zinc-500 tabular-nums hidden md:table-cell">{row.points_for}</td>
                <td className="px-2 py-2 text-center text-zinc-500 tabular-nums hidden md:table-cell">{row.points_against}</td>
                <td className="px-3 py-2 hidden lg:table-cell">
                  <div className="flex justify-center gap-1">
                    {row.form.map((r, idx) => (
                      <span key={idx} className={cn('flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold', FORM_STYLE[r])}>
                        {r === 'W' ? 'V' : 'D'}
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
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Playoffs directo (1-6)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" /> Play-in (7-10)</span>
      </div>
    </div>
  )
}

export function ConferenceStandings({ east, west }: { east: NbaStandingView[]; west: NbaStandingView[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <ConferenceTable title="Este" rows={east} accent="bg-sky-500" />
      <ConferenceTable title="Oeste" rows={west} accent="bg-red-500" />
    </div>
  )
}
