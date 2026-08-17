/**
 * SERVICIO DE CUOTAS — transversal a los tres deportes.
 *
 * Es el único módulo compartido a propósito: una cuota es una cuota, y el
 * proveedor indexa por su propia clave de deporte (`soccer_epl`,
 * `basketball_nba`, `tennis_atp`). Compartir el servicio NO cruza dominios:
 * cada deporte pide su clave y no ve las de los demás.
 *
 * El mapeo de nuestras ligas a claves del proveedor vive aquí, en un solo
 * sitio, en lugar de repartido por los procesos de sincronización.
 */

import { TTL } from '../core/cache'
import { oddsProviders } from '../core/registry'
import { runChain } from '../core/resolve'
import type { OddsQuery } from '../core/ports'
import type { DataResult, OddsSnapshot } from '../core/types'

/**
 * Claves de The Odds API para las competiciones de la casa.
 *
 * Las claves de fútbol usan las de la propia API; la de Colombia
 * (`soccer_colombia_primera_a`) existe pero su cobertura de casas es
 * irregular, y eso se documenta en vez de descubrirse en producción.
 */
export const ODDS_SPORT_KEYS = {
  premier_league: 'soccer_epl',
  la_liga: 'soccer_spain_la_liga',
  serie_a: 'soccer_italy_serie_a',
  bundesliga: 'soccer_germany_bundesliga',
  ligue_1: 'soccer_france_ligue_one',
  liga_betplay: 'soccer_colombia_primera_a',
  nba: 'basketball_nba',
  atp: 'tennis_atp',
  wta: 'tennis_wta',
} as const

export type OddsSportSlug = keyof typeof ODDS_SPORT_KEYS

export const oddsService = {
  /** Catálogo del proveedor: útil para verificar qué está activo hoy. */
  listSports(): Promise<DataResult<{ key: string; title: string; active: boolean }[]>> {
    return runChain({
      chain: oddsProviders(),
      capability: 'odds',
      cache: { key: ['odds', 'sports'], ttlSeconds: TTL.catalog },
      run: (p) => p.listSports?.(),
    })
  },

  /** Cuotas por clave del proveedor. Cada llamada gasta cuota mensual. */
  getOdds(query: OddsQuery): Promise<DataResult<OddsSnapshot[]>> {
    return runChain({
      chain: oddsProviders(),
      capability: 'odds',
      cache: { key: ['odds', query.sportKey, query.regions, query.markets], ttlSeconds: TTL.odds },
      run: (p) => p.getOdds(query),
    })
  },

  /** Atajo por competición de la casa. */
  getOddsFor(slug: OddsSportSlug, opts: { regions?: string; markets?: string } = {}) {
    return this.getOdds({ sportKey: ODDS_SPORT_KEYS[slug], ...opts })
  },
}
