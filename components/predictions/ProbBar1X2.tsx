import { cn } from '@/lib/utils'

interface Props {
  /** Probabilidades 0..1 (del modelo). Deben venir de una predicción real. */
  home: number
  draw: number
  away: number
  /** Códigos cortos para las etiquetas (opcional) */
  homeLabel?: string
  awayLabel?: string
  /** compact: solo barra + % · full: etiquetas arriba */
  variant?: 'compact' | 'full'
  /**
   * Overlay "modelo vs mercado" (mejora 9): probabilidad implícita justa
   * del mercado (devig, suma 1). Cuando se pasa, se dibujan marcadores en la
   * barra donde el mercado traza los límites y una fila con sus % + el edge.
   * Si es null/undefined no se muestra nada de mercado (vacío honesto).
   */
  market?: { home: number; draw: number; away: number } | null
  className?: string
}

/**
 * Barra 1X2 unificada — la visualización firma de Veredicto (playbook
 * Sofascore, QW5): un solo vocabulario visual para la probabilidad del
 * modelo en todo el producto. Verde esmeralda = local, ámbar = empate,
 * rojo = visitante (convención ya usada en PredictionsTable/ProbCell).
 *
 * Server-compatible (sin hooks). Con draw=0 (deportes sin empate) el
 * segmento central no se dibuja. Con `market` superpone el mercado (mejora 9).
 */
export function ProbBar1X2({ home, draw, away, homeLabel, awayLabel, variant = 'compact', market, className }: Props) {
  const h = Math.max(0, Math.round(home * 100))
  const d = Math.max(0, Math.round(draw * 100))
  const a = Math.max(0, Math.round(away * 100))
  const total = h + d + a || 1

  const seg = (v: number) => `${(v / total) * 100}%`

  // Overlay de mercado: marcadores en los límites implícitos y edge del modelo
  const mkt = market ? { h: Math.round(market.home * 100), d: Math.round(market.draw * 100), a: Math.round(market.away * 100) } : null
  const tick1 = market ? market.home * 100 : 0                         // límite local|empate del mercado
  const tick2 = market ? (market.home + market.draw) * 100 : 0         // límite empate|visita del mercado

  return (
    <div className={cn('w-full', className)}>
      {variant === 'full' && (
        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <span>{homeLabel ?? 'Local'}</span>
          {d > 0 && <span>Empate</span>}
          <span>{awayLabel ?? 'Visita'}</span>
        </div>
      )}
      <div className="relative">
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-800" role="img"
          aria-label={`Probabilidades del modelo: local ${h}%, empate ${d}%, visitante ${a}%${mkt ? `. Mercado: ${mkt.h}%, ${mkt.d}%, ${mkt.a}%` : ''}`}>
          <div className="h-full bg-emerald-500" style={{ width: seg(h) }} />
          {d > 0 && <div className="h-full bg-amber-500" style={{ width: seg(d) }} />}
          <div className="h-full bg-red-500" style={{ width: seg(a) }} />
        </div>
        {/* Marcadores del mercado (dónde traza el mercado sus límites) */}
        {market && (
          <>
            <span className="absolute top-[-1px] h-[8px] w-px bg-white/80" style={{ left: `${tick1}%` }} title="Límite del mercado local|empate" />
            <span className="absolute top-[-1px] h-[8px] w-px bg-white/80" style={{ left: `${tick2}%` }} title="Límite del mercado empate|visita" />
          </>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] mono">
        <span className="text-emerald-400">{h}%</span>
        {d > 0 && <span className="text-amber-400">{d}%</span>}
        <span className="text-red-400">{a}%</span>
      </div>
      {mkt && (
        <div className="mt-0.5 flex items-center justify-between text-[10px] mono text-zinc-500">
          <span title="Probabilidad justa del mercado (Pinnacle, sin margen)">mercado {mkt.h}%</span>
          {d > 0 && <span>{mkt.d}%</span>}
          <span>{mkt.a}%</span>
        </div>
      )}
    </div>
  )
}
