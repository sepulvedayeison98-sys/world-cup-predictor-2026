/**
 * TAXONOMÍA DE ERRORES DE PROVEEDOR.
 *
 * Un fallo de una API externa tiene que llegar a la interfaz convertido en
 * dos cosas: una decisión (¿reintento?, ¿sirvo caché vieja?, ¿oculto la
 * sección?) y una frase en español que un usuario entienda. Nunca un stack
 * trace, nunca un "HTTP 429", nunca el nombre de la casa de apuestas que
 * falló.
 *
 * Módulo NEUTRO: sin dependencias del proyecto.
 */

import type { ProviderId } from './types'

export type ProviderErrorKind =
  /** Falta la clave o está mal configurada. Culpa nuestra, no de la fuente. */
  | 'config'
  /** La fuente rechazó la clave (401/403). */
  | 'auth'
  /** Cuota agotada (429, o el `errors` de api-sports). Reintentable más tarde. */
  | 'rate_limit'
  /** El recurso no existe (404, o respuesta vacía para un id concreto). */
  | 'not_found'
  /** Se agotó el tiempo de espera. Reintentable. */
  | 'timeout'
  /** 5xx o red caída. Reintentable. */
  | 'unavailable'
  /** Respondió 200 pero el cuerpo no tiene la forma esperada. NO reintentable. */
  | 'parse'
  /** Cualquier otro fallo aguas arriba. */
  | 'upstream'

const RETRYABLE: ReadonlySet<ProviderErrorKind> = new Set<ProviderErrorKind>([
  'rate_limit', 'timeout', 'unavailable',
])

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind
  readonly provider: ProviderId
  readonly endpoint: string
  readonly status: number | null
  readonly retryable: boolean

  constructor(opts: {
    kind: ProviderErrorKind
    provider: ProviderId
    endpoint: string
    message?: string
    status?: number | null
    cause?: unknown
  }) {
    super(opts.message ?? `${opts.provider} ${opts.endpoint}: ${opts.kind}`, { cause: opts.cause })
    this.name = 'ProviderError'
    this.kind = opts.kind
    this.provider = opts.provider
    this.endpoint = opts.endpoint
    this.status = opts.status ?? null
    this.retryable = RETRYABLE.has(opts.kind)
  }
}

export function isProviderError(e: unknown): e is ProviderError {
  return e instanceof ProviderError
}

/** Clasifica un código HTTP en un tipo de error de proveedor. */
export function kindFromStatus(status: number): ProviderErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 404) return 'not_found'
  if (status === 408) return 'timeout'
  if (status === 429) return 'rate_limit'
  if (status >= 500) return 'unavailable'
  return 'upstream'
}

/**
 * Mensajes en español para el usuario final. Explican qué pasa y qué esperar,
 * sin detalle técnico y sin nombrar al proveedor: quién nos sirve los datos es
 * una decisión interna, no información útil para quien mira la pantalla.
 */
const USER_MESSAGES: Record<ProviderErrorKind, string> = {
  config:      'Esta sección todavía no está configurada. Volverá en cuanto se active la fuente.',
  auth:        'No pudimos acceder a los datos ahora mismo. Ya estamos al tanto.',
  rate_limit:  'Alcanzamos el límite de consultas de hoy. Los datos se actualizarán pronto.',
  not_found:   'No encontramos esta información.',
  timeout:     'La consulta tardó demasiado. Inténtalo de nuevo en unos segundos.',
  unavailable: 'La fuente de datos no responde en este momento. Reintentando.',
  parse:       'Los datos llegaron incompletos. No los mostramos hasta poder verificarlos.',
  upstream:    'No pudimos cargar esta información ahora mismo.',
}

/** Frase lista para pintar en pantalla. Acepta cualquier `unknown` de un catch. */
export function userMessage(e: unknown): string {
  if (isProviderError(e)) return USER_MESSAGES[e.kind]
  return USER_MESSAGES.upstream
}

/**
 * Resumen técnico para logs del servidor. Incluye endpoint y estado, pero
 * NUNCA la query completa: las claves de api-sports viajan en cabecera, pero
 * The Odds API las lleva en el query string y no deben acabar en un log.
 */
export function logLine(e: unknown): string {
  if (!isProviderError(e)) return `error desconocido: ${e instanceof Error ? e.message : String(e)}`
  return `[${e.provider}] ${e.endpoint} → ${e.kind}${e.status ? ` (HTTP ${e.status})` : ''}`
}

/** Quita el valor de cualquier parámetro sensible de una URL antes de loguearla. */
const SENSITIVE_PARAMS = ['apikey', 'api_key', 'key', 'token', 'secret']

export function redactUrl(url: string): string {
  try {
    const u = new URL(url)
    for (const [k] of u.searchParams) {
      if (SENSITIVE_PARAMS.includes(k.toLowerCase())) u.searchParams.set(k, '***')
    }
    return u.toString()
  } catch {
    return url
  }
}
