/**
 * PUERTOS — el contrato que todo proveedor debe cumplir.
 *
 * Un puerto describe QUÉ se puede pedir; un adapter decide CÓMO se consigue.
 * Los servicios programan contra estos tipos y nunca contra un proveedor
 * concreto, que es lo que hace que cambiar de fuente sea escribir un archivo
 * nuevo en vez de tocar la aplicación.
 *
 * Dos decisiones de diseño que conviene entender antes de añadir un puerto:
 *
 *  · Los métodos son OPCIONALES y van acompañados de `capabilities`. Un
 *    proveedor que no cubre lesiones simplemente no implementa `getInjuries`
 *    y no declara la capacidad; el servicio lo detecta y responde
 *    `unsupported`. Así la ausencia de una fuente se propaga como un hecho,
 *    nunca como una lista vacía que la interfaz pintaría como "sin bajas".
 *  · Los métodos LANZAN `ProviderError`. Envolver el fallo en un valor es
 *    trabajo del servicio, no del adapter: el adapter solo traduce forma.
 *
 * Módulo NEUTRO.
 */

import type {
  Capability, Competition, ExternalRef, Fixture, Injury, Lineup, NewsArticle,
  OddsSnapshot, Player, PlayerStats, ProviderId, Sourced, SportKey, Standing,
  Team, TeamStats, TennisMatch, TennisRankingEntry, TennisTour,
  TennisTournament,
} from './types'

// ─── Base ────────────────────────────────────────────────────────────────────

export interface SportsProvider {
  readonly id: ProviderId
  /** Lo que este proveedor cubre de verdad, comprobado contra la API real. */
  readonly capabilities: ReadonlySet<Capability>
  /** Coste por llamada en unidades de cuota del proveedor (informativo). */
  readonly quotaCostPerCall: number
}

export function supports(p: SportsProvider, c: Capability): boolean {
  return p.capabilities.has(c)
}

// ─── Consultas ───────────────────────────────────────────────────────────────

export interface CompetitionScope {
  /** Id de la competición EN EL PROVEEDOR (no el UUID de nuestra base). */
  competitionId: string
  /** Año de inicio en el formato del proveedor. */
  season?: number
}

export interface FixtureQuery extends CompetitionScope {
  /** Fecha concreta en YYYY-MM-DD (UTC). */
  date?: string
  from?: string
  to?: string
  teamId?: string
  /** Solo partidos ya jugados / solo por jugar. Sin valor: ambos. */
  state?: 'finished' | 'scheduled' | 'live'
  limit?: number
}

// ─── Deportes de equipo (fútbol y baloncesto comparten forma) ────────────────

export interface TeamSportProvider extends SportsProvider {
  readonly sport: 'futbol' | 'baloncesto'

  listCompetitions?(season?: number): Promise<Sourced<Competition[]>>
  listTeams?(scope: CompetitionScope): Promise<Sourced<Team[]>>
  getTeam?(teamId: string, scope?: Partial<CompetitionScope>): Promise<Sourced<Team>>
  getSquad?(teamId: string, season?: number): Promise<Sourced<Player[]>>
  getFixtures?(query: FixtureQuery): Promise<Sourced<Fixture[]>>
  getFixture?(fixtureId: string): Promise<Sourced<Fixture>>
  getStandings?(scope: CompetitionScope): Promise<Sourced<Standing[]>>
  getTeamStats?(teamId: string, scope: CompetitionScope): Promise<Sourced<TeamStats>>
  getPlayerStats?(scope: CompetitionScope, teamId?: string): Promise<Sourced<PlayerStats[]>>
  getLineups?(fixtureId: string): Promise<Sourced<Lineup[]>>
  getInjuries?(scope: CompetitionScope, teamId?: string): Promise<Sourced<Injury[]>>
  /** Historial directo entre dos equipos, del más reciente al más antiguo. */
  getHeadToHead?(teamA: string, teamB: string, limit?: number): Promise<Sourced<Fixture[]>>
}

export interface FootballProvider extends TeamSportProvider {
  readonly sport: 'futbol'
}

export interface BasketballProvider extends TeamSportProvider {
  readonly sport: 'baloncesto'
}

// ─── Tenis (puerto propio: la unidad no es el equipo, es el jugador) ─────────

export interface TennisMatchQuery {
  tour: TennisTour
  date?: string       // YYYY-MM-DD (UTC)
  season?: number
  tournamentId?: string
  playerId?: string
  state?: 'finished' | 'scheduled' | 'live'
  limit?: number
}

export interface TennisDataProvider extends SportsProvider {
  readonly sport: 'tenis'

  getRankings?(tour: TennisTour, limit?: number): Promise<Sourced<TennisRankingEntry[]>>
  getTournaments?(tour: TennisTour, season?: number): Promise<Sourced<TennisTournament[]>>
  getMatches?(query: TennisMatchQuery): Promise<Sourced<TennisMatch[]>>
  getMatch?(matchId: string): Promise<Sourced<TennisMatch>>
  getHeadToHead?(playerA: string, playerB: string): Promise<Sourced<TennisMatch[]>>
}

// ─── Cuotas ──────────────────────────────────────────────────────────────────

export interface OddsQuery {
  /** Clave de deporte/liga del proveedor: "soccer_epl", "basketball_nba". */
  sportKey: string
  regions?: string  // "eu", "us", "uk"
  markets?: string  // "h2h,totals"
}

export interface OddsDataProvider extends SportsProvider {
  listSports?(): Promise<Sourced<{ key: string; title: string; active: boolean }[]>>
  getOdds(query: OddsQuery): Promise<Sourced<OddsSnapshot[]>>
}

// ─── Noticias ────────────────────────────────────────────────────────────────

export interface NewsQuery {
  sport: SportKey
  /** Liga o tour concreto en la nomenclatura del proveedor. */
  scope?: string
  limit?: number
}

export interface NewsDataProvider extends SportsProvider {
  getNews(query: NewsQuery): Promise<Sourced<NewsArticle[]>>
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

export function ref(provider: ProviderId, id: string | number): ExternalRef {
  return { provider, id: String(id) }
}
