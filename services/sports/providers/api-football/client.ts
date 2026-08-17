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
import type { Provenance } from '../../core/types'

export const API_FOOTBALL = 'api-football' as const

const DEFAULT_HOST = 'v3.football.api-sports.io'

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
 * `revalidate` en segundos: quien llama decide, porque el TTL correcto
 * depende del dato (una plantilla no caduca como un marcador).
 */
export async function apiFootball<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  revalidate = 0,
): Promise<{ data: T[]; provenance: Provenance; paging: { current: number; total: number } }> {
  const { host, headers } = config()
  const url = `https://${host}${path}${qs(params)}`

  const { body, provenance } = await requestJson<ApiFootballEnvelope<T>>(url, {
    provider: API_FOOTBALL,
    endpoint: path,
    headers,
    revalidate,
    timeoutMs: 12_000,
  })

  const errs = body.errors
  const messages = Array.isArray(errs) ? errs : Object.values(errs ?? {})
  if (messages.length > 0) {
    const text = messages.join('; ')
    throw new ProviderError({
      kind: classify(text), provider: API_FOOTBALL, endpoint: path,
      message: `${path}: ${text}`,
    })
  }

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
