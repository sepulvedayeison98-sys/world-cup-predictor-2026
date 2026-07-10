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
  className?: string
}

/**
 * Barra 1X2 unificada — la visualización firma de Veredicto (playbook
 * Sofascore, QW5): un solo vocabulario visual para la probabilidad del
 * modelo en todo el producto. Verde esmeralda = local, ámbar = empate,
 * rojo = visitante (convención ya usada en PredictionsTable/ProbCell).
 *
 * Server-compatible (sin hooks). Con draw=0 (deportes sin empate) el
 * segmento central no se dibuja.
 */
export function ProbBar1X2({ home, draw, away, homeLabel, awayLabel, variant = 'compact', className }: Props) {
  const h = Math.max(0, Math.round(home * 100))
  const d = Math.max(0, Math.round(draw * 100))
  const a = Math.max(0, Math.round(away * 100))
  const total = h + d + a || 1

  const seg = (v: number) => `${(v / total) * 100}%`

  return (
    <div className={cn('w-full', className)}>
      {variant === 'full' && (
        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <span>{homeLabel ?? 'Local'}</span>
          {d > 0 && <span>Empate</span>}
          <span>{awayLabel ?? 'Visita'}</span>
        </div>
      )}
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-800" role="img"
        aria-label={`Probabilidades del modelo: local ${h}%, empate ${d}%, visitante ${a}%`}>
        <div className="h-full bg-emerald-500" style={{ width: seg(h) }} />
        {d > 0 && <div className="h-full bg-amber-500" style={{ width: seg(d) }} />}
        <div className="h-full bg-red-500" style={{ width: seg(a) }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] mono">
        <span className="text-emerald-400">{h}%</span>
        {d > 0 && <span className="text-amber-400">{d}%</span>}
        <span className="text-red-400">{a}%</span>
      </div>
    </div>
  )
}
