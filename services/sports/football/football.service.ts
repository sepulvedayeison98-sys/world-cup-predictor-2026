/**
 * SERVICIO DE FÚTBOL — lo que consume la aplicación.
 *
 * A partir de aquí, hacia arriba, nadie sabe que existen API-Football ni
 * ESPN. Se pide "la plantilla del equipo 33" y se recibe un `DataResult`:
 * dato, no cubierto, o error ya traducido a español.
 *
 * `competitionId` y `teamId` son SIEMPRE identificadores DEL PROVEEDOR, no
 * los UUID de nuestra base. La traducción entre ambos mundos vive en los
 * procesos de ingesta (`services/sync/`), que es donde tiene sentido: aquí
 * mezclarlas obligaría a este módulo a conocer el esquema de Supabase.
 */

import { TTL } from '../core/cache'
import { footballProviders } from '../core/registry'
import { runChain } from '../core/resolve'
import type { CompetitionScope, FixtureQuery } from '../core/ports'
import type {
  Competition, DataResult, Fixture, Injury, Lineup, Player, PlayerStats,
  Standing, Team, TeamStats,
} from '../core/types'

export const footballService = {
  listCompetitions(season?: number): Promise<DataResult<Competition[]>> {
    return runChain({
      chain: footballProviders(),
      capability: 'competitions',
      cache: { key: ['futbol', 'competitions', season], ttlSeconds: TTL.catalog },
      run: (p) => p.listCompetitions?.(season),
    })
  },

  listTeams(scope: CompetitionScope): Promise<DataResult<Team[]>> {
    return runChain({
      chain: footballProviders(),
      capability: 'teams',
      cache: { key: ['futbol', 'teams', scope.competitionId, scope.season], ttlSeconds: TTL.catalog },
      run: (p) => p.listTeams?.(scope),
    })
  },

  getTeam(teamId: string, scope?: Partial<CompetitionScope>): Promise<DataResult<Team>> {
    return runChain({
      chain: footballProviders(),
      capability: 'team',
      cache: { key: ['futbol', 'team', teamId, scope?.competitionId], ttlSeconds: TTL.static },
      run: (p) => p.getTeam?.(teamId, scope),
    })
  },

  /** Plantilla completa. Solo API-Football la cubre; ESPN no. */
  getSquad(teamId: string, season?: number): Promise<DataResult<Player[]>> {
    return runChain({
      chain: footballProviders(),
      capability: 'squad',
      cache: { key: ['futbol', 'squad', teamId, season], ttlSeconds: TTL.roster },
      run: (p) => p.getSquad?.(teamId, season),
      unsupportedReason: 'La fuente activa no publica plantillas de fútbol.',
    })
  },

  getFixtures(query: FixtureQuery): Promise<DataResult<Fixture[]>> {
    // Los partidos en vivo no se memoizan: 30 s de TTL en la caché de datos
    // ya es el techo, y una memo en proceso solo añadiría retraso encima.
    const cacheable = query.state !== 'live'
    return runChain({
      chain: footballProviders(),
      capability: 'fixtures',
      cache: cacheable
        ? {
            key: ['futbol', 'fixtures', query.competitionId, query.season, query.date, query.from, query.to, query.teamId, query.state, query.limit],
            ttlSeconds: query.state === 'finished' ? TTL.historical : TTL.schedule,
          }
        : undefined,
      run: (p) => p.getFixtures?.(query),
    })
  },

  getFixture(fixtureId: string): Promise<DataResult<Fixture>> {
    return runChain({
      chain: footballProviders(),
      capability: 'fixtures',
      cache: { key: ['futbol', 'fixture', fixtureId], ttlSeconds: TTL.schedule },
      run: (p) => p.getFixture?.(fixtureId),
    })
  },

  getStandings(scope: CompetitionScope): Promise<DataResult<Standing[]>> {
    return runChain({
      chain: footballProviders(),
      capability: 'standings',
      cache: { key: ['futbol', 'standings', scope.competitionId, scope.season], ttlSeconds: TTL.standings },
      run: (p) => p.getStandings?.(scope),
    })
  },

  getTeamStats(teamId: string, scope: CompetitionScope): Promise<DataResult<TeamStats>> {
    return runChain({
      chain: footballProviders(),
      capability: 'teamStats',
      cache: { key: ['futbol', 'teamStats', teamId, scope.competitionId, scope.season], ttlSeconds: TTL.seasonStats },
      run: (p) => p.getTeamStats?.(teamId, scope),
    })
  },

  getPlayerStats(scope: CompetitionScope, teamId?: string): Promise<DataResult<PlayerStats[]>> {
    return runChain({
      chain: footballProviders(),
      capability: 'playerStats',
      cache: { key: ['futbol', 'playerStats', scope.competitionId, scope.season, teamId], ttlSeconds: TTL.seasonStats },
      run: (p) => p.getPlayerStats?.(scope, teamId),
      unsupportedReason: 'La fuente activa no publica estadísticas por jugador.',
    })
  },

  /** Alineaciones. Antes del anuncio oficial devuelve error `not_found`. */
  getLineups(fixtureId: string): Promise<DataResult<Lineup[]>> {
    return runChain({
      chain: footballProviders(),
      capability: 'lineups',
      cache: { key: ['futbol', 'lineups', fixtureId], ttlSeconds: TTL.lineups },
      run: (p) => p.getLineups?.(fixtureId),
      unsupportedReason: 'La fuente activa no publica alineaciones.',
    })
  },

  getInjuries(scope: CompetitionScope, teamId?: string): Promise<DataResult<Injury[]>> {
    return runChain({
      chain: footballProviders(),
      capability: 'injuries',
      cache: { key: ['futbol', 'injuries', scope.competitionId, scope.season, teamId], ttlSeconds: TTL.injuries },
      run: (p) => p.getInjuries?.(scope, teamId),
      unsupportedReason: 'La fuente activa no publica partes de lesiones.',
    })
  },

  getHeadToHead(teamA: string, teamB: string, limit = 10): Promise<DataResult<Fixture[]>> {
    return runChain({
      chain: footballProviders(),
      capability: 'h2h',
      cache: { key: ['futbol', 'h2h', teamA, teamB, limit], ttlSeconds: TTL.historical },
      run: (p) => p.getHeadToHead?.(teamA, teamB, limit),
    })
  },
}
