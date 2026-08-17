/**
 * SERVICIO DE TENIS — independiente de fútbol y de NBA.
 *
 * Cubre el PRESENTE del circuito: ranking vigente, torneos de la temporada,
 * partidos con sets y ganador. El histórico profundo (los CSV de Sackmann que
 * alimentan el backtesting) sigue donde estaba, en `services/tennis/`: son dos
 * necesidades distintas y mezclarlas volvería frágil el motor.
 *
 * ATP y WTA se mantienen separados en cada llamada, tal y como exige el
 * principio de independencia entre circuitos: nada aquí agrega los dos.
 */

import { TTL } from '../core/cache'
import { tennisProviders } from '../core/registry'
import { runChain } from '../core/resolve'
import type { TennisMatchQuery } from '../core/ports'
import type {
  DataResult, TennisMatch, TennisRankingEntry, TennisTour, TennisTournament,
} from '../core/types'

export const tennisService = {
  getRankings(tour: TennisTour, limit?: number): Promise<DataResult<TennisRankingEntry[]>> {
    return runChain({
      chain: tennisProviders(),
      capability: 'rankings',
      cache: { key: ['tenis', 'rankings', tour, limit], ttlSeconds: TTL.standings },
      run: (p) => p.getRankings?.(tour, limit),
    })
  },

  getTournaments(tour: TennisTour, season?: number): Promise<DataResult<TennisTournament[]>> {
    return runChain({
      chain: tennisProviders(),
      capability: 'tournaments',
      cache: { key: ['tenis', 'tournaments', tour, season], ttlSeconds: TTL.catalog },
      run: (p) => p.getTournaments?.(tour, season),
      unsupportedReason: 'La fuente activa no publica calendario de torneos.',
    })
  },

  /**
   * Partidos individuales. Los dobles se descartan en el adapter: el motor
   * de la casa modela jugador contra jugador y mezclarlos falsearía la forma.
   */
  getMatches(query: TennisMatchQuery): Promise<DataResult<TennisMatch[]>> {
    const cacheable = query.state !== 'live'
    return runChain({
      chain: tennisProviders(),
      capability: 'matches',
      cache: cacheable
        ? {
            key: ['tenis', 'matches', query.tour, query.date, query.season, query.tournamentId, query.playerId, query.state, query.limit],
            ttlSeconds: query.state === 'finished' ? TTL.historical : TTL.schedule,
          }
        : undefined,
      run: (p) => p.getMatches?.(query),
    })
  },

  getHeadToHead(tour: TennisTour, playerA: string, playerB: string): Promise<DataResult<TennisMatch[]>> {
    return runChain({
      chain: tennisProviders(),
      capability: 'h2h',
      cache: { key: ['tenis', 'h2h', tour, playerA, playerB], ttlSeconds: TTL.historical },
      run: (p) => p.getHeadToHead?.(playerA, playerB),
      unsupportedReason:
        'La fuente en vivo no expone historial directo; el H2H histórico se sirve desde la base de datos.',
    })
  },
}
