/**
 * Proveedor de TENIS sobre ESPN — el PRIMARIO para la temporada en curso.
 *
 * Hallazgo de esta integración: `docs/TENNIS_ARCHITECTURE.md` daba el
 * calendario, los resultados y el ranking actuales por "bloqueados pendientes
 * de comprar una API comercial". No lo están. ESPN publica los tres, gratis
 * y sin clave, con sets, tie-breaks, ronda y ganador. Los CSV de Sackmann
 * siguen siendo la base HISTÓRICA para backtesting; ESPN cubre el presente.
 *
 * Estructura de ESPN en tenis, distinta de los deportes de equipo:
 *
 *     evento   = TORNEO (Halle 2026)
 *       └ grouping = CUADRO (individual masculino, dobles…)
 *           └ competition = PARTIDO
 *
 * Solo se leen los cuadros INDIVIDUALES: el motor de tenis de la casa modela
 * jugador contra jugador y meter dobles contaminaría rankings y forma.
 *
 * Lo que ESPN NO da y por tanto queda en `null`, nunca estimado:
 *  · Superficie del torneo — no viaja en el marcador. Se resuelve fuera, con
 *    el catálogo histórico, o se muestra como desconocida.
 *  · Puntos de ranking por torneo y estadísticas de servicio/devolución.
 */

import { ProviderError } from '../../core/errors'
import { TTL } from '../../core/cache'
import type { TennisDataProvider, TennisMatchQuery } from '../../core/ports'
import { ref } from '../../core/ports'
import type {
  Capability, Sourced, TennisMatch, TennisPlayerRef, TennisRankingEntry,
  TennisSetScore, TennisTour, TennisTournament,
} from '../../core/types'
import { espn, toEspnDate } from './client'
import { ESPN } from './normalize'
import type {
  EspnCompetition, EspnCompetitor, EspnEvent, EspnRankingsResponse,
  EspnScoreboardResponse,
} from './shapes'

/** Ruta de cada circuito en ESPN. */
const TOUR_PATH: Record<TennisTour, string> = { ATP: 'tennis/atp', WTA: 'tennis/wta' }

/** Cuadros individuales. Todo lo demás (dobles, mixto) se descarta. */
const SINGLES_SLUGS = new Set(['mens-singles', 'womens-singles'])

const CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>([
  'rankings', 'tournaments', 'matches',
])

const STATUS_MAP: Record<string, TennisMatch['status']> = {
  STATUS_SCHEDULED: 'scheduled',
  STATUS_IN_PROGRESS: 'live',
  STATUS_FINAL: 'finished',
  STATUS_RETIRED: 'retired',
  STATUS_WALKOVER: 'walkover',
  STATUS_CANCELED: 'cancelled',
  STATUS_POSTPONED: 'scheduled',
}

function toStatus(name: string | undefined, state: string | undefined): TennisMatch['status'] {
  if (name && STATUS_MAP[name]) return STATUS_MAP[name]
  if (state === 'in') return 'live'
  if (state === 'post') return 'finished'
  return 'scheduled'
}

/**
 * Código de país desde la bandera de ESPN.
 *
 * La URL es `…/countries/500/ita.png`. Extraer el segmento es LEER el dato
 * que la fuente entrega en otro formato, no inventarlo; si el patrón no
 * casa, se devuelve null en vez de arriesgar un código equivocado.
 *
 * Acepta string y objeto porque ESPN usa una forma en el ranking y otra en
 * el marcador: la verificación en vivo dejó el país en null hasta cubrir
 * las dos.
 */
export function countryFromFlag(flag: string | { href?: string } | undefined): string | null {
  const href = typeof flag === 'string' ? flag : flag?.href
  if (!href) return null
  const m = /\/countries\/\d+\/([a-z]{2,3})\.png/i.exec(href)
  return m ? m[1].toUpperCase() : null
}

function toPlayer(c: EspnCompetitor | undefined, endpoint: string): TennisPlayerRef {
  const id = c?.athlete?.id ?? c?.id
  const name = c?.athlete?.displayName
  if (!id || !name) {
    throw new ProviderError({
      kind: 'parse', provider: ESPN, endpoint, message: 'competidor de tenis sin id o sin nombre',
    })
  }
  return {
    ref: ref(ESPN, id),
    name,
    countryCode: countryFromFlag(c?.athlete?.flag),
    // El ranking no viaja en el marcador; el sembrado sí, cuando lo hay.
    rank: null,
    seed: typeof c?.curatedRank?.current === 'number' ? c.curatedRank.current : null,
  }
}

function toSets(home: EspnCompetitor | undefined, away: EspnCompetitor | undefined): TennisSetScore[] | null {
  const h = home?.linescores ?? []
  const a = away?.linescores ?? []
  const n = Math.max(h.length, a.length)
  if (n === 0) return null
  return Array.from({ length: n }, (_, i) => {
    const hs = h[i]
    const as = a[i]
    const tbH = hs?.tiebreak
    const tbA = as?.tiebreak
    return {
      home: typeof hs?.value === 'number' ? hs.value : null,
      away: typeof as?.value === 'number' ? as.value : null,
      tiebreak: typeof tbH === 'number' && typeof tbA === 'number' ? { home: tbH, away: tbA } : null,
    }
  })
}

function toMatch(
  tour: TennisTour,
  event: EspnEvent,
  comp: EspnCompetition,
  endpoint: string,
): TennisMatch {
  const competitors = comp.competitors ?? []
  // En tenis ESPN no marca home/away de forma fiable: usa `order`. El orden
  // no significa localía (no existe), solo la posición en el cuadro.
  const sorted = [...competitors].sort((x, y) => (x.order ?? 0) - (y.order ?? 0))
  const [first, second] = sorted
  const home = toPlayer(first, endpoint)
  const away = toPlayer(second, endpoint)

  const winner = first?.winner === true ? 'home' : second?.winner === true ? 'away' : null

  return {
    ref: ref(ESPN, comp.id ?? `${event.id}-${home.ref.id}-${away.ref.id}`),
    tour,
    tournamentRef: event.id ? ref(ESPN, event.id) : null,
    tournamentName: event.name ?? null,
    round: comp.round?.displayName ?? null,
    // Data First: ESPN no publica la superficie en el marcador.
    surface: 'unknown',
    scheduled: comp.date ? new Date(comp.date).toISOString() : null,
    status: toStatus(comp.status?.type?.name, comp.status?.type?.state),
    statusDetail: comp.status?.type?.detail ?? null,
    home,
    away,
    sets: toSets(first, second),
    winner,
  }
}

/** Recorre los cuadros individuales de un evento y devuelve sus partidos. */
function singlesCompetitions(event: EspnEvent): EspnCompetition[] {
  const out: EspnCompetition[] = []
  for (const g of event.groupings ?? []) {
    const slug = g.grouping?.slug
    if (slug && !SINGLES_SLUGS.has(slug)) continue
    // Sin slug no se puede afirmar que sea individual: se descarta antes que
    // colar un partido de dobles en el historial de un jugador.
    if (!slug) continue
    out.push(...(g.competitions ?? []))
  }
  return out
}

export const espnTennisProvider: TennisDataProvider = {
  id: ESPN,
  sport: 'tenis',
  capabilities: CAPABILITIES,
  quotaCostPerCall: 0,

  async getRankings(tour: TennisTour, limit?: number): Promise<Sourced<TennisRankingEntry[]>> {
    const path = `${TOUR_PATH[tour]}/rankings`
    const { body, provenance } = await espn.site<EspnRankingsResponse>(path, {}, TTL.standings)
    const table = body.rankings?.[0]
    const ranks = table?.ranks ?? []
    if (ranks.length === 0) {
      throw new ProviderError({ kind: 'not_found', provider: ESPN, endpoint: path, message: `sin ranking ${tour}` })
    }
    const entries: TennisRankingEntry[] = []
    for (const r of ranks) {
      const a = r.athlete
      if (!a?.id || !a.displayName || typeof r.current !== 'number') continue
      entries.push({
        ref: ref(ESPN, a.id),
        name: a.displayName,
        countryCode: a.citizenshipCountry?.abbreviation ?? countryFromFlag(a.flag),
        rank: r.current,
        points: typeof r.points === 'number' ? r.points : null,
        previousRank: typeof r.previous === 'number' && r.previous > 0 ? r.previous : null,
      })
    }
    return { data: limit ? entries.slice(0, limit) : entries, provenance }
  },

  async getTournaments(tour: TennisTour, season?: number): Promise<Sourced<TennisTournament[]>> {
    // El calendario de torneos se deriva del marcador: cada evento ES un
    // torneo. ESPN no publica un endpoint de calendario de temporada.
    //
    // Sin rango de fechas el marcador devuelve SOLO lo de hoy — la primera
    // verificación en vivo trajo un único torneo. Por eso se pide el año
    // completo de forma explícita.
    const year = season ?? new Date().getUTCFullYear()
    const path = `${TOUR_PATH[tour]}/scoreboard`
    const { body, provenance } = await espn.site<EspnScoreboardResponse>(
      path, { dates: `${year}0101-${year}1231` }, TTL.catalog,
    )
    const seen = new Set<string>()
    const data = (body.events ?? []).flatMap((ev): TennisTournament[] => {
      if (!ev.id || !ev.name) return []
      // Un torneo aparece en el marcador tantos días como dure: se deduplica
      // por id o el calendario saldría con la misma cita repetida.
      if (seen.has(ev.id)) return []
      seen.add(ev.id)
      const place = ev.venue?.displayName ?? ev.venue?.fullName ?? null
      return [{
        ref: ref(ESPN, ev.id),
        tour,
        name: ev.name,
        location: place,
        // ESPN da "Halle, Germany" en un solo campo; partirlo por la última
        // coma es una lectura razonable, no una invención de dato.
        country: place?.includes(',') ? place.slice(place.lastIndexOf(',') + 1).trim() : null,
        surface: 'unknown',
        category: null,
        startDate: ev.date ? new Date(ev.date).toISOString() : null,
        endDate: null,
        season: ev.season?.year ?? season ?? null,
      }]
    })
    return { data, provenance }
  },

  async getMatches(query: TennisMatchQuery): Promise<Sourced<TennisMatch[]>> {
    const path = `${TOUR_PATH[query.tour]}/scoreboard`
    const params: Record<string, string | number | undefined> = {}
    if (query.date) params.dates = toEspnDate(query.date)
    if (query.season) params.season = query.season

    const revalidate = query.state === 'live' ? TTL.live : TTL.schedule
    const { body, provenance } = await espn.site<EspnScoreboardResponse>(path, params, revalidate)

    const matches: TennisMatch[] = []
    for (const ev of body.events ?? []) {
      if (query.tournamentId && ev.id !== query.tournamentId) continue
      for (const comp of singlesCompetitions(ev)) {
        try {
          matches.push(toMatch(query.tour, ev, comp, path))
        } catch (e) {
          // Un partido sin los dos jugadores (bye, cuadro sin sortear) se
          // salta; no es motivo para dejar el día entero sin resultados.
          if (!(e instanceof ProviderError) || e.kind !== 'parse') throw e
        }
      }
    }

    let out = matches
    if (query.state && query.state !== 'live') out = out.filter((m) => m.status === query.state)
    if (query.playerId) {
      out = out.filter((m) => m.home.ref.id === query.playerId || m.away.ref.id === query.playerId)
    }
    return { data: query.limit ? out.slice(0, query.limit) : out, provenance }
  },
}
