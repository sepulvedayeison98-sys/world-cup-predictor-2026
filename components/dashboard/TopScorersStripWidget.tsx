import { cn } from '@/lib/utils'
import { Flag } from '@/components/ui/Flag'
import { Crosshair } from 'lucide-react'
import Link from 'next/link'

interface ScorerRow {
  player_id: string
  goals: number
  projectedGoals: number
  player: {
    short_name: string
    name: string
    team: { code: string; confederation: string }
  }
}

interface Props { scorers: ScorerRow[] }

const CONF_DOT: Record<string, string> = {
  UEFA: 'bg-blue-500',
  CONMEBOL: 'bg-amber-500',
  CONCACAF: 'bg-red-500',
  AFC: 'bg-violet-500',
  CAF: 'bg-emerald-500',
}

export function TopScorersStripWidget({ scorers }: Props) {
  const top6 = scorers.slice(0, 6)
  const maxProjected = Math.max(...top6.map(s => s.goals + s.projectedGoals), 1)

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-blue-400" />
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Top Goleadores</span>
        </div>
        <Link href="/scorers" className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors">
          Ver completo →
        </Link>
      </div>

      {top6.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-2">Sin datos de goleadores</p>
      ) : (
        <div className="space-y-1.5">
          {top6.map((s, i) => {
            const total = s.goals + s.projectedGoals
            return (
              <div key={s.player_id} className="flex items-center gap-2">
                <span className="text-[10px] font-bold mono text-zinc-600 w-3">{i + 1}</span>
                <Flag code={s.player?.team?.code} />
                <span className="text-[10px] text-zinc-300 w-20 truncate">
                  {s.player?.short_name ?? s.player?.name}
                </span>
                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full flex rounded-full overflow-hidden">
                    <div className="bg-zinc-500 h-full" style={{ width: `${(s.goals / maxProjected) * 100}%` }} />
                    <div className="bg-emerald-600/60 h-full" style={{ width: `${(s.projectedGoals / maxProjected) * 100}%` }} />
                  </div>
                </div>
                <span className="text-[10px] font-bold mono text-zinc-300 w-6 text-right">{s.goals}</span>
                <span className="text-[10px] text-emerald-500 mono w-10 text-right">+{s.projectedGoals.toFixed(1)}</span>
                <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', CONF_DOT[s.player?.team?.confederation] ?? 'bg-zinc-600')} />
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] text-zinc-700">
        Barras: goles actuales (gris) + proyectados (verde)
      </p>
    </div>
  )
}
