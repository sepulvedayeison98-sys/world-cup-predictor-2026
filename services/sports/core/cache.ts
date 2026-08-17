/**
 * POLÍTICA DE CACHÉ POR CLASE DE DATO.
 *
 * El error caro sería un TTL único: un estadio no cambia en un año y un
 * marcador en vivo caduca en segundos. Aquí se declara cuánto vive cada
 * clase, y el resto del código pide TTL por NOMBRE, nunca por número — así
 * el ajuste se hace en un sitio y se razona sobre él.
 *
 * Dos niveles, complementarios:
 *
 *  · `revalidate` de Next — caché HTTP compartida entre invocaciones.
 *    Es la que de verdad ahorra cuota de API.
 *  · `memo` en proceso — evita que una misma request repita la llamada
 *    (p. ej. cinco componentes pidiendo la misma clasificación). Vive lo
 *    que viva la instancia serverless: es un extra, no la defensa principal.
 *
 * Módulo NEUTRO.
 */

/**
 * TTL en SEGUNDOS por clase de dato. Los valores salen de con qué frecuencia
 * cambia la realidad, no de cuánta cuota queremos gastar.
 */
export const TTL = {
  /** Estadios, países, escudos, datos de fundación. Cambian casi nunca. */
  static: 24 * 60 * 60,
  /** Competiciones y temporadas: se abren y cierran unas pocas veces al año. */
  catalog: 12 * 60 * 60,
  /** Plantillas y fichas de jugador: se mueven en mercados de fichajes. */
  roster: 6 * 60 * 60,
  /** Calendario de próximos partidos: reprogramaciones, horarios de TV. */
  schedule: 30 * 60,
  /** Clasificaciones: solo cambian cuando termina una jornada. */
  standings: 15 * 60,
  /** Estadísticas agregadas de equipo/jugador de la temporada en curso. */
  seasonStats: 60 * 60,
  /** Lesiones y bajas: los partes médicos salen a cuentagotas. */
  injuries: 60 * 60,
  /** Alineaciones: se publican ~1 h antes y ya no cambian. */
  lineups: 10 * 60,
  /** Noticias. */
  news: 15 * 60,
  /** Cuotas: se mueven de continuo, pero cada consulta cuesta cuota. */
  odds: 5 * 60,
  /** Marcadores en vivo. */
  live: 30,
  /** Resultados y estadísticas de partidos ya cerrados: inmutables. */
  historical: 7 * 24 * 60 * 60,
} as const

export type TtlKey = keyof typeof TTL

// ─── Memo en proceso ─────────────────────────────────────────────────────────

interface Entry<T> {
  value: T
  expiresAt: number
}

/**
 * Tope de entradas. Sin él, un bucle sobre 500 jugadores dejaría 500 payloads
 * vivos en una lambda con memoria limitada. Al llegar al tope se descarta la
 * entrada más antigua (FIFO por orden de inserción de Map).
 */
const MAX_ENTRIES = 200

const store = new Map<string, Entry<unknown>>()

/** Reloj inyectable: los tests necesitan controlar el paso del tiempo. */
let now = () => Date.now()

/** Solo para tests. Devuelve una función que restaura el reloj real. */
export function __setClock(fn: () => number): () => void {
  const prev = now
  now = fn
  return () => { now = prev }
}

function evictIfNeeded() {
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next()
    if (oldest.done) break
    store.delete(oldest.value)
  }
}

/**
 * Memoiza una promesa por clave durante `ttlSeconds`.
 *
 * Guarda la PROMESA, no el valor resuelto: dos llamadas concurrentes con la
 * misma clave comparten una sola petición de red en vez de lanzar dos. Si la
 * promesa acaba rechazando, la entrada se borra para no cachear el fallo.
 */
export async function memo<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.expiresAt > now()) return hit.value as T

  const promise = fn()
  store.set(key, { value: promise, expiresAt: now() + ttlSeconds * 1000 })
  evictIfNeeded()

  try {
    return await promise
  } catch (e) {
    // Un error no se cachea: la siguiente llamada debe poder reintentar.
    if (store.get(key)?.value === promise) store.delete(key)
    throw e
  }
}

/** Invalida una clave concreta o, con prefijo, toda una familia. */
export function invalidate(prefix: string): number {
  let n = 0
  for (const k of [...store.keys()]) {
    if (k === prefix || k.startsWith(`${prefix}:`)) { store.delete(k); n++ }
  }
  return n
}

export function clearMemo(): void {
  store.clear()
}

export function memoSize(): number {
  return store.size
}

/** Clave de caché estable: el orden de los parámetros no debe crear duplicados. */
export function cacheKey(parts: (string | number | undefined | null)[]): string {
  return parts.filter((p) => p !== undefined && p !== null && p !== '').join(':')
}
