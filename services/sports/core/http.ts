/**
 * Cliente HTTP compartido por todos los proveedores.
 *
 * Concentra en un solo sitio lo que si no se copia mal cinco veces: timeout
 * real (AbortController, no una promesa que se resuelve tarde), reintentos
 * con backoff SOLO para fallos reintentables, y traducción de cualquier
 * desenlace a `ProviderError`. Un adapter nunca ve un `fetch` en crudo.
 *
 * Módulo NEUTRO.
 */

import { ProviderError, kindFromStatus, redactUrl } from './errors'
import type { ProviderErrorKind } from './errors'
import type { ProviderId, Provenance } from './types'

export interface RequestOptions {
  provider: ProviderId
  /** Ruta legible para logs y procedencia; no incluye la clave. */
  endpoint: string
  headers?: Record<string, string>
  /** Milisegundos antes de abortar. Por debajo del techo de 60 s de Vercel Hobby. */
  timeoutMs?: number
  /** Reintentos ADICIONALES tras el primer intento. 0 = un solo intento. */
  retries?: number
  /** Segundos de revalidación del caché de datos de Next. `0` = sin caché. */
  revalidate?: number
  signal?: AbortSignal
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_RETRIES = 2

/**
 * Espera antes de reintentar: 400 ms, 800 ms, 1600 ms…
 *
 * El límite de cuota va aparte y arranca mucho más arriba. Los límites de
 * api-sports se miden POR MINUTO, así que esperar 400 ms y volver a pegar es
 * garantizar el segundo rechazo — y gastar otra petición de la cuota diaria
 * en él. Con 2 s, 4 s y 8 s el reintento cae ya fuera de la ráfaga.
 */
function backoffMs(attempt: number, kind: ProviderErrorKind): number {
  const base = kind === 'rate_limit' ? 2_000 : 400
  return base * 2 ** attempt
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Pide JSON y lo devuelve tipado junto con su procedencia.
 *
 * El tipo `T` es una PROMESA DEL ADAPTER, no una garantía: `requestJson` no
 * valida la forma. Validar es responsabilidad del adapter, que es quien sabe
 * qué campos necesita y puede lanzar `parse` con criterio.
 */
export async function requestJson<T>(
  url: string,
  opts: RequestOptions,
): Promise<{ body: T; provenance: Provenance }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retries = opts.retries ?? DEFAULT_RETRIES

  let lastError: ProviderError | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    // Si quien llama cancela (navegación, cierre de request), cancelamos también.
    const onAbort = () => controller.abort()
    opts.signal?.addEventListener('abort', onAbort, { once: true })

    try {
      const res = await fetch(url, {
        headers: opts.headers,
        signal: controller.signal,
        ...(opts.revalidate === undefined || opts.revalidate === 0
          ? { cache: 'no-store' as const }
          : { next: { revalidate: opts.revalidate } }),
      })

      if (!res.ok) {
        throw new ProviderError({
          kind: kindFromStatus(res.status),
          provider: opts.provider,
          endpoint: opts.endpoint,
          status: res.status,
          message: `${opts.provider} ${opts.endpoint} → HTTP ${res.status}`,
        })
      }

      let body: T
      try {
        body = (await res.json()) as T
      } catch (cause) {
        // 200 con cuerpo ilegible: no es reintentable, la fuente cambió algo.
        throw new ProviderError({
          kind: 'parse',
          provider: opts.provider,
          endpoint: opts.endpoint,
          status: res.status,
          message: `${opts.provider} ${opts.endpoint}: respuesta no es JSON válido`,
          cause,
        })
      }

      return {
        body,
        provenance: {
          provider: opts.provider,
          endpoint: opts.endpoint,
          fetchedAt: new Date().toISOString(),
        },
      }
    } catch (e) {
      lastError = normalize(e, opts, url)
      if (!lastError.retryable || attempt === retries) break
      await sleep(backoffMs(attempt, lastError.kind))
    } finally {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
    }
  }

  throw lastError ?? new ProviderError({
    kind: 'upstream',
    provider: opts.provider,
    endpoint: opts.endpoint,
    message: `${opts.provider} ${redactUrl(url)}: fallo sin diagnóstico`,
  })
}

/** Convierte cualquier excepción de `fetch` en un `ProviderError` clasificado. */
function normalize(e: unknown, opts: RequestOptions, url: string): ProviderError {
  if (e instanceof ProviderError) return e

  // AbortError cubre dos casos distintos: nuestro timeout y la cancelación de
  // quien llama. Solo el primero merece reintento; el segundo ya no interesa.
  const aborted = e instanceof Error && e.name === 'AbortError'
  if (aborted && opts.signal?.aborted) {
    return new ProviderError({
      kind: 'upstream', provider: opts.provider, endpoint: opts.endpoint,
      message: 'petición cancelada por el cliente', cause: e,
    })
  }
  if (aborted) {
    return new ProviderError({
      kind: 'timeout', provider: opts.provider, endpoint: opts.endpoint,
      message: `${opts.provider} ${opts.endpoint}: timeout tras ${opts.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms`,
      cause: e,
    })
  }

  return new ProviderError({
    kind: 'unavailable',
    provider: opts.provider,
    endpoint: opts.endpoint,
    message: `${opts.provider} ${redactUrl(url)}: red no disponible`,
    cause: e,
  })
}

/** Construye un query string omitiendo `undefined` y `null`. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}
