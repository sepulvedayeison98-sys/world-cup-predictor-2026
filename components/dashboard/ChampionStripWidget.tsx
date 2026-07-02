import { cn } from '@/lib/utils'
import { Flag } from '@/components/ui/Flag'
import { Trophy } from 'lucide-react'
import Link from 'next/link'

interface TeamProb {
  team_id: string
  winner_prob: number
  team: { name: string; short_name: string; code: string; confederation: string }
}

interface Props { simulations: TeamProb[] }

const CONF_DOT: Record<string, string> = {
  UEFA: 'bg-blue-500',
  CONMEBOL: 'bg-amber-500',
  CONCACAF: 'bg-red-500',
  AFC: 'bg-violet-500',
  CAF: 'bg-emerald-500',
}

export function ChampionStripWidget({ simulations }: Props) {
  const top8 = simulations.slice(0, 8)
  const hasData = top8.length > 0 && top8[0].winner_prob > 0

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Prob. Campeón</span>
        </div>
        <Link href="/champion" className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors">
          Ver completo →
        </Link>
      </div>

      {!hasData ? (
        <p className="text-xs text-zinc-600 text-center py-2">Simulación pendiente</p>
      ) : (
        <div className="space-y-1.5">
          {top8.map((sim, i) => {
            const pct = sim.winner_prob * 100
            const maxPct = top8[0].winner_prob * 100
            return (
              <div key={sim.team_id} className="flex items-center gap-2">
                <span className="text-[10px] font-bold mono text-zinc-600 w-3">{i + 1}</span>
                <Flag code={sim.team.code} />
                <span className="text-[10px] text-zinc-300 w-12 truncate">{sim.team.code}</span>
                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', i === 0 ? 'bg-amber-500' : 'bg-zinc-500')}
                    style={{ width: `${(pct / maxPct) * 100}%` }}
                  />
                </div>
                <span className={cn('text-[10px] font-bold mono w-10 text-right', i === 0 ? 'text-amber-400' : 'text-zinc-400')}>
                  {pct.toFixed(1)}%
                </span>
                <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', CONF_DOT[sim.team.confederation] ?? 'bg-zinc-600')} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
