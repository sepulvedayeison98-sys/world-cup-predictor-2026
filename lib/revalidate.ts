import { revalidatePath } from 'next/cache'

/**
 * Revalidación por evento (docs/CACHE_STRATEGY.md, capa 3). Purga el caché ISR
 * de las páginas que muestran resultados/probabilidades apenas cambian los
 * datos, para que la frescura no dependa de esperar la ventana de `revalidate`.
 *
 * Best-effort: si se llama fuera de un contexto de request (p. ej. un script),
 * `revalidatePath` lanza y se ignora — nunca rompe el sync.
 */

// Páginas estáticas ISR que dependen de resultados de partidos
const RESULT_PATHS = [
  '/dashboard',
  '/matches',
  '/predictions',
  '/value-bets',
  '/mundial',
  '/mundial/balance',
  '/mundial/rankings',
  '/groups',
  '/bracket',
  '/champion',
  '/inteligencia',
]

/** Purga tras resolverse uno o más partidos (cadena post-resultado). */
export function revalidateAfterResults(): void {
  try {
    for (const p of RESULT_PATHS) revalidatePath(p)
    // Segmentos dinámicos: 'page' purga TODAS las instancias de golpe
    revalidatePath('/matches/[id]', 'page')
    revalidatePath('/equipos/[id]', 'page')
  } catch (e) {
    console.error('[revalidate] no-op (sin contexto de request):', (e as any)?.message)
  }
}

/** Purga tras recalibrar predicciones (solo las páginas con probabilidades). */
export function revalidatePredictionPaths(): void {
  try {
    for (const p of ['/dashboard', '/matches', '/predictions', '/value-bets']) revalidatePath(p)
    revalidatePath('/matches/[id]', 'page')
  } catch (e) {
    console.error('[revalidate] no-op (sin contexto de request):', (e as any)?.message)
  }
}
