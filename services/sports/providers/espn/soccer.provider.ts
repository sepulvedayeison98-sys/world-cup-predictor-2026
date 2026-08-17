/**
 * Proveedor de FÚTBOL sobre ESPN — el secundario.
 *
 * En fútbol manda API-Football (plan Pro contratado): cubre plantillas,
 * lesiones, alineaciones y estadísticas por jugador, que ESPN no sirve. Este
 * adapter existe para dos cosas concretas:
 *
 *  · Respaldo cuando API-Football agota cuota o cae. Equipos, calendario y
 *    clasificación siguen llegando, gratis y sin clave.
 *  · Escudos y datos de estadio, que ESPN publica con buena calidad.
 *
 * Lo que NO declara (plantillas, lesiones, alineaciones, estadísticas de
 * jugador) no está implementado a propósito: un método que devolviera lista
 * vacía se leería en pantalla como "este equipo no tiene bajas".
 */

import { ProviderError } from '../../core/errors'
import { TTL } from '../../core/cache'
import type { CompetitionScope, FixtureQuery, FootballProvider } from '../../core/ports'
import { ref } from '../../core/ports'
import type { Capability, Competition, Fixture, Sourced, Standing, Team } from '../../core/types'
import { espn, toEspnDate } from './client'
import {
  ESPN, toCompetition, toFixture, toStanding, toTeam,
} from './normalize'
import type {
  EspnScoreboardResponse, EspnStandingsResponse, EspnTeamResponse, EspnTeamsResponse,
} from './shapes'

/**
 * Ligas de la casa en la nomenclatura de ESPN. La clave es la MISMA que usa
 * `lib/constants.ts` (`premier_league`, `liga_betplay`…) para que el mapeo
 * entre nuestro registro y el proveedor sea directo y no haya que adivinarlo.
 */
export const ESPN_SOCCER_LEAGUES: Record<string, { id: string; name: string }> = {
  premier_league: { id: 'eng.1', name: 'Premier League' },
  la_liga:        { id: 'esp.1', name: 'LaLiga' },
  serie_a:        { id: 'ita.1', name: 'Serie A' },
  bundesliga:     { id: 'ger.1', name: 'Bundesliga' },
  ligue_1:        { id: 'fra.1', name: 'Ligue 1' },
  liga_betplay:   { id: 'col.1', name: 'Primera A' },
}

/** Parciales del fútbol: dos tiempos, más prórroga si la hay. */
function soccerPeriodLabel(i: number): string {
  return i === 0 ? '1T' : i === 1 ? '2T' : `P${i + 1}`
}

const CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>([
  'competitions', 'teams', 'team', 'fixtures', 'results', 'standings',
])

export const espnSoccerProvider: FootballProvider = {
  id: ESPN,
  sport: 'futbol',
  capabilities: CAPABILITIES,
  quotaCostPerCall: 0, // sin cuota declarada

  async listCompetitions(): Promise<Sourced<Competition[]>> {
    // ESPN no expone un catálogo de ligas filtrable; la lista es la nuestra,
    // y la procedencia lo dice para que nadie la confunda con un fetch.
    return {
      data: Object.entries(ESPN_SOCCER_LEAGUES).map(([, v]) =>
        toCompetition(v.id, v.name, 'futbol', { type: 'league' })),
      provenance: { provider: ESPN, endpoint: 'soccer/leagues (catálogo local)', fetchedAt: new Date().toISOString() },
    }
  },

  async listTeams(scope: CompetitionScope): Promise<Sourced<Team[]>> {
    const path = `soccer/${scope.competitionId}/teams`
    const { body, provenance } = await espn.site<EspnTeamsResponse>(path, { season: scope.season }, TTL.catalog)
    const raw = body.sports?.[0]?.leagues?.[0]?.teams ?? []
    if (raw.length === 0) {
      throw new ProviderError({ kind: 'not_found', provider: ESPN, endpoint: path, message: 'sin equipos' })
    }
    return { data: raw.map((t) => toTeam(t.team, path)), provenance }
  },

  async getTeam(teamId: string, scope): Promise<Sourced<Team>> {
    const league = scope?.competitionId
    if (!league) {
      // ESPN necesita saber la liga para resolver un equipo. Pedirlo sin ella
      // devolvería 404 y un mensaje inútil; mejor un error de configuración.
      throw new ProviderError({
        kind: 'config', provider: ESPN, endpoint: 'soccer/teams/:id',
        message: 'ESPN exige la liga para resolver un equipo de fútbol',
      })
    }
    const path = `soccer/${league}/teams/${teamId}`
    const { body, provenance } = await espn.site<EspnTeamResponse>(path, {}, TTL.static)
    return { data: toTeam(body.team, path), provenance }
  },

  async getFixtures(query: FixtureQuery): Promise<Sourced<Fixture[]>> {
    const path = `soccer/${query.competitionId}/scoreboard`
    const params: Record<string, string | number | undefined> = {}
    if (query.date) params.dates = toEspnDate(query.date)
    else if (query.from && query.to) params.dates = `${toEspnDate(query.from)}-${toEspnDate(query.to)}`
    if (query.season) params.season = query.season

    const revalidate = query.state === 'live' ? TTL.live : TTL.schedule
    const { body, provenance } = await espn.site<EspnScoreboardResponse>(path, params, revalidate)

    const league = body.leagues?.[0]
    const competitionRef = league?.slug ? ref(ESPN, league.slug) : ref(ESPN, query.competitionId)

    const fixtures: Fixture[] = []
    for (const ev of body.events ?? []) {
      for (const comp of ev.competitions ?? []) {
        try {
          fixtures.push(toFixture(ev.id ?? '', comp, 'futbol', competitionRef, path, soccerPeriodLabel))
        } catch (e) {
          // Un partido malformado no invalida la jornada entera: se descarta
          // ese y se sigue. Lo contrario sería vaciar la página por un dato.
          if (!(e instanceof ProviderError) || e.kind !== 'parse') throw e
        }
      }
    }
    const filtered = query.state && query.state !== 'live'
      ? fixtures.filter((f) => f.status === query.state)
      : fixtures
    return { data: query.limit ? filtered.slice(0, query.limit) : filtered, provenance }
  },

  async getStandings(scope: CompetitionScope): Promise<Sourced<Standing[]>> {
    const path = `soccer/${scope.competitionId}/standings`
    const { body, provenance } = await espn.web<EspnStandingsResponse>(path, { season: scope.season }, TTL.standings)
    const groups = body.children ?? []
    if (groups.length === 0) {
      throw new ProviderError({ kind: 'not_found', provider: ESPN, endpoint: path, message: 'sin clasificación' })
    }
    const out: Standing[] = []
    for (const g of groups) {
      const entries = g.standings?.entries ?? []
      // Una liga tiene un solo grupo: no lo etiquetamos para no ensuciar la UI.
      const groupName = groups.length > 1 ? (g.name ?? null) : null
      entries.forEach((e, i) => out.push(toStanding(e, i, true, groupName, path)))
    }
    return { data: out, provenance }
  },
}
