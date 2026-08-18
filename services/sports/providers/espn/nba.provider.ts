/**
 * Proveedor de NBA sobre ESPN — el PRIMARIO.
 *
 * Motivo medido, no preferencia: la cuenta de api-sports tiene plan Pro en
 * fútbol pero sigue en Free en baloncesto (100 req/día), lo que deja la
 * temporada en curso fuera de alcance. ESPN sirve calendario, marcadores por
 * cuarto y clasificación por conferencia sin clave y sin ese techo, así que
 * la temporada actual de NBA se desbloquea sin comprar nada.
 *
 * api-basketball queda como alternativa si algún día se contrata: basta
 * escribir su adapter contra el mismo puerto y cambiar `NBA_PROVIDER`.
 */

import { ProviderError } from '../../core/errors'
import { TTL } from '../../core/cache'
import type { BasketballProvider, CompetitionScope, FixtureQuery } from '../../core/ports'
import { ref } from '../../core/ports'
import type { Capability, Fixture, Sourced, Standing, Team } from '../../core/types'
import { espn, toEspnDate } from './client'
import { ESPN, toFixture, toStanding, toTeam } from './normalize'
import type {
  EspnScoreboardResponse, EspnStandingsResponse, EspnTeamResponse, EspnTeamsResponse,
} from './shapes'

const LEAGUE = 'basketball/nba'
const NBA_REF = ref(ESPN, 'nba')

/** Cuartos, y a partir del quinto parcial, prórrogas. */
function nbaPeriodLabel(i: number): string {
  return i < 4 ? `Q${i + 1}` : i === 4 ? 'OT' : `OT${i - 3}`
}

const CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>([
  'teams', 'team', 'fixtures', 'results', 'standings',
])

export const espnNbaProvider: BasketballProvider = {
  id: ESPN,
  sport: 'baloncesto',
  capabilities: CAPABILITIES,
  quotaCostPerCall: 0,

  async listTeams(): Promise<Sourced<Team[]>> {
    const path = `${LEAGUE}/teams`
    const { body, provenance } = await espn.site<EspnTeamsResponse>(path, {}, TTL.catalog)
    const raw = body.sports?.[0]?.leagues?.[0]?.teams ?? []
    if (raw.length === 0) {
      throw new ProviderError({ kind: 'not_found', provider: ESPN, endpoint: path, message: 'sin equipos NBA' })
    }
    return { data: raw.map((t) => toTeam(t.team, path)), provenance }
  },

  async getTeam(teamId: string): Promise<Sourced<Team>> {
    const path = `${LEAGUE}/teams/${teamId}`
    const { body, provenance } = await espn.site<EspnTeamResponse>(path, {}, TTL.static)
    return { data: toTeam(body.team, path), provenance }
  },

  async getFixtures(query: FixtureQuery): Promise<Sourced<Fixture[]>> {
    const path = `${LEAGUE}/scoreboard`
    const params: Record<string, string | number | undefined> = {}
    if (query.date) params.dates = toEspnDate(query.date)
    else if (query.from && query.to) params.dates = `${toEspnDate(query.from)}-${toEspnDate(query.to)}`
    if (query.limit) params.limit = query.limit

    const revalidate = query.state === 'live' ? TTL.live : TTL.schedule
    const { body, provenance } = await espn.site<EspnScoreboardResponse>(path, params, revalidate)

    const fixtures: Fixture[] = []
    for (const ev of body.events ?? []) {
      for (const comp of ev.competitions ?? []) {
        try {
          fixtures.push(toFixture(ev.id ?? '', comp, 'baloncesto', NBA_REF, path, nbaPeriodLabel))
        } catch (e) {
          if (!(e instanceof ProviderError) || e.kind !== 'parse') throw e
        }
      }
    }
    const filtered = query.state && query.state !== 'live'
      ? fixtures.filter((f) => f.status === query.state)
      : fixtures
    return { data: filtered, provenance }
  },

  async getStandings(scope: CompetitionScope): Promise<Sourced<Standing[]>> {
    const path = `${LEAGUE}/standings`
    const { body, provenance } = await espn.web<EspnStandingsResponse>(path, { season: scope.season }, TTL.standings)
    const groups = body.children ?? []
    if (groups.length === 0) {
      throw new ProviderError({ kind: 'not_found', provider: ESPN, endpoint: path, message: 'sin clasificación NBA' })
    }
    const out: Standing[] = []
    for (const g of groups) {
      // Aquí el grupo SÍ se conserva siempre: Este y Oeste son la unidad
      // real de la clasificación NBA, no una subdivisión decorativa.
      const conference = g.name ?? null
      ;(g.standings?.entries ?? []).forEach((e, i) => out.push(toStanding(e, i, false, conference, path)))
    }
    return { data: out, provenance }
  },
}
