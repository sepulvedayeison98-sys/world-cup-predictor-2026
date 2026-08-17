import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * KPI del perfil de equipo — primer componente de la nueva identidad visual
 * (Fase 1 del rediseño). Deliberadamente NO usa `.kpi-card` (globals.css):
 * esa clase la comparten otras seis páginas (inteligencia, jugadores,
 * predicciones…) y no se toca hasta validar el lenguaje aquí primero.
 *
 * La barra de contexto es siempre un ratio REAL ya calculado (% de
 * victorias, puntos sobre el máximo de 3) — nunca una tendencia inventada.
 * Sin ese dato, `contextRatio` se omite y la tarjeta se queda sin barra en
 * vez de simular una.
 */
export interface TeamStatCardProps {
  icon: LucideIcon
  label: string
  value: string
  /** Tinte del ícono, el valor y la barra de contexto. */
  accent?: 'emerald' | 'red' | 'amber' | 'sky' | 'zinc'
  /** 0–1. Si se omite, la tarjeta no dibuja barra. */
  contextRatio?: number
  /** Texto corto bajo la barra, p. ej. "62% de victorias". */
  contextLabel?: string
}

const ACCENT = {
  emerald: { icon: 'bg-emerald-500/10 text-emerald-400', value: 'text-emerald-400', bar: 'bg-emerald-500', ring: 'hover:border-emerald-500/30 hover:shadow-emerald-500/5' },
  red:     { icon: 'bg-red-500/10 text-red-400',         value: 'text-red-400',     bar: 'bg-red-500',     ring: 'hover:border-red-500/30 hover:shadow-red-500/5' },
  amber:   { icon: 'bg-amber-500/10 text-amber-400',     value: 'text-amber-400',   bar: 'bg-amber-500',   ring: 'hover:border-amber-500/30 hover:shadow-amber-500/5' },
  sky:     { icon: 'bg-sky-500/10 text-sky-400',         value: 'text-sky-400',     bar: 'bg-sky-500',     ring: 'hover:border-sky-500/30 hover:shadow-sky-500/5' },
  zinc:    { icon: 'bg-zinc-500/10 text-zinc-300',       value: 'text-white',       bar: 'bg-zinc-400',    ring: 'hover:border-zinc-600' },
} as const

export function TeamStatCard({ icon: Icon, label, value, accent = 'zinc', contextRatio, contextLabel }: TeamStatCardProps) {
  const a = ACCENT[accent]
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900 to-zinc-900/40 p-4',
        // hover: sube y brilla en escritorio. active: el tacto no dispara
        // hover, así que el móvil necesita su propia señal al tocar.
        'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] active:border-zinc-700',
        a.ring,
      )}
    >
      <div className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg', a.icon)}>
        <Icon className="h-4 w-4" />
      </div>

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={cn('mt-0.5 text-2xl font-black mono tabular-nums', a.value)}>{value}</p>

      {contextRatio != null && (
        <div className="mt-3">
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={cn('h-full rounded-full transition-all duration-500', a.bar)}
              style={{ width: `${Math.round(Math.min(1, Math.max(0, contextRatio)) * 100)}%` }}
            />
          </div>
          {contextLabel && <p className="mt-1 text-[10px] text-zinc-600">{contextLabel}</p>}
        </div>
      )}

      {/* Elemento "parcialmente flotante": un brillo sutil que solo aparece
          en hover, para dar profundidad sin saturar el estado por defecto. */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-20',
          a.bar,
        )}
      />
    </div>
  )
}
