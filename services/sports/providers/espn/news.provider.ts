/**
 * Proveedor de NOTICIAS sobre ESPN — el único, y por eso vale la pena decir
 * por qué.
 *
 * El módulo de noticias no tenía fuente. Las alternativas con clave (NewsAPI,
 * GNews) devuelven prensa generalista filtrada por palabra clave: ruido, y de
 * pago. ESPN publica un feed por liga y por circuito, con titular, entradilla,
 * imagen, firma y fecha, sin clave. Para una plataforma que contextualiza
 * partidos concretos, un feed atado a la competición vale más que un buscador.
 *
 * Se guarda el enlace al original y la firma: aquí no se reescribe ni se
 * republica contenido ajeno, se enlaza.
 */

import { TTL } from '../../core/cache'
import type { NewsDataProvider, NewsQuery } from '../../core/ports'
import { ref } from '../../core/ports'
import type { Capability, NewsArticle, Sourced, SportKey } from '../../core/types'
import { espn } from './client'
import { ESPN } from './normalize'
import type { EspnNewsResponse } from './shapes'

/** Ámbito por defecto de cada deporte cuando quien llama no pide uno. */
const DEFAULT_SCOPE: Record<SportKey, string> = {
  futbol: 'soccer/eng.1',
  baloncesto: 'basketball/nba',
  tenis: 'tennis/atp',
}

/**
 * Ámbitos válidos por deporte. La lista es blanca a propósito: `scope` acaba
 * dentro de una URL, y aceptar texto libre convertiría el parámetro en un
 * hueco por el que pedir rutas arbitrarias del host.
 */
export const NEWS_SCOPES: Record<SportKey, readonly string[]> = {
  futbol: ['soccer/eng.1', 'soccer/esp.1', 'soccer/ita.1', 'soccer/ger.1', 'soccer/fra.1', 'soccer/col.1', 'soccer/uefa.champions'],
  baloncesto: ['basketball/nba'],
  tenis: ['tennis/atp', 'tennis/wta'],
}

export function resolveScope(sport: SportKey, scope: string | undefined): string {
  if (scope && NEWS_SCOPES[sport].includes(scope)) return scope
  return DEFAULT_SCOPE[sport]
}

const CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>(['news'])

export const espnNewsProvider: NewsDataProvider = {
  id: ESPN,
  capabilities: CAPABILITIES,
  quotaCostPerCall: 0,

  async getNews(query: NewsQuery): Promise<Sourced<NewsArticle[]>> {
    const scope = resolveScope(query.sport, query.scope)
    const path = `${scope}/news`
    const { body, provenance } = await espn.site<EspnNewsResponse>(path, {}, TTL.news)

    const articles: NewsArticle[] = []
    for (const a of body.articles ?? []) {
      const url = a.links?.web?.href ?? a.links?.mobile?.href
      // Sin titular o sin enlace no hay noticia que mostrar: se descarta en
      // vez de pintar una tarjeta que no lleva a ninguna parte.
      if (!a.headline || !url || a.id === undefined) continue
      articles.push({
        ref: ref(ESPN, a.id),
        sport: query.sport,
        scope,
        headline: a.headline,
        description: a.description ?? null,
        url,
        imageUrl: a.images?.[0]?.url ?? a.images?.[0]?.href ?? null,
        publishedAt: a.published ? new Date(a.published).toISOString() : null,
        byline: a.byline ?? null,
        type: a.type ?? null,
      })
    }
    return { data: query.limit ? articles.slice(0, query.limit) : articles, provenance }
  },
}
