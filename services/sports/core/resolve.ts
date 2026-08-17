/**
 * EJECUTOR DE CADENAS DE PROVEEDORES.
 *
 * Es el corazón del desacople: recibe una cadena ordenada y una operación,
 * y devuelve siempre un `DataResult` — nunca lanza. La interfaz recibe uno de
 * tres estados y ya sabe qué pintar:
 *
 *   ok          → hay dato
 *   unsupported → ninguna fuente cubre esto (se oculta la sección, no se
 *                 muestra un vacío que se leería como "no hay nada")
 *   error       → falló; con `retryable` para decidir si reintentar
 *
 * Reglas de la cadena, en este orden:
 *  1. Un proveedor que no declara la capacidad se salta sin gastar red.
 *  2. Un `not_found` NO pasa al siguiente: el recurso no existe y preguntar
 *     otra vez a otra fuente sería tratarlo como avería.
 *  3. Cualquier otro fallo cae al siguiente proveedor de la cadena.
 *  4. Si todos fallan, se devuelve el error del PRIMERO — el primario es el
 *     que explica mejor qué pasa; el respaldo suele fallar por otra razón.
 */

import { isProviderError, logLine, userMessage } from './errors'
import { memo, cacheKey } from './cache'
import type { SportsProvider } from './ports'
import { supports } from './ports'
import type { Capability, DataResult, ProviderId, Sourced } from './types'

export interface RunOptions<P extends SportsProvider, T> {
  /** Cadena en orden de preferencia. */
  chain: P[]
  /** Capacidad exigida. Quien no la declare se salta. */
  capability: Capability
  /** Operación a ejecutar. Devuelve `undefined` si el proveedor no la implementa. */
  run: (provider: P) => Promise<Sourced<T>> | undefined
  /** Clave de memo en proceso. Sin ella no se memoiza. */
  cache?: { key: (string | number | undefined)[]; ttlSeconds: number }
  /** Texto que explica al desarrollador por qué nadie cubre esto. */
  unsupportedReason?: string
}

export async function runChain<P extends SportsProvider, T>(
  opts: RunOptions<P, T>,
): Promise<DataResult<T>> {
  const exec = () => attempt(opts)
  if (!opts.cache) return exec()
  return memo(cacheKey([opts.capability, ...opts.cache.key]), opts.cache.ttlSeconds, exec)
}

async function attempt<P extends SportsProvider, T>(opts: RunOptions<P, T>): Promise<DataResult<T>> {
  const capable = opts.chain.filter((p) => supports(p, opts.capability))

  if (capable.length === 0) {
    const provider: ProviderId = opts.chain[0]?.id ?? 'espn'
    return {
      status: 'unsupported',
      provider,
      reason: opts.unsupportedReason
        ?? `Ninguna fuente configurada cubre «${opts.capability}».`,
    }
  }

  let firstError: DataResult<T> | null = null

  for (const provider of capable) {
    const promise = opts.run(provider)
    if (!promise) continue // declara la capacidad pero no implementa el método

    try {
      const { data, provenance } = await promise
      return { status: 'ok', data, provenance, stale: false }
    } catch (e) {
      // El log técnico se queda en el servidor; al usuario le llega otra cosa.
      console.warn(`[sports] ${logLine(e)}`)

      const result: DataResult<T> = {
        status: 'error',
        reason: userMessage(e),
        retryable: isProviderError(e) ? e.retryable : false,
        provider: provider.id,
      }
      firstError ??= result

      // El recurso no existe: cambiar de fuente no lo va a hacer aparecer.
      if (isProviderError(e) && e.kind === 'not_found') return result
    }
  }

  return firstError ?? {
    status: 'unsupported',
    provider: capable[0].id,
    reason: `Ningún proveedor implementa «${opts.capability}».`,
  }
}

/** Azúcar para leer un `DataResult` sin ramificar: devuelve el dato o el respaldo. */
export function dataOr<T>(r: DataResult<T>, fallback: T): T {
  return r.status === 'ok' ? r.data : fallback
}

/** ¿Se pudo servir? Útil para decidir si una sección aparece o no. */
export function isOk<T>(r: DataResult<T>): r is Extract<DataResult<T>, { status: 'ok' }> {
  return r.status === 'ok'
}
