import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MovementItem {
  market: string
  odds_before: number
  odds_after: number
  prob_shift_pct: number
  detected_at: string
}

interface Props {
  movements: MovementItem[]
  homeName: string
  awayName: string
}

const MARKET_LABELS: Record<string, string> = {
  home_win: 'Gana local',
  draw: 'Empate',
  away_win: 'Gana visitante',
  over_0_5: 'Más de 0.5 goles',
  over_1_5: 'Más de 1.5 goles',
  over_2_5: 'Más de 2.5 goles',
  over_3_5: 'Más de 3.5 goles',
  btts_yes: 'Ambos anotan: Sí',
  btts_no: 'Ambos anotan: No',
}

function label(market: string, homeName: string, awayName: string): string {
  if (market === 'home_win') return `Gana ${homeName}`
  if (market === 'away_win') return `Gana ${awayName}`
  return MARKET_LABELS[market] ?? market
}

/**
 * Movimiento del mercado (playbook Sofascore, mejora 7). Muestra cómo se
 * movió la cuota real de Pinnacle antes del partido (before→after). La
 * historia la acumula el sync en market_movements; hasta que haya datos, el
 * panel simplemente no se renderiza (Data First: nada que mostrar, nada que
 * inventar).
 */
export function MarketMovementPanel({ movements, homeName, awayName }: Props) {
  // Solo movimientos significativos, el más reciente primero, tope 6
  const items = [...movements]
    .filter((m) => Math.abs(m.prob_shift_pct) > 0.02)
    .sort((a, b) => b.detected_at.localeCompare(a.detected_at))
    .slice(0, 6)

  if (items.length === 0) return null

  return (
    <section aria-label="Movimiento del mercado" className="card overflow-hidden">
      <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
        <h3 className="text-sm font-bold text-white">Movimiento del mercado</h3>
        <p className="text-[11px] text-zinc-500">Cómo se movió la cuota de Pinnacle · flecha = hacia dónde va la probabilidad</p>
      </div>
      <ul className="divide-y divide-zinc-800/60">
        {items.map((m, i) => {
          const up = m.prob_shift_pct > 0 // prob sube = cuota baja
          return (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="truncate text-xs font-medium text-zinc-300">
                {label(m.market, homeName, awayName)}
              </span>
              <div className="flex items-center gap-2 shrink-0 text-xs mono">
                <span className="text-zinc-500">{m.odds_before.toFixed(2)}</span>
                <span className="text-zinc-600">→</span>
                <span className="font-bold text-zinc-200">{m.odds_after.toFixed(2)}</span>
                <span className={cn('flex items-center gap-0.5 font-semibold', up ? 'text-emerald-400' : 'text-red-400')}>
                  {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {up ? '+' : ''}{(m.prob_shift_pct * 100).toFixed(1)}pp
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
