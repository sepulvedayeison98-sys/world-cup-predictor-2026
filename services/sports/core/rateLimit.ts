/**
 * Limitador de ritmo por proveedor (token bucket).
 *
 * Nace de un fallo observado, no de un presupone: durante la primera ingesta
 * de plantillas, API-Football devolvió
 *
 *   {"rateLimit":"Too many requests. You have exceeded the limit of
 *     requests per minute of your subscription."}
 *
 * La cuota DIARIA estaba intacta (unos cientos de 7.500). Lo que se agotó fue
 * el límite POR MINUTO, y contra eso acotar la concurrencia no basta: cuatro
 * peticiones simultáneas que tardan 200 ms dan 1.200 por minuto. Lo que hay
 * que limitar es el ritmo, no cuántas van a la vez.
 *
 * Es más barato esperar antes de salir que disculparse después.
 *
 * ── Alcance, dicho claro ──────────────────────────────────────────────────
 * El contador vive EN MEMORIA DEL PROCESO. En Vercel conviven varias
 * instancias de la función y cada una lleva su propia cuenta, así que esto
 * es un freno de mano, no una garantía: reduce las ráfagas, no las elimina.
 * Quien de verdad cierra el agujero es el reintento con backoff de
 * `core/http.ts`, que reacciona al rechazo cuando llega. Los dos juntos —
 * uno que previene y otro que se recupera— son lo que hace que la ingesta
 * termine completa.
 *
 * Módulo NEUTRO.
 */

interface Bucket {
  /** Marcas de tiempo (ms) de las peticiones dentro de la ventana. */
  hits: number[]
  limit: number
  windowMs: number
}

const buckets = new Map<string, Bucket>()

/** Reloj inyectable para los tests. Devuelve la función de restauración. */
let now = () => Date.now()
export function __setClock(fn: () => number): () => void {
  const prev = now
  now = fn
  return () => { now = prev }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Registra un límite. Idempotente: volver a declararlo no reinicia el
 * contador, solo ajusta el techo.
 */
export function configureLimit(key: string, limit: number, windowMs = 60_000): void {
  const existing = buckets.get(key)
  if (existing) { existing.limit = limit; existing.windowMs = windowMs; return }
  buckets.set(key, { hits: [], limit, windowMs })
}

/**
 * Espera lo justo para que la petición quepa dentro del límite, y la
 * contabiliza.
 *
 * Serializa la ESPERA, no la petición: quien llama sigue pudiendo lanzar
 * varias en paralelo, simplemente no salen todas en la misma ráfaga.
 */
export async function acquire(key: string): Promise<void> {
  const bucket = buckets.get(key)
  if (!bucket) return // sin límite declarado, no se estorba

  // Hasta 60 vueltas: con ventanas de un minuto es un techo de espera
  // razonable y evita cualquier posibilidad de bucle infinito.
  for (let guard = 0; guard < 60; guard++) {
    const t = now()
    const cutoff = t - bucket.windowMs
    // Descartar lo que ya salió de la ventana.
    while (bucket.hits.length > 0 && bucket.hits[0] <= cutoff) bucket.hits.shift()

    if (bucket.hits.length < bucket.limit) {
      bucket.hits.push(t)
      return
    }

    // Lleno: esperar a que expire la marca más antigua, con 50 ms de margen
    // para no despertar justo en el borde y volver a encontrarlo lleno.
    const waitMs = bucket.hits[0] + bucket.windowMs - t + 50
    await sleep(Math.max(waitMs, 10))
  }
}

/** Peticiones registradas ahora mismo dentro de la ventana. */
export function currentUsage(key: string): { used: number; limit: number } | null {
  const bucket = buckets.get(key)
  if (!bucket) return null
  const cutoff = now() - bucket.windowMs
  const used = bucket.hits.filter((h) => h > cutoff).length
  return { used, limit: bucket.limit }
}

/** Solo para tests. */
export function resetLimits(): void {
  buckets.clear()
}
