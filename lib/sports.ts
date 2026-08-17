/**
 * Registro de deportes y competiciones — la fuente única de la
 * arquitectura multi-deporte (auditoría, Fase 2/5).
 *
 * Regla: la navegación raíz NUNCA crece con nuevas competiciones;
 * crece este registro y la UI (selector, hubs, buscador) lo refleja.
 * Agregar un deporte/competición = agregar una entrada aquí + su hub.
 */
import { COMPETITION_ID, LEAGUE_NAMES, LEAGUE_SLUGS, ALL_LEAGUE_COMPETITION_IDS, LIBERTADORES_COMPETITION_ID } from '@/lib/constants'
import { NBA_COMPETITION_ID } from '@/lib/nba/constants'
import { ATP_COMPETITION_ID, WTA_COMPETITION_ID, TENNIS_MODEL_VERSION } from '@/lib/tennis/constants'

export type SportSlug = 'futbol' | 'baloncesto' | 'tenis'
/**
 * 'activa'        → se está jugando: va en la navegación principal.
 * 'proximamente'  → prometida, sin datos todavía: se muestra como promesa.
 * 'historica'     → terminada: sus datos y métricas se CONSERVAN (son el
 *                   historial verificable del motor) pero deja de ocupar la
 *                   navegación principal. No se borra nada.
 */
export type CompetitionStatus = 'activa' | 'proximamente' | 'historica'

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
    // Terminado el 19 de julio de 2026. Pasa a histórico: la plataforma se
    // centra en las ligas en curso, pero sus 91 predicciones resueltas
    // siguen contando como historial del motor (ver /mundial/balance).
    status: 'historica',
    note: 'Torneo finalizado',
  },
  ...Object.entries(LEAGUE_SLUGS).map(([slug, id]) => ({
    id,
    slug,
    name: LEAGUE_NAMES[slug] ?? slug,
    sport: 'futbol' as SportSlug,
    href: `/ligas/${slug}`,
    status: 'activa' as CompetitionStatus,
    note: slug === 'liga-betplay' ? 'Temporada 2026' : 'Temporada 2026-27',
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
  { id: ATP_COMPETITION_ID, slug: 'atp', name: 'ATP Tour', sport: 'tenis', href: '/tennis', status: 'activa', note: `Motor ${TENNIS_MODEL_VERSION}` },
  { id: WTA_COMPETITION_ID, slug: 'wta', name: 'WTA Tour', sport: 'tenis', href: '/tennis', status: 'proximamente', note: 'Pendiente de fuente' },
  // Copa Libertadores 2026: grupos + eliminación directa a doble partido
  // (octavos en curso, ver services/sync/libertadores-ingest.ts). No es una
  // liga round-robin — comparte esquema con el Mundial (groups/group_standings),
  // no leagueEngine.ts.
  {
    id: LIBERTADORES_COMPETITION_ID,
    slug: 'copa-libertadores',
    name: 'Copa Libertadores',
    sport: 'futbol',
    href: '/copa-libertadores',
    status: 'activa',
    note: 'Octavos de final',
  },
  // Próximas paradas del roadmap — visibles como promesa, no como enlace
  { id: null, slug: 'champions-league', name: 'Champions League', sport: 'futbol', href: '#', status: 'proximamente' },
]

export const ACTIVE_COMPETITIONS = COMPETITIONS_NAV.filter((c) => c.status === 'activa')

/** Competiciones terminadas: fuera de la navegación, dentro del historial. */
export const HISTORIC_COMPETITIONS = COMPETITIONS_NAV.filter((c) => c.status === 'historica')

/** Hub de una competición a partir de su competition_id de la BD. */
export function competitionHref(competitionId: string): string {
  return COMPETITIONS_NAV.find((c) => c.id === competitionId)?.href ?? '/ligas'
}

/** Deporte de una competición (por defecto fútbol, que es lo histórico). */
export function sportOfCompetition(competitionId: string): SportSlug {
  return COMPETITIONS_NAV.find((c) => c.id === competitionId)?.sport ?? 'futbol'
}

/**
 * IDs de las competiciones ACTIVAS de un deporte: lo que se está jugando y,
 * por tanto, lo que las páginas deben mostrar hoy. Es la contraparte de
 * `competitionIdsOfSport`, que además incluye las históricas porque responde
 * a una pregunta distinta (qué ES de este deporte, no qué se muestra).
 */
export function activeCompetitionIdsOfSport(sport: SportSlug): string[] {
  return ACTIVE_COMPETITIONS
    .filter((c) => c.sport === sport && c.id !== null)
    .map((c) => c.id as string)
}

/**
 * IDs de las competiciones activas de un deporte. Es la lista blanca que
 * deben usar los procesos transversales (Smart Bets, sync globales) para
 * no cruzar deportes: un motor de fútbol jamás debe procesar partidos
 * de baloncesto, y viceversa.
 */
export function competitionIdsOfSport(sport: SportSlug): string[] {
  // Incluye las ACTIVAS y las HISTÓRICAS: esta lista responde "¿qué
  // competiciones son de este deporte?" (barrera de seguridad), no "¿cuáles
  // se muestran en la navegación" — eso es ACTIVE_COMPETITIONS. Un torneo
  // terminado sigue siendo fútbol y sus datos deben poder resolverse.
  const ids = COMPETITIONS_NAV
    .filter((c) => c.sport === sport && c.id !== null && c.status !== 'proximamente')
    .map((c) => c.id as string)
  // Las ligas tienen una competición POR TEMPORADA: la lista blanca debe
  // reconocer también las campañas anteriores, o los procesos transversales
  // (Smart Bets, resolución de picks) dejarían de ver los partidos históricos
  // al empezar una temporada nueva.
  if (sport === 'futbol') {
    for (const id of ALL_LEAGUE_COMPETITION_IDS) if (!ids.includes(id)) ids.push(id)
  }
  return ids
}
