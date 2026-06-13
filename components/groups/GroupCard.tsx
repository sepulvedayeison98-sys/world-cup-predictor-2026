'use client'

import { cn } from '@/lib/utils'

interface Props {
  group: any
}

export function GroupCard({ group }: Props) {
  const standings = [...(group.group_standings ?? [])].sort((a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
    return b.goals_for - a.goals_for
  })

  const FormPill = ({ r }: { r: string }) => (
    <span className={cn(
      'inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-bold',
      r === 'W' && 'bg-emerald-500/20 text-emerald-400',
      r === 'D' && 'bg-amber-500/20 text-amber-400',
      r === 'L' && 'bg-red-500/20 text-red-400',
    )}>{r}</span>
  )

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
        <h3 className="text-sm font-bold text-white">{group.name}</h3>
        <span className="text-[10px] text-zinc-500">
          {standings.length} equipos
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800/50">
              <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wider text-zinc-600 w-5">#</th>
              <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Equipo</th>
              <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase tracking-wider text-zinc-600">PJ</th>
              <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase tracking-wider text-zinc-600">PG</th>
              <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase tracking-wider text-zinc-600">PE</th>
              <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase tracking-wider text-zinc-600">PP</th>
              <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase tracking-wider text-zinc-600">GF</th>
              <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase tracking-wider text-zinc-600">GC</th>
              <th className="px-2 py-2 text-center text-[9px] font-semibold uppercase tracking-wider text-zinc-600">DG</th>
              <th className="px-2 py-2 text-center text-[9px] font-bold uppercase tracking-wider text-zinc-500">PTS</th>
              <th className="px-2 py-2 text-right text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Clasif.</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s: any, idx: number) => {
              const isQualified = idx < 2
              const gd = s.goal_difference ?? (s.goals_for - s.goals_against)
              return (
                <tr
                  key={s.id}
                  className={cn(
                    'transition-colors',
                    isQualified
                      ? 'border-l-2 border-emerald-500/50 hover:bg-emerald-500/5'
                      : 'hover:bg-zinc-800/30'
                  )}
                >
                  <td className="px-3 py-2">
                    <span className={cn(
                      'text-[10px] font-bold',
                      isQualified ? 'text-emerald-400' : 'text-zinc-600'
                    )}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-zinc-200">
                        {s.team?.code}
                      </span>
                      <span className="hidden sm:inline text-[10px] text-zinc-500 truncate max-w-[80px]">
                        {s.team?.short_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center text-xs mono text-zinc-400">{s.played}</td>
                  <td className="px-2 py-2 text-center text-xs mono text-zinc-400">{s.won}</td>
                  <td className="px-2 py-2 text-center text-xs mono text-zinc-400">{s.drawn}</td>
                  <td className="px-2 py-2 text-center text-xs mono text-zinc-400">{s.lost}</td>
                  <td className="px-2 py-2 text-center text-xs mono text-zinc-400">{s.goals_for}</td>
                  <td className="px-2 py-2 text-center text-xs mono text-zinc-400">{s.goals_against}</td>
                  <td className="px-2 py-2 text-center text-xs mono font-medium">
                    <span className={cn(
                      gd > 0 ? 'text-emerald-400' : gd < 0 ? 'text-red-400' : 'text-zinc-500'
                    )}>
                      {gd > 0 ? '+' : ''}{gd}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="text-sm font-black mono text-white">{s.points}</span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className={cn(
                      'text-[10px] font-semibold mono',
                      s.qualification_probability >= 70 ? 'text-emerald-400' :
                      s.qualification_probability >= 40 ? 'text-amber-400' : 'text-red-400'
                    )}>
                      {s.qualification_probability?.toFixed(0) ?? '—'}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Form row */}
      {standings.some((s: any) => s.form?.length > 0) && (
        <div className="border-t border-zinc-800/50 px-3 py-2">
          <div className="space-y-1">
            {standings.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-600 w-8">{s.team?.code}</span>
                <div className="flex gap-0.5">
                  {(s.form ?? []).slice(-5).map((r: string, i: number) => (
                    <FormPill key={i} r={r} />
                  ))}
                  {(s.form ?? []).length === 0 && (
                    <span className="text-[10px] text-zinc-700">Sin partidos</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-right">
                  <span className="text-[9px] text-zinc-600">Líder:</span>
                  <span className={cn(
                    'text-[10px] font-semibold mono',
                    s.top_spot_probability >= 50 ? 'text-emerald-400' :
                    s.top_spot_probability >= 25 ? 'text-amber-400' : 'text-zinc-600'
                  )}>
                    {s.top_spot_probability?.toFixed(0) ?? 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 py-1.5 text-[9px] text-zinc-700 border-t border-zinc-800/50">
        ▌ = Clasificados · Clasif. = % de clasificación · Líder = % de liderar grupo
      </div>
    </div>
  )
}
