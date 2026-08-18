/**
 * SERVICIO DE NOTICIAS.
 *
 * Módulo nuevo: hasta ahora la plataforma no tenía ninguna fuente de
 * actualidad. Devuelve titular, entradilla, imagen, firma y ENLACE AL
 * ORIGINAL — aquí no se reproduce contenido ajeno, se enlaza.
 *
 * El ámbito se valida contra una lista blanca en el proveedor: llega desde
 * la URL de una ruta pública y no puede convertirse en un hueco para pedir
 * rutas arbitrarias del host de origen.
 */

import { TTL } from '../core/cache'
import { newsProviders } from '../core/registry'
import { runChain } from '../core/resolve'
import type { NewsQuery } from '../core/ports'
import type { DataResult, NewsArticle, SportKey } from '../core/types'

export const newsService = {
  getNews(query: NewsQuery): Promise<DataResult<NewsArticle[]>> {
    return runChain({
      chain: newsProviders(),
      capability: 'news',
      cache: { key: ['news', query.sport, query.scope, query.limit], ttlSeconds: TTL.news },
      run: (p) => p.getNews(query),
      unsupportedReason: 'No hay fuente de noticias configurada para este deporte.',
    })
  },

  /** Portada de un deporte: el ámbito por defecto lo resuelve el proveedor. */
  headlines(sport: SportKey, limit = 6): Promise<DataResult<NewsArticle[]>> {
    return this.getNews({ sport, limit })
  },
}
