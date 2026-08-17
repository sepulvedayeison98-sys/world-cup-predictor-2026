/**
 * Cliente de las APIs públicas de ESPN.
 *
 * Sin clave y sin cuota declarada, cubre los tres deportes de la casa. Es la
 * fuente que desbloquea la temporada NBA en curso (api-basketball sigue en
 * plan Free, 100 req/día) y el calendario ATP actual (que estaba declarado
 * "pendiente de compra" en la arquitectura de tenis).
 *
 * Dos hosts, y la diferencia importa:
 *
 *   · site.api.espn.com/apis/site/v2  → equipos, calendario, marcadores, noticias
 *   · site.web.api.espn.com/apis/v2   → clasificaciones (el otro host devuelve `{}`)
 *
 * Contrapartida honesta de ser gratis: no hay contrato de servicio ni versión
 * estable. Por eso ESPN es PRIMARIO donde no hay alternativa pagada (NBA,
 * tenis, noticias) y SECUNDARIO en fútbol, donde manda API-Football.
 */

import { requestJson, qs } from '../../core/http'
import { TTL } from '../../core/cache'
import type { Provenance } from '../../core/types'

export const ESPN_SITE_HOST = 'https://site.api.espn.com/apis/site/v2/sports'
export const ESPN_WEB_HOST = 'https://site.web.api.espn.com/apis/v2/sports'

/** Ruta de deporte en ESPN: `<sport>/<league>`. */
export interface EspnPath {
  sport: 'soccer' | 'basketball' | 'tennis'
  league: string // "eng.1", "nba", "atp"
}

export function espnPath(p: EspnPath): string {
  return `${p.sport}/${p.league}`
}

async function get<T>(
  host: string,
  path: string,
  params: Record<string, string | number | undefined>,
  revalidate: number,
): Promise<{ body: T; provenance: Provenance }> {
  return requestJson<T>(`${host}/${path}${qs(params)}`, {
    provider: 'espn',
    endpoint: path,
    revalidate,
    timeoutMs: 8_000,
  })
}

export const espn = {
  /** Endpoints del host `site` (equipos, calendario, noticias). */
  site<T>(path: string, params: Record<string, string | number | undefined> = {}, revalidate = TTL.schedule) {
    return get<T>(ESPN_SITE_HOST, path, params, revalidate)
  },
  /** Endpoints del host `web` (clasificaciones). */
  web<T>(path: string, params: Record<string, string | number | undefined> = {}, revalidate = TTL.standings) {
    return get<T>(ESPN_WEB_HOST, path, params, revalidate)
  },
}

/** ESPN pide las fechas como YYYYMMDD; nosotros manejamos ISO en todas partes. */
export function toEspnDate(isoDate: string): string {
  return isoDate.slice(0, 10).replace(/-/g, '')
}
