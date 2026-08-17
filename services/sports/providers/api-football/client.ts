/**
 * Cliente de API-Football (api-sports.io v3) — la fuente principal de fútbol.
 *
 * Plan Pro contratado: 7.500 peticiones/día, todas las temporadas. Es la
 * única fuente de la casa que cubre plantillas, lesiones, alineaciones y
 * estadísticas por jugador, y por eso manda en fútbol pese a costar dinero.
 *
 * Particularidad que este cliente absorbe: api-sports responde **200 con el
 * campo `errors` poblado** cuando algo falla de verdad (clave inválida, cuota
 * agotada, plan insuficiente). Un cliente HTTP normal lo daría por bueno. Aquí
 * se inspecciona y se convierte en el `ProviderError` que toca, para que la
 * cuota agotada se distinga de un fallo de red y active la política correcta.
 */

import { ProviderError } from '../../core/errors'
import { requestJson, qs } from '../../core/http'
import { acquire, configureLimit } from '../../core/rateLimit'
import type { Provenance } from '../../core/types'

export const API_FOOTBALL = 'api-football' as const

const DEFAULT_HOST = 'v3.football.api-sports.io'

/**
 * Techo de peticiones por minuto que nos imponemos.
 *
 * La cuota que se agota primero no es la diaria (7.500 en Pro) sino la de
 * POR MINUTO: la primera ingesta de plantillas la disparó con la diaria en
 * 61 de 7.500. El valor exacto del techo no está caracterizado —60
 * peticiones seguidas pasan y 8 simultáneas en frío también—, así que 30 es
 * una elección conservadora, no una medida. Ajustable con
 * `FOOTBALL_API_RPM`.
 *
 * Lo que este freno NO cubre: el contador vive en memoria del proceso y en
 * Vercel cada instancia lleva el suyo. La red que sí atrapa el rechazo
 * cuando llega es el reintento con backoff de `core/http.ts`.
 */
const REQUESTS_PER_MINUTE = ((): number => {
  const env = Number(process.env.FOOTBALL_API_RPM)
  return Number.isFinite(env) && env > 0 ? env : 30
})()

configureLimit(API_FOOTBALL, REQUESTS_PER_MINUTE)

export interface ApiFootballEnvelope<T> {
  errors?: Record<string, string> | string[]
  results?: number
  paging?: { current: number; total: number }
  response?: T[]
}

function config(): { host: string; headers: Record<string, string> } {
  const key = process.env.SPORTS_API_KEY
  if (!key) {
    throw new ProviderError({
      kind: 'config', provider: API_FOOTBALL, endpoint: '(config)',
      message: 'SPORTS_API_KEY no está configurada',
    })
  }
  const host = process.env.SPORTS_API_HOST || DEFAULT_HOST
  // La misma clave sirve vía RapidAPI o directo; cambian las cabeceras.
  const headers: Record<string, string> = host.includes('rapidapi')
    ? { 'x-rapidapi-key': key, 'x-rapidapi-host': host }
    : { 'x-apisports-key': key }
  return { host, headers }
}

/** Frases de `errors` que significan cuota agotada, no configuración rota. */
function classify(message: string): 'rate_limit' | 'auth' | 'upstream' {
  const m = message.toLowerCase()
  if (m.includes('rate limit') || m.includes('requests limit') || m.includes('too many')) return 'rate_limit'
  if (m.includes('token') || m.includes('subscription') || m.includes('not subscribed') || m.includes('plan')) return 'auth'
  return 'upstream'
}

/**
 * Pide un endpoint y devuelve el array `response` ya desenvuelto.
 *
 * ── Por qué este proveedor NO usa la caché de datos de Next ──────────────
 * api-sports señala sus errores con **HTTP 200 y el campo `errors` poblado**.
 * Para la caché de Next eso es una respuesta perfectamente buena, así que la
 * guardaba y la volvía a servir durante todo el TTL.
 *
 * El efecto fue difícil de leer y conviene dejarlo escrito: la ingesta
 * fallaba SIEMPRE en los mismos equipos y con las mismas cifras exactas
 * —585, 484, 494, 576— corrida tras corrida. Parecía un problema del
 * proveedor con ciertos equipos. No lo era: un rechazo puntual por ráfaga se
 * había quedado cacheado seis horas y se replicaba en cada corrida. El mismo
 * código, ejecutado fuera de Next, traía las seis ligas completas.
 *
 * Cachear la respuesta de una API que reporta errores en cuerpos 200 es
 * cachear sus fallos. El parámetro `revalidate` se mantiene por firma pero
 * se ignora a propósito; el ahorro de llamadas lo da el `memo` de la capa de
 * servicios, que sí distingue error de dato porque vive por encima de
 * `validate`.
 */
export async function apiFootball<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  _revalidate = 0,
): Promise<{ data: T[]; provenance: Provenance; paging: { current: number; total: number } }> {
  const { host, headers } = config()
  const url = `https://${host}${path}${qs(params)}`

  // Espera lo justo para no rebasar el límite por minuto. Va antes del
  // fetch a propósito: una petición rechazada por ráfaga gasta cuota diaria
  // igual que una buena.
  await acquire(API_FOOTBALL)

  const { body, provenance } = await requestJson<ApiFootballEnvelope<T>>(url, {
    provider: API_FOOTBALL,
    endpoint: path,
    headers,
    // Sin caché HTTP: ver la nota de arriba. Un 200 con `errors` es un
    // fallo que la caché no sabe distinguir de un acierto.
    revalidate: 0,
    timeoutMs: 12_000,
    // Va como `validate` y no después del await A PROPÓSITO: api-sports
    // devuelve 200 con `errors` poblado al agotar la ráfaga por minuto.
    // Comprobándolo aquí, el rechazo entra en el bucle de reintentos y
    // espera 2/4/8 s antes de volver; comprobándolo fuera, fallaba al
    // primer intento y el backoff no llegaba a ejecutarse nunca.
    validate: (raw) => {
      const envelope = raw as ApiFootballEnvelope<T>
      const errs = envelope?.errors
      const messages = Array.isArray(errs) ? errs : Object.values(errs ?? {})
      if (messages.length === 0) return
      const text = messages.join('; ')
      throw new ProviderError({
        kind: classify(text), provider: API_FOOTBALL, endpoint: path,
        message: `${path}: ${text}`,
      })
    },
  })

  return {
    data: body.response ?? [],
    provenance,
    paging: body.paging ?? { current: 1, total: 1 },
  }
}

export interface AccountStatus {
  plan: string
  requestsToday: number
  requestsLimitDay: number
  active: boolean
  subscriptionEnd: string | null
}

/** Estado de cuenta. Endpoint gratuito: no consume cuota. */
export async function accountStatus(): Promise<AccountStatus> {
  const { host, headers } = config()
  const { body } = await requestJson<{ response?: any }>(`https://${host}/status`, {
    provider: API_FOOTBALL, endpoint: '/status', headers, timeoutMs: 8_000,
  })
  const r = body.response
  return {
    plan: r?.subscription?.plan ?? 'desconocido',
    requestsToday: r?.requests?.current ?? 0,
    requestsLimitDay: r?.requests?.limit_day ?? 0,
    active: r?.subscription?.active ?? false,
    subscriptionEnd: r?.subscription?.end ?? null,
  }
}
