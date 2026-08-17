/**
 * SERVICIO DE NBA — independiente de fútbol por diseño, no por casualidad.
 *
 * No importa nada del dominio de fútbol ni del de tenis, y la barrera de
 * ESLint lo verifica. Lo único compartido es la infraestructura neutra de
 * `core/` (HTTP, caché, errores), que no sabe de deportes.
 *
 * Diferencia real que se respeta en los tipos: en la NBA no hay empates y la
 * clasificación se ordena por porcentaje, no por puntos. Por eso `drawn` y
 * `points` llegan en `null` en vez de en cero.
 */

import { TTL } from '../core/cache'
import { basketballProviders } from '../core/registry'
import { runChain } from '../core/resolve'
import type { CompetitionScope, FixtureQuery } from '../core/ports'
import type { DataResult, Fixture, Standing, Team } from '../core/types'

/** La NBA es una sola competición: no hace falta pasar el id en cada llamada. */
const NBA_SCOPE: CompetitionScope = { competitionId: 'nba' }

export const nbaService = {
  listTeams(): Promise<DataResult<Team[]>> {
    return runChain({
      chain: basketballProviders(),
      capability: 'teams',
      cache: { key: ['nba', 'teams'], ttlSeconds: TTL.catalog },
      run: (p) => p.listTeams?.(NBA_SCOPE),
    })
  },

  getTeam(teamId: string): Promise<DataResult<Team>> {
    return runChain({
      chain: basketballProviders(),
      capability: 'team',
      cache: { key: ['nba', 'team', teamId], ttlSeconds: TTL.static },
      run: (p) => p.getTeam?.(teamId),
    })
  },

  /** Calendario y marcadores. `date` en YYYY-MM-DD (UTC). */
  getGames(query: Omit<FixtureQuery, 'competitionId'>): Promise<DataResult<Fixture[]>> {
    const full: FixtureQuery = { ...query, competitionId: 'nba' }
    const cacheable = query.state !== 'live'
    return runChain({
      chain: basketballProviders(),
      capability: 'fixtures',
      cache: cacheable
        ? {
            key: ['nba', 'games', query.date, query.from, query.to, query.state, query.limit],
            ttlSeconds: query.state === 'finished' ? TTL.historical : TTL.schedule,
          }
        : undefined,
      run: (p) => p.getFixtures?.(full),
    })
  },

  /** Clasificación por conferencia: `group` trae "Eastern"/"Western". */
  getStandings(season?: number): Promise<DataResult<Standing[]>> {
    return runChain({
      chain: basketballProviders(),
      capability: 'standings',
      cache: { key: ['nba', 'standings', season], ttlSeconds: TTL.standings },
      run: (p) => p.getStandings?.({ competitionId: 'nba', season }),
    })
  },
}
