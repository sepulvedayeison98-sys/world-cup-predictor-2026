/**
 * DOMINIO TENNIS — panel de mercados simulados (Monte Carlo). Render puro,
 * sin estado. Publica probabilidades de marcador en sets, over/under de
 * juegos y hándicap de juegos — SIN cuotas (los mercados con EV llegan con
 * la Fase 9 cuando exista fuente de cuotas).
 */
import type { TennisMatchupSim } from '@/services/tennis/queries'
import { cn } from '@/lib/utils'

const pct = (v: number) => `${(v * 100).toFixed(1)}%`

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={cn('mono text-xs', strong ? 'font-bold text-lime-300' : 'text-zinc-200')}>{value}</span>
    </div>
  )
}

export function MarketsPanel({ sim, name1, name2 }: { sim: TennisMatchupSim; name1: string; name2: string }) {
  const { markets: m } = sim
  const p2Win = 1 - m.matchWinP1
  const scoreOrder = m.bestOf === 3 ? ['2-0', '2-1', '1-2', '0-2'] : ['3-0', '3-1', '3-2', '2-3', '1-3', '0-3']

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      {/* Ganador */}
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{name1}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-600">prob. de victoria</span>
        <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-zinc-100">{name2}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={cn('mono w-14 text-sm font-bold', m.matchWinP1 >= p2Win ? 'text-lime-400' : 'text-zinc-300')}>{pct(m.matchWinP1)}</span>
        <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full bg-lime-500/80" style={{ width: `${m.matchWinP1 * 100}%` }} />
          <div className="h-full bg-sky-500/60" style={{ width: `${p2Win * 100}%` }} />
        </div>
        <span className={cn('mono w-14 text-right text-sm font-bold', p2Win > m.matchWinP1 ? 'text-sky-300' : 'text-zinc-300')}>{pct(p2Win)}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-zinc-800 pt-4 sm:grid-cols-3">
        {/* Marcador en sets */}
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Marcador (sets)</p>
          {scoreOrder.map((k) => (
            <Row key={k} label={k} value={pct(m.setScores[k] ?? 0)} strong={(m.setScores[k] ?? 0) >= Math.max(...Object.values(m.setScores))} />
          ))}
        </div>
        {/* Juegos totales */}
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Juegos totales <span className="normal-case text-zinc-600">(media {m.gamesAvg.toFixed(1)})</span>
          </p>
          {m.totalGamesOver.map(({ line, over }) => (
            <Row key={line} label={`Over ${line}`} value={pct(over)} />
          ))}
        </div>
        {/* Hándicap de juegos */}
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Hándicap de juegos</p>
          {m.handicap.map(({ line, p1Covers }) => (
            <Row key={line} label={`${name1.split(' ').pop()} ${line > 0 ? `+${line}` : line}`} value={pct(p1Covers)} />
          ))}
        </div>
      </div>

      <p className="mt-4 border-t border-zinc-800 pt-3 text-[11px] leading-relaxed text-zinc-600">
        Partido hipotético hoy al mejor de {m.bestOf}, {m.sims.toLocaleString('es-ES')} simulaciones
        punto→juego→set→partido con los % reales de puntos al saque/resto de cada
        jugador (prob. de punto al saque usadas: {pct(m.pServe1)} y {pct(m.pServe2)}).
        Distribución calibrada contra las frecuencias reales del histórico ATP.
        Sin cuotas: probabilidades del modelo, no precios de mercado.
      </p>
    </div>
  )
}
