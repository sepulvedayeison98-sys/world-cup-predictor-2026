/**
 * Proveedor de CUOTAS sobre The Odds API.
 *
 * Ya era la fuente del proyecto; lo que cambia aquí es que deja de estar
 * cableada dentro del sync de fútbol y pasa a cumplir un puerto, con lo que
 * sirve igual a fútbol, NBA o tenis sin duplicar el cliente.
 *
 * Dos cuidados propios de esta API:
 *  · La clave viaja en el QUERY STRING, no en cabecera. Cualquier log de la
 *    URL la filtraría: por eso `endpoint` nunca la incluye y los errores
 *    pasan por `redactUrl`.
 *  · La cuota es mensual y pequeña en los planes bajos. Cada mercado y cada
 *    región extra multiplica el coste de la llamada, así que se piden los
 *    mínimos y se cachean 5 minutos.
 */

import { ProviderError } from '../../core/errors'
import { requestJson, qs } from '../../core/http'
import { TTL } from '../../core/cache'
import type { OddsDataProvider, OddsQuery } from '../../core/ports'
import { ref } from '../../core/ports'
import type {
  BookmakerOdds, Capability, OddsMarketKey, OddsQuote, OddsSnapshot, Sourced,
} from '../../core/types'

export const THE_ODDS_API = 'the-odds-api' as const
const HOST = 'https://api.the-odds-api.com/v4'

interface RawOutcome { name?: string; price?: number; point?: number }
interface RawMarket { key?: string; outcomes?: RawOutcome[] }
interface RawBookmaker { key?: string; title?: string; last_update?: string; markets?: RawMarket[] }
interface RawEvent {
  id?: string
  sport_key?: string
  commence_time?: string
  home_team?: string
  away_team?: string
  bookmakers?: RawBookmaker[]
}
interface RawSport { key?: string; title?: string; active?: boolean }

function apiKey(): string {
  const k = process.env.ODDS_API_KEY
  if (!k) {
    throw new ProviderError({
      kind: 'config', provider: THE_ODDS_API, endpoint: '(config)',
      message: 'ODDS_API_KEY no está configurada',
    })
  }
  return k
}

/**
 * Traduce un outcome a nuestro enum de mercados.
 *
 * `h2h` nombra los outcomes con el NOMBRE DEL EQUIPO, así que hay que
 * compararlos con los del evento; "Draw" es el único literal. En `totals`,
 * el punto (2.5, 1.5) forma parte de la identidad del mercado.
 */
export function mapMarket(
  marketKey: string | undefined,
  o: RawOutcome,
  homeTeam: string,
  awayTeam: string,
): OddsMarketKey | null {
  const name = (o.name ?? '').trim()
  if (marketKey === 'h2h') {
    if (name.toLowerCase() === 'draw') return 'draw'
    if (name === homeTeam) return 'home_win'
    if (name === awayTeam) return 'away_win'
    return null
  }
  if (marketKey === 'totals') {
    const over = name.toLowerCase() === 'over'
    const under = name.toLowerCase() === 'under'
    if (!over && !under) return null
    if (o.point === 1.5) return over ? 'over_1_5' : 'under_1_5'
    if (o.point === 2.5) return over ? 'over_2_5' : 'under_2_5'
    return null // otros puntos no están modelados: se ignoran, no se fuerzan
  }
  if (marketKey === 'btts') {
    if (name.toLowerCase() === 'yes') return 'btts_yes'
    if (name.toLowerCase() === 'no') return 'btts_no'
  }
  return null
}

const CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>(['odds'])

export const theOddsApiProvider: OddsDataProvider = {
  id: THE_ODDS_API,
  capabilities: CAPABILITIES,
  quotaCostPerCall: 1,

  async listSports(): Promise<Sourced<{ key: string; title: string; active: boolean }[]>> {
    const url = `${HOST}/sports${qs({ apiKey: apiKey() })}`
    const { body, provenance } = await requestJson<RawSport[]>(url, {
      provider: THE_ODDS_API, endpoint: '/sports', revalidate: TTL.catalog, timeoutMs: 10_000,
    })
    return {
      data: (body ?? []).flatMap((s) =>
        s.key && s.title ? [{ key: s.key, title: s.title, active: s.active ?? false }] : []),
      provenance,
    }
  },

  async getOdds(query: OddsQuery): Promise<Sourced<OddsSnapshot[]>> {
    const endpoint = `/sports/${query.sportKey}/odds`
    const url = `${HOST}${endpoint}${qs({
      apiKey: apiKey(),
      regions: query.regions ?? 'eu',
      markets: query.markets ?? 'h2h,totals',
      oddsFormat: 'decimal',
    })}`

    const { body, provenance } = await requestJson<RawEvent[]>(url, {
      provider: THE_ODDS_API, endpoint, revalidate: TTL.odds, timeoutMs: 12_000,
    })

    const data: OddsSnapshot[] = []
    for (const ev of body ?? []) {
      if (!ev.id || !ev.commence_time || !ev.home_team || !ev.away_team) continue
      const bookmakers: BookmakerOdds[] = []
      for (const bk of ev.bookmakers ?? []) {
        if (!bk.title && !bk.key) continue
        const quotes: OddsQuote[] = []
        for (const m of bk.markets ?? []) {
          for (const o of m.outcomes ?? []) {
            const market = mapMarket(m.key, o, ev.home_team, ev.away_team)
            // Una cuota decimal por debajo de 1 es imposible: se descarta en
            // vez de propagar un valor que rompería cualquier cálculo de EV.
            if (!market || typeof o.price !== 'number' || !(o.price > 1)) continue
            quotes.push({ market, price: o.price, point: typeof o.point === 'number' ? o.point : null })
          }
        }
        if (quotes.length > 0) {
          bookmakers.push({
            bookmaker: bk.title ?? bk.key!,
            lastUpdate: bk.last_update ?? null,
            quotes,
          })
        }
      }
      data.push({
        ref: ref(THE_ODDS_API, ev.id),
        sportKey: ev.sport_key ?? query.sportKey,
        commenceTime: new Date(ev.commence_time).toISOString(),
        homeTeam: ev.home_team,
        awayTeam: ev.away_team,
        bookmakers,
      })
    }
    return { data, provenance }
  },
}
