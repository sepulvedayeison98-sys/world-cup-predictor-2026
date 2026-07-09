import { cn } from '@/lib/utils'

interface NbaTeamLite {
  name: string
  code?: string | null
  elo_rating?: number | null
}

interface NbaSeasonStats {
  matches_played?: number | null
  avg_goals_scored?: number | null   // en NBA: puntos por partido
  avg_goals_conceded?: number | null // puntos permitidos por partido
  form?: string[] | null             // W/L (sin empates)
}

interface Props {
  homeTeam: NbaTeamLite | null
  awayTeam: NbaTeamLite | null
  homeStats: NbaSeasonStats | null
  awayStats: NbaSeasonStats | null
}

/**
 * Comparación de equipos exclusiva de baloncesto. Sustituye a los paneles
 * de fútbol (xG, ranking FIFA, radar de goles) en el detalle NBA: aquí
 * solo viven métricas reales de la temporada — ELO del modelo, anotación,
 * puntos permitidos, diferencial y forma reciente W/L.
 */
export function NbaTeamComparison({ homeTeam, awayTeam, homeStats, awayStats }: Props) {
  if (!homeTeam || !awayTeam) return null

  const ppg = (s: NbaSeasonStats | null) => (s?.avg_goals_scored != null ? Number(s.avg_goals_scored) : null)
  const papg = (s: NbaSeasonStats | null) => (s?.avg_goals_conceded != null ? Number(s.avg_goals_conceded) : null)
  const diff = (s: NbaSeasonStats | null) => {
    const f = ppg(s); const a = papg(s)
    return f != null && a != null ? f - a : null
  }

  const rows: { label: string; home: number | null; away: number | null; decimals: number; signed?: boolean }[] = [
    { label: 'ELO del modelo', home: homeTeam.elo_rating ?? null, away: awayTeam.elo_rating ?? null, decimals: 0 },
    { label: 'Puntos por partido', home: ppg(homeStats), away: ppg(awayStats), decimals: 1 },
    { label: 'Puntos permitidos', home: papg(homeStats), away: papg(awayStats), decimals: 1 },
    { label: 'Diferencial por partido', home: diff(homeStats), away: diff(awayStats), decimals: 1, signed: true },
    { label: 'Partidos jugados', home: homeStats?.matches_played ?? null, away: awayStats?.matches_played ?? null, decimals: 0 },
  ]

  const fmt = (v: number | null, decimals: number, signed?: boolean) => {
    if (v == null) return '—'
    const s = v.toFixed(decimals)
    return signed && v > 0 ? `+${s}` : s
  }

  // En "Puntos permitidos" gana el menor; en el resto, el mayor
  const homeWins = (r: (typeof rows)[number]) => {
    if (r.home == null || r.away == null || r.home === r.away) return null
    const lowerIsBetter = r.label === 'Puntos permitidos'
    return lowerIsBetter ? r.home < r.away : r.home > r.away
  }

  const FormBadges = ({ form }: { form?: string[] | null }) => (
    <span className="flex gap-1">
      {(form ?? []).slice(-5).map((r, i) => (
        <span
          key={i}
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold',
            r === 'W' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
          )}
        >
          {r}
        </span>
      ))}
      {(form ?? []).length === 0 && <span className="text-xs text-zinc-600">—</span>}
    </span>
  )

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-bold text-white">Comparación de temporada</h3>
        <p className="text-[11px] text-zinc-500">
          Métricas reales de la temporada regular y playoffs — sin datos estimados.
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5 border-b border-zinc-800/60">
        <span className="truncate text-right text-sm font-bold text-zinc-100">{homeTeam.code ?? homeTeam.name}</span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">local · visitante</span>
        <span className="truncate text-left text-sm font-bold text-zinc-100">{awayTeam.code ?? awayTeam.name}</span>
      </div>
      <ul className="divide-y divide-zinc-800/60">
        {rows.map((r) => {
          const hw = homeWins(r)
          return (
            <li key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2">
              <span className={cn('text-right text-sm mono', hw === true ? 'font-bold text-emerald-400' : 'text-zinc-300')}>
                {fmt(r.home, r.decimals, r.signed)}
              </span>
              <span className="min-w-[150px] text-center text-[11px] text-zinc-500">{r.label}</span>
              <span className={cn('text-left text-sm mono', hw === false ? 'font-bold text-emerald-400' : 'text-zinc-300')}>
                {fmt(r.away, r.decimals, r.signed)}
              </span>
            </li>
          )
        })}
        <li className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5">
          <span className="flex justify-end"><FormBadges form={homeStats?.form} /></span>
          <span className="min-w-[150px] text-center text-[11px] text-zinc-500">Últimos 5</span>
          <span className="flex justify-start"><FormBadges form={awayStats?.form} /></span>
        </li>
      </ul>
    </div>
  )
}
