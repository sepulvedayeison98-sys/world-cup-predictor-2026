import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Panel unificado de "Confianza del motor" multideporte (dashboard raíz).
 * Punto neutral de integración: recibe una fila por deporte ya calculada
 * (el dashboard computa los valores desde cada dominio) y la muestra con el
 * MISMO patrón honesto — precisión medida, tamaño de muestra y línea base
 * propia de cada deporte. Sin datos → se declara, no se rellena.
 */
export interface EngineConfidenceRow {
  sport: string
  label: string
  /** Precisión medida en % (0-100) o null si aún no hay muestra. */
  accuracy: number | null
  /** Texto del detalle: muestra + contexto (p. ej. "312/480 · azar 33%"). */
  detail: string
  href: string
  accent?: boolean
}

export function EngineConfidencePanel({ rows }: { rows: EngineConfidenceRow[] }) {
  return (
    <section aria-label="Confianza del motor" className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Confianza del motor</p>
        <span className="text-[11px] text-zinc-600">precisión medida por deporte</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
        {rows.map((r) => (
          <Link
            key={r.sport}
            href={r.href}
            className="group rounded-lg -m-1 p-1 transition-colors hover:bg-zinc-800/40"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{r.label}</p>
            <p className={cn('mt-0.5 text-2xl font-bold mono', r.accuracy != null ? (r.accent ? 'text-emerald-400' : 'text-white') : 'text-zinc-600')}>
              {r.accuracy != null ? `${r.accuracy.toFixed(1)}%` : '—'}
            </p>
            <p className="text-[11px] leading-tight text-zinc-500">{r.detail}</p>
          </Link>
        ))}
      </div>

      <p className="mt-3 border-t border-zinc-800 pt-2.5 text-[11px] text-zinc-600">
        Líneas base honestas por deporte (azar 33% en 1X2 de fútbol; 50% en
        ganador de NBA y tenis). Cada cifra es verificable en la metodología de
        su deporte.
      </p>
    </section>
  )
}
