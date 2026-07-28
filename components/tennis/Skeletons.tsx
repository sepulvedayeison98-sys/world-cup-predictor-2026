/**
 * DOMINIO TENNIS — esqueletos de carga (auditoría UX). Reemplazan al spinner
 * genérico en las rutas con más datos: reservan el mismo espacio que el
 * contenido real, así la página no "salta" al llegar los datos (CLS ≈ 0) y
 * la espera se percibe más corta.
 *
 * `animate-pulse` respeta automáticamente `prefers-reduced-motion` por la
 * regla global de globals.css.
 */

function Bar({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-zinc-800/70 ${className}`} />
}

/** Bloque de título + descripción de cabecera de página. */
export function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Bar className="h-3 w-32" />
      <Bar className="h-7 w-56" />
      <Bar className="h-4 w-full max-w-2xl" />
    </div>
  )
}

/** Fila de tarjetas KPI. */
export function StatsRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <Bar className="h-3 w-24" />
          <Bar className="mt-2 h-6 w-20" />
          <Bar className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

/** Tabla genérica con cabecera y n filas. */
export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-3 py-2.5">
        <Bar className="h-3 w-40" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-zinc-800/60 px-3 py-2.5 last:border-0">
          <Bar className="h-4 w-8 shrink-0" />
          <Bar className="h-4 flex-1 max-w-[220px]" />
          <Bar className="ml-auto h-4 w-14 shrink-0" />
        </div>
      ))}
    </div>
  )
}

/** Envoltorio con el mismo padding que las páginas del dominio. */
export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex animate-pulse flex-col gap-6 p-4 lg:p-6" aria-hidden="true">
      {children}
      <span className="sr-only" aria-live="polite">Cargando contenido…</span>
    </div>
  )
}
