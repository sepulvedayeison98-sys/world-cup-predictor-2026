'use client'

import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * Error boundary global (AUDIT 🟡-11): ninguna página vuelve a caer en la
 * pantalla genérica de Next.js. Estado honesto: dice que algo falló, deja
 * reintentar y registra el error en consola para diagnóstico.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[error-boundary]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
        Algo salió mal
      </span>
      <h1 className="text-xl font-bold text-white">No pudimos cargar esta sección</h1>
      <p className="max-w-md text-sm text-zinc-400">
        Suele ser un problema temporal de conexión con la base de datos.
        Reintenta; si persiste, vuelve en unos minutos.
        {error.digest && (
          <span className="mt-2 block text-[11px] text-zinc-600 mono">ref: {error.digest}</span>
        )}
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
      >
        <RefreshCw className="h-4 w-4" /> Reintentar
      </button>
    </div>
  )
}
