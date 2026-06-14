/**
 * UI de carga global. Next.js la muestra al instante al navegar mientras el
 * Server Component obtiene los datos, dando sensacion de fluidez en vez de
 * que la pagina se sienta "congelada".
 */
export default function Loading() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center p-10">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
        <p className="text-xs text-zinc-500">Cargando…</p>
      </div>
    </div>
  )
}
