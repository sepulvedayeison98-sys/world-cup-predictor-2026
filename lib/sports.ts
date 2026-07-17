/**
 * Registro de deportes y competiciones — la fuente única de la
 * arquitectura multi-deporte (auditoría, Fase 2/5).
 *
 * Regla: la navegación raíz NUNCA crece con nuevas competiciones;
 * crece este registro y la UI (selector, hubs, buscador) lo refleja.
 * Agregar un deporte/competición = agregar una entrada aquí + su hub.
 */
import { COMPETITION_ID, LEAGUE_NAMES, LEAGUE_SLUGS } from '@/lib/constants'
import { NBA_COMPETITION_ID } from '@/lib/nba/constants'
import { ATP_COMPETITION_ID, WTA_COMPETITION_ID } from '@/lib/tennis/constants'

export type SportSlug = 'futbol' | 'baloncesto' | 'tenis'
export type CompetitionStatus = 'activa' | 'proximamente'

export interface CompetitionEntry {
  /** competition_id en la BD (null si aún no existe) */
  id: string | null
  slug: string
  name: string
  sport: SportSlug
  /** Ruta del hub de la competición */
  href: string
  status: CompetitionStatus
  /** Nota corta de estado que ve el usuario (momento vital) */
  note?: string
}

export interface SportEntry {
  slug: SportSlug
  name: string
  status: CompetitionStatus
}

export const SPORTS: SportEntry[] = [
  { slug: 'futbol', name: 'Fútbol', status: 'activa' },
  { slug: 'baloncesto', name: 'Baloncesto', status: 'activa' },
  { slug: 'tenis', name: 'Tenis', status: 'activa' },
]

export const COMPETITIONS_NAV: CompetitionEntry[] = [
  {
    id: COMPETITION_ID,
    slug: 'mundial-2026',
    name: 'Mundial 2026',
    sport: 'futbol',
    href: '/mundial',
    status: 'activa',
    note: 'Final: 19 de julio',
  },
  ...Object.entries(LEAGUE_SLUGS).map(([slug, id]) => ({
    id,
    slug,
    name: LEAGUE_NAMES[slug] ?? slug,
    sport: 'futbol' as SportSlug,
    href: `/ligas/${slug}`,
    status: 'activa' as CompetitionStatus,
    note: 'Temporada 2026-27 en agosto',
  })),
  {
    id: NBA_COMPETITION_ID,
    slug: 'nba',
    name: 'NBA',
    sport: 'baloncesto',
    href: '/nba',
    status: 'activa',
    note: 'Temporada 2024-25',
  },
  // Tenis: tercer dominio (migración 053). ATP activa desde la Fase 8 (hub
  // /tennis con ranking, perfiles y motor tennis-1.0 medido). WTA sigue como
  // promesa honesta hasta que exista una fuente de datos verificable.
  { id: ATP_COMPETITION_ID, slug: 'atp', name: 'ATP Tour', sport: 'tenis', href: '/tennis', status: 'activa', note: 'Motor tennis-2.0' },
  { id: WTA_COMPETITION_ID, slug: 'wta', name: 'WTA Tour', sport: 'tenis', href: '/tennis', status: 'proximamente', note: 'Pendiente de fuente' },
  // Próximas paradas del roadmap — visibles como promesa, no como enlace
  { id: null, slug: 'champions-league', name: 'Champions League', sport: 'futbol', href: '#', status: 'proximamente' },
  { id: null, slug: 'copa-libertadores', name: 'Copa Libertadores', sport: 'futbol', href: '#', status: 'proximamente' },
]

export const ACTIVE_COMPETITIONS = COMPETITIONS_NAV.filter((c) => c.status === 'activa')

/** Hub de una competición a partir de su competition_id de la BD. */
export function competitionHref(competitionId: string): string {
  return COMPETITIONS_NAV.find((c) => c.id === competitionId)?.href ?? '/ligas'
}

/** Deporte de una competición (por defecto fútbol, que es lo histórico). */
export function sportOfCompetition(competitionId: string): SportSlug {
  return COMPETITIONS_NAV.find((c) => c.id === competitionId)?.sport ?? 'futbol'
}

/**
 * IDs de las competiciones activas de un deporte. Es la lista blanca que
 * deben usar los procesos transversales (Smart Bets, sync globales) para
 * no cruzar deportes: un motor de fútbol jamás debe procesar partidos
 * de baloncesto, y viceversa.
 */
export function competitionIdsOfSport(sport: SportSlug): string[] {
  return ACTIVE_COMPETITIONS
    .filter((c) => c.sport === sport && c.id !== null)
    .map((c) => c.id as string)
}
