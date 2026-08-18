/**
 * REGISTRO DE PROVEEDORES — el único sitio donde se decide quién sirve qué.
 *
 * Cambiar de fuente es cambiar una variable de entorno. Si mañana se contrata
 * api-basketball o una API de tenis comercial, se escribe su adapter contra el
 * puerto correspondiente, se añade una línea aquí y se mueve la env. Ningún
 * componente, ninguna página y ningún servicio se entera.
 *
 * El respaldo también se declara aquí, no en cada llamada: cada módulo puede
 * tener una cadena de proveedores, y el servicio recorre la cadena cuando el
 * primero falla con un error reintentable.
 */

import { apiFootballProvider } from '../providers/api-football/football.provider'
import { espnSoccerProvider } from '../providers/espn/soccer.provider'
import { espnNbaProvider } from '../providers/espn/nba.provider'
import { espnTennisProvider } from '../providers/espn/tennis.provider'
import { espnNewsProvider } from '../providers/espn/news.provider'
import { theOddsApiProvider } from '../providers/the-odds-api/odds.provider'
import type {
  BasketballProvider, FootballProvider, NewsDataProvider, OddsDataProvider,
  TennisDataProvider,
} from './ports'

/**
 * Catálogos por módulo. La clave es el valor que se pone en la env.
 *
 * Sobre la ausencia de `api-basketball`: la cuenta sigue en plan Free en
 * baloncesto (100 req/día, sin temporada en curso). Declarar el proveedor sin
 * poder servirlo sería prometer algo que no existe; entra el día que se
 * contrate y se escriba su adapter.
 */
const FOOTBALL: Record<string, FootballProvider> = {
  'api-football': apiFootballProvider,
  espn: espnSoccerProvider,
}

const BASKETBALL: Record<string, BasketballProvider> = {
  espn: espnNbaProvider,
}

const TENNIS: Record<string, TennisDataProvider> = {
  espn: espnTennisProvider,
}

const ODDS: Record<string, OddsDataProvider> = {
  'the-odds-api': theOddsApiProvider,
}

const NEWS: Record<string, NewsDataProvider> = {
  espn: espnNewsProvider,
}

/**
 * Cadena por defecto de cada módulo, en orden de preferencia.
 *
 * Fútbol lleva respaldo porque hay dos fuentes reales y la de pago tiene
 * cuota diaria. Los demás módulos tienen una sola fuente hoy: se declara
 * así, sin fingir una redundancia que no existe.
 */
const DEFAULT_CHAINS = {
  football: ['api-football', 'espn'],
  basketball: ['espn'],
  tennis: ['espn'],
  odds: ['the-odds-api'],
  news: ['espn'],
} as const

/**
 * Lee la env y devuelve la cadena efectiva. Acepta lista separada por comas
 * (`FOOTBALL_PROVIDER=espn,api-football` invierte la preferencia). Los nombres
 * desconocidos se ignoran en silencio: una env mal escrita no debe tumbar el
 * arranque, solo caer al orden por defecto.
 */
function chain<T>(envVar: string, catalog: Record<string, T>, fallback: readonly string[]): T[] {
  const raw = process.env[envVar]
  const names = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
  const picked = names.map((n) => catalog[n]).filter((p): p is T => p !== undefined)
  if (picked.length > 0) return picked
  return fallback.map((n) => catalog[n]).filter((p): p is T => p !== undefined)
}

export function footballProviders(): FootballProvider[] {
  return chain('FOOTBALL_PROVIDER', FOOTBALL, DEFAULT_CHAINS.football)
}

export function basketballProviders(): BasketballProvider[] {
  return chain('BASKETBALL_PROVIDER', BASKETBALL, DEFAULT_CHAINS.basketball)
}

export function tennisProviders(): TennisDataProvider[] {
  return chain('TENNIS_PROVIDER', TENNIS, DEFAULT_CHAINS.tennis)
}

export function oddsProviders(): OddsDataProvider[] {
  return chain('ODDS_PROVIDER', ODDS, DEFAULT_CHAINS.odds)
}

export function newsProviders(): NewsDataProvider[] {
  return chain('NEWS_PROVIDER', NEWS, DEFAULT_CHAINS.news)
}

/** Inventario para diagnóstico (`/api/admin/health`). No expone claves. */
export function providerInventory() {
  return {
    football: footballProviders().map(describe),
    basketball: basketballProviders().map(describe),
    tennis: tennisProviders().map(describe),
    odds: oddsProviders().map(describe),
    news: newsProviders().map(describe),
  }
}

function describe(p: { id: string; capabilities: ReadonlySet<string>; quotaCostPerCall: number }) {
  return {
    id: p.id,
    capabilities: [...p.capabilities].sort(),
    quotaCostPerCall: p.quotaCostPerCall,
  }
}
