/**
 * MODELOS NORMALIZADOS — el idioma interno de la plataforma.
 *
 * Todo proveedor externo se traduce a estos tipos ANTES de llegar a un
 * servicio. La interfaz nunca ve la forma de API-Football, de ESPN ni de
 * The Odds API: ve esto. Cambiar de proveedor = escribir un adapter nuevo,
 * no reconstruir la aplicación.
 *
 * Dos reglas que este archivo hace cumplir por diseño:
 *
 *  1. DATA FIRST. Un campo que la fuente no entrega es `null`, jamás un
 *     valor inventado ni un cero de relleno. Por eso casi todo es opcional:
 *     la ausencia es un dato, y se muestra como tal.
 *  2. AISLAMIENTO. Los deportes con estructura distinta tienen tipos
 *     distintos. Un partido de tenis NO es un `Fixture` con dos "equipos"
 *     de un jugador: es un `TennisMatch`. Forzar un molde común es
 *     exactamente la contaminación que la arquitectura evita.
 *
 * Este módulo es NEUTRO: no importa nada de lib/, ni motores, ni dominios.
 */

// ─── Identidad y procedencia ─────────────────────────────────────────────────

export type SportKey = 'futbol' | 'baloncesto' | 'tenis'

/** Nombre corto y estable de cada proveedor. Se persiste, no se traduce. */
export type ProviderId =
  | 'api-football'
  | 'api-basketball'
  | 'espn'
  | 'the-odds-api'
  | 'sackmann'

/**
 * Referencia al identificador del proveedor de origen. Se guarda junto al
 * dato para poder re-consultar, deduplicar entre fuentes y auditar.
 */
export interface ExternalRef {
  provider: ProviderId
  id: string
}

/**
 * Procedencia de cada payload normalizado. Acompaña SIEMPRE a los datos que
 * salen de un adapter: sin esto no se puede responder "¿de dónde salió este
 * número?", que es la pregunta que sostiene la credibilidad del producto.
 */
export interface Provenance {
  provider: ProviderId
  endpoint: string
  fetchedAt: string // ISO-8601 UTC
}

/** Envoltura estándar de todo lo que devuelve un adapter. */
export interface Sourced<T> {
  data: T
  provenance: Provenance
}

// ─── Entidades transversales ─────────────────────────────────────────────────

export interface Venue {
  name: string
  city: string | null
  country: string | null
  capacity: number | null
  surface: string | null
  imageUrl: string | null
}

export interface Coach {
  name: string
  nationality: string | null
  since: string | null // ISO date
  photoUrl: string | null
}

export interface Competition {
  ref: ExternalRef
  sport: SportKey
  name: string
  shortName: string | null
  country: string | null
  logoUrl: string | null
  /** Año de inicio en el formato del proveedor (2026 = campaña 2026-27). */
  season: number | null
  /** Etiqueta legible de la temporada: "2026-27", "2026". */
  seasonLabel: string | null
  type: 'league' | 'cup' | 'tour' | 'friendly' | 'unknown'
}

export interface Team {
  ref: ExternalRef
  name: string
  shortName: string | null
  code: string | null
  country: string | null
  logoUrl: string | null
  founded: number | null
  venue: Venue | null
  coach: Coach | null
  /** Títulos oficiales, solo si la fuente los entrega. Nunca se estiman. */
  honours: Honour[] | null
}

export interface Honour {
  competition: string
  count: number | null
  seasons: string[] | null
}

export interface Player {
  ref: ExternalRef
  name: string
  firstName: string | null
  lastName: string | null
  age: number | null
  birthDate: string | null
  nationality: string | null
  height: string | null
  weight: string | null
  photoUrl: string | null
  position: string | null
  shirtNumber: number | null
  teamRef: ExternalRef | null
}

/** Forma reciente derivada de resultados. `results` va del más reciente al más antiguo. */
export interface RecentForm {
  results: ('W' | 'D' | 'L')[]
  played: number
  won: number
  /** `null` en deportes sin empate (NBA): allí un 0 afirmaría algo falso. */
  drawn: number | null
  lost: number
}

export interface Standing {
  rank: number
  teamRef: ExternalRef
  teamName: string
  played: number
  won: number
  drawn: number | null // null en deportes sin empate (NBA)
  lost: number
  goalsFor: number | null
  goalsAgainst: number | null
  points: number | null // null cuando la liga ordena por porcentaje (NBA)
  winPct: number | null
  form: RecentForm | null
  group: string | null
  description: string | null // "Champions League", "Playoffs", "Descenso"…
}

/**
 * Partido entre dos equipos. Sirve a fútbol y baloncesto; el tenis NO lo usa.
 * `score` es null mientras no haya empezado — no se rellena con 0-0.
 */
export interface Fixture {
  ref: ExternalRef
  sport: 'futbol' | 'baloncesto'
  competitionRef: ExternalRef | null
  kickoff: string // ISO-8601 UTC
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'
  statusDetail: string | null
  round: string | null
  venue: Venue | null
  home: FixtureSide
  away: FixtureSide
  /** Parciales: tiempos en fútbol, cuartos en NBA. */
  periods: PeriodScore[] | null
}

export interface FixtureSide {
  teamRef: ExternalRef
  name: string
  shortName: string | null
  logoUrl: string | null
  score: number | null
  record: string | null // "12-4-2" tal y como lo publica la fuente
}

export interface PeriodScore {
  label: string // "1T", "Q3", "OT"
  home: number | null
  away: number | null
}

export interface TeamStats {
  teamRef: ExternalRef
  competitionRef: ExternalRef | null
  /**
   * Métricas crudas del proveedor, ya normalizadas de nombre. Un valor
   * ausente NO aparece en el mapa: recorrerlo dice exactamente qué se sabe.
   */
  metrics: Record<string, number>
  form: RecentForm | null
}

export interface PlayerStats {
  playerRef: ExternalRef
  teamRef: ExternalRef | null
  competitionRef: ExternalRef | null
  metrics: Record<string, number>
}

export interface Injury {
  playerRef: ExternalRef
  playerName: string
  teamRef: ExternalRef | null
  /** Texto del proveedor: "Rodilla", "Enfermedad". No se traduce a un enum cerrado. */
  reason: string | null
  status: 'out' | 'doubtful' | 'questionable' | 'unknown'
  since: string | null
  expectedReturn: string | null
}

export interface LineupPlayer {
  playerRef: ExternalRef
  name: string
  shirtNumber: number | null
  position: string | null
  gridPosition: string | null // "4:2" en API-Football
  starter: boolean
}

export interface Lineup {
  teamRef: ExternalRef
  formation: string | null
  coach: Coach | null
  starters: LineupPlayer[]
  substitutes: LineupPlayer[]
}

// ─── Tenis (estructura propia: jugador vs jugador) ───────────────────────────

export type TennisTour = 'ATP' | 'WTA'
export type TennisSurface = 'hard' | 'clay' | 'grass' | 'carpet' | 'unknown'

export interface TennisPlayerRef {
  ref: ExternalRef
  name: string
  countryCode: string | null
  rank: number | null
  seed: number | null
}

export interface TennisTournament {
  ref: ExternalRef
  tour: TennisTour
  name: string
  location: string | null
  country: string | null
  surface: TennisSurface
  category: string | null // "Grand Slam", "Masters 1000", "ATP 250"
  startDate: string | null
  endDate: string | null
  season: number | null
}

export interface TennisSetScore {
  home: number | null
  away: number | null
  tiebreak: { home: number; away: number } | null
}

export interface TennisMatch {
  ref: ExternalRef
  tour: TennisTour
  tournamentRef: ExternalRef | null
  tournamentName: string | null
  round: string | null
  surface: TennisSurface
  scheduled: string | null // ISO-8601 UTC
  status: 'scheduled' | 'live' | 'finished' | 'retired' | 'walkover' | 'cancelled'
  statusDetail: string | null
  home: TennisPlayerRef
  away: TennisPlayerRef
  sets: TennisSetScore[] | null
  winner: 'home' | 'away' | null
}

export interface TennisRankingEntry {
  ref: ExternalRef
  name: string
  countryCode: string | null
  rank: number
  points: number | null
  previousRank: number | null
}

// ─── Cuotas ──────────────────────────────────────────────────────────────────

export type OddsMarketKey =
  | 'home_win' | 'draw' | 'away_win'
  | 'over_1_5' | 'under_1_5'
  | 'over_2_5' | 'under_2_5'
  | 'btts_yes' | 'btts_no'

export interface OddsQuote {
  market: OddsMarketKey
  /** Cuota decimal tal cual la publica la casa. Nunca se redondea al guardar. */
  price: number
  point: number | null
}

export interface BookmakerOdds {
  bookmaker: string
  lastUpdate: string | null
  quotes: OddsQuote[]
}

export interface OddsSnapshot {
  ref: ExternalRef
  sportKey: string // clave del proveedor: "soccer_epl", "basketball_nba"
  commenceTime: string
  homeTeam: string
  awayTeam: string
  bookmakers: BookmakerOdds[]
}

// ─── Noticias ────────────────────────────────────────────────────────────────

export interface NewsArticle {
  ref: ExternalRef
  sport: SportKey
  /** Ámbito: clave de liga/tour del proveedor, o null si es general. */
  scope: string | null
  headline: string
  description: string | null
  url: string
  imageUrl: string | null
  publishedAt: string | null
  byline: string | null
  type: string | null // "HeadlineNews", "Recap"…
}

// ─── Capacidades ─────────────────────────────────────────────────────────────

/**
 * Lo que un proveedor sabe hacer DE VERDAD. Es la pieza que evita mentir:
 * un servicio consulta la capacidad antes de llamar y, si no está, devuelve
 * `unsupported` en vez de inventarse el dato o devolver una lista vacía que
 * la interfaz interpretaría como "no hay lesiones".
 */
export type Capability =
  | 'competitions' | 'teams' | 'team' | 'squad' | 'players' | 'player'
  | 'fixtures' | 'results' | 'standings' | 'teamStats' | 'playerStats'
  | 'lineups' | 'injuries' | 'h2h' | 'events'
  | 'tournaments' | 'rankings' | 'matches'
  | 'odds' | 'news'

/**
 * Respuesta de todo método de servicio. Distingue tres estados que la
 * interfaz debe tratar distinto: hay dato, la fuente no cubre esto, o falló.
 */
export type DataResult<T> =
  | { status: 'ok'; data: T; provenance: Provenance; stale: boolean }
  | { status: 'unsupported'; reason: string; provider: ProviderId }
  | { status: 'error'; reason: string; retryable: boolean; provider: ProviderId }

export function ok<T>(data: T, provenance: Provenance, stale = false): DataResult<T> {
  return { status: 'ok', data, provenance, stale }
}

export function unsupported<T>(provider: ProviderId, reason: string): DataResult<T> {
  return { status: 'unsupported', reason, provider }
}
