/**
 * DOMINIO TENNIS — átomos de presentación (Fase 8). Componentes puros de
 * render, sin estado. Estilo oscuro Bloomberg/TradingView; acento del
 * dominio en lima (TENNIS_ACCENT), distinto del esmeralda global.
 */
import { SURFACE_LABELS, ROUND_LABELS, type Surface } from '@/lib/tennis/constants'
import { cn } from '@/lib/utils'

const SURFACE_STYLE: Record<string, string> = {
  hard: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
  clay: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  grass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  carpet: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
}

export function SurfaceBadge({ surface }: { surface: string | null }) {
  if (!surface) return null
  const key = surface.toLowerCase()
  const label = SURFACE_LABELS[key as Surface] ?? surface
  return (
    <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium',
      SURFACE_STYLE[key] ?? 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40')}>
      {label}
    </span>
  )
}

export function roundLabel(round: string | null): string {
  if (!round) return ''
  return ROUND_LABELS[round] ?? round
}

export function handLabel(hand: 'R' | 'L' | null): string {
  return hand === 'R' ? 'Diestro' : hand === 'L' ? 'Zurdo' : '—'
}

/** Fecha corta en español a partir de la granularidad de la fuente (día). */
export function shortDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** Bandera emoji a partir del código de país ISO-3 (best-effort; ISO-2 real). */
const ISO3_TO_2: Record<string, string> = {
  ESP: 'ES', ARG: 'AR', SRB: 'RS', ITA: 'IT', USA: 'US', GBR: 'GB', FRA: 'FR',
  GER: 'DE', SUI: 'CH', RUS: 'RU', AUS: 'AU', CAN: 'CA', GRE: 'GR', NOR: 'NO',
  DEN: 'DK', POL: 'PL', CRO: 'HR', AUT: 'AT', NED: 'NL', BUL: 'BG', CZE: 'CZ',
  CHI: 'CL', BRA: 'BR', JPN: 'JP', KAZ: 'KZ', HUN: 'HU', FIN: 'FI', BEL: 'BE',
  SWE: 'SE', POR: 'PT', SVK: 'SK', RSA: 'ZA', CHN: 'CN', IND: 'IN', MDA: 'MD',
}
export function countryFlag(code: string | null): string {
  if (!code) return ''
  const two = ISO3_TO_2[code.toUpperCase()] ?? (code.length === 2 ? code.toUpperCase() : '')
  if (two.length !== 2) return ''
  return String.fromCodePoint(...[...two].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

/** Tarjeta KPI reutilizable. */
export function StatCard({ label, value, hint, accent }: {
  label: string; value: string; hint?: string; accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={cn('mt-1 text-xl font-bold mono', accent ? 'text-lime-400' : 'text-white')}>{value}</p>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}
