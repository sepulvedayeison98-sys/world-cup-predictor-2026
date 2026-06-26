'use client'

import { useQuery } from '@tanstack/react-query'
import { teamsService } from '@/services/teams.service'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface Props {
  competitionId: string
  groupLetter: string
}

export function GroupStandingsWidget({ competitionId, groupLetter }: Props) {
  const { data: groups, isLoading } = useQuery({
    queryKey: ['all-groups', competitionId],
    queryFn: () => teamsService.getAllGroupsWithStandings(competitionId),
    staleTime: 300_000,
  })

  const group = groups?.find((g: any) => g.letter === groupLetter)
  const standings = (group?.group_standings ?? []).sort(
    (a: any, b: any) => b.points - a.points || b.goal_difference - a.goal_difference
  )

  const FormBadge = ({ r }: { r: string }) => (
    <span className={cn(
      'inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-bold',
      r === 'W' && 'bg-emerald-500/20 text-emerald-400',
      r === 'D' && 'bg-amber-500/20 text-amber-400',
      r === 'L' && 'bg-red-500/20 text-red-400',
    )}>
      {r}
    </span>
  )

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Grupo {groupLetter}</h2>
          <p className="text-[11px] text-zinc-500">Tabla de posiciones</p>
        </div>
        <Link
          href="/groups"
          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
        >
          Todos <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-zinc-800" />
          ))}
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="mb-1 grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-1 px-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Equipo</span>
            <span className="w-5 text-center text-[9px] text-zinc-600">PJ</span>
            <span className="w-5 text-center text-[9px] text-zinc-600">GD</span>
            <span className="w-6 text-center text-[9px] font-bold text-zinc-500">PTS</span>
            <span className="w-12 text-right text-[9px] text-zinc-600">Clasif.</span>
            <span className="w-10 text-right text-[9px] text-zinc-600">Forma</span>
          </div>

          <div className="space-y-0.5">
            {standings.map((s: any, idx: number) => {
              const isDirectQ = idx < 2
              const isMaybeQ  = idx === 2
              return (
                <div
                  key={s.id}
                  className={cn(
                    'grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-1 rounded px-1 py-1.5',
                    'hover:bg-zinc-800/50 transition-colors',
                    isDirectQ ? 'border-l-2 border-emerald-500/40'
                    : isMaybeQ ? 'border-l-2 border-amber-500/40' : ''
                  )}
                >
                  {/* Position + Team */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn(
                      'text-[10px] font-bold w-3 shrink-0',
                      isDirectQ ? 'text-emerald-400' : isMaybeQ ? 'text-amber-400' : 'text-zinc-600'
                    )}>
                      {idx + 1}
                    </span>
                    <span className="truncate text-xs font-medium text-zinc-200">
                      {s.team?.short_name ?? s.team?.code}
                    </span>
                  </div>

                  {/* Stats */}
                  <span className="w-5 text-center text-[10px] mono text-zinc-400">{s.played}</span>
                  <span className={cn(
                    'w-5 text-center text-[10px] mono font-medium',
                    s.goal_difference > 0 ? 'text-emerald-400' : s.goal_difference < 0 ? 'text-red-400' : 'text-zinc-400'
                  )}>
                    {s.goal_difference > 0 ? '+' : ''}{s.goal_difference}
                  </span>
                  <span className="w-6 text-center text-[11px] font-bold mono text-white">
                    {s.points}
                  </span>

                  {/* Qualification probability */}
                  <span className={cn(
                    'w-12 text-right text-[10px] font-medium mono',
                    (s.qualification_probability ?? 0) >= 70 ? 'text-emerald-400' :
                    (s.qualification_probability ?? 0) >= 40 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {(s.qualification_probability ?? 0).toFixed(0)}%
                  </span>

                  {/* Form */}
                  <div className="flex gap-0.5 justify-end">
                    {(s.form ?? []).slice(-3).map((r: string, i: number) => (
                      <FormBadge key={i} r={r} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-2 text-[9px] text-zinc-600">
            <span className="text-emerald-700">■</span> Directos &nbsp;·&nbsp;
            <span className="text-amber-700">■</span> Posible mejor 3ro
          </p>
        </>
      )}
    </div>
  )
}
