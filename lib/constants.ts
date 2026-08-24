/**
 * Constantes globales de la app.
 */

// Versión del motor de predicción. Fuente única de verdad: se muestra en
// el sidebar, dashboard y predicciones para evitar desincronización.
export const MODEL_VERSION = '1.2.0'

// Mundial FIFA 2026 — competición ARCHIVADA (ver lib/sports.ts). Se conserva
// como constante porque sus filas siguen en la base y hay que poder
// referirlas: la página de archivo /mundial, la exclusión de los procesos
// transversales y los servicios de sync inactivos. Fuera de eso, nada
// debería filtrar por este id.
export const COMPETITION_ID =
  process.env.NEXT_PUBLIC_COMPETITION_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

// URL pública del sitio (SEO: sitemap, robots, metadata canónica).
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://world-cup-predictor-2026-flax.vercel.app'

// Etiquetas en español de cada fase del torneo.
export const PHASE_LABELS: Record<string, string> = {
  group:         'Fase de Grupos',
  round_of_32:   'Dieciseisavos de Final',
  round_of_16:   'Octavos de Final',
  quarter_final: 'Cuartos de Final',
  semi_final:    'Semifinales',
  third_place:   'Tercer Puesto',
  final:         'Final',
  league:        'Liga',
}

// ─── Ligas: una competición POR TEMPORADA ────────────────────────────────
//
// Modelo (decisión 2026-08): cada par (liga, temporada) es su propia fila en
// `competitions`. Antes había una sola fila por liga y la temporada era solo
// una etiqueta; al llegar la 2026-27 eso habría mezclado dos campañas en la
// misma tabla de posiciones (el constraint (competition_id, match_number) lo
// impidió, haciendo bien su trabajo). Con este modelo el histórico se
// conserva y se puede comparar temporada contra temporada.
//
// UUID determinista: `{apiFootballId}{año}-0000-4000-8000-{apiFootballId}`.
// Las filas de 2024 mantienen `{id}000000-…` para no reescribir lo existente.
//
// Etiqueta de temporada: las europeas van ago-may ("2026-27"); las de año
// calendario (Colombia) usan el año a secas ("2026").

/** Temporada en curso de cada liga. Añadir una temporada = tocar esto + migración. */
export const CURRENT_LEAGUE_SEASON = '2026'

/** (liga → temporada → competition_id). Fuente única del histórico. */
export const LEAGUE_SEASON_COMPETITIONS: Record<string, Record<string, string>> = {
  premier_league: {
    '2024': '39000000-0000-4000-8000-000000000039',
    '2026': '39002026-0000-4000-8000-000000000039',
  },
  la_liga: {
    '2024': '14000000-0000-4000-8000-000000000140',
    '2026': '14002026-0000-4000-8000-000000000140',
  },
  serie_a: {
    '2024': '13500000-0000-4000-8000-000000000135',
    '2026': '13502026-0000-4000-8000-000000000135',
  },
  bundesliga: {
    '2024': '78000000-0000-4000-8000-000000000078',
    '2026': '78002026-0000-4000-8000-000000000078',
  },
  ligue_1: {
    '2024': '61000000-0000-4000-8000-000000000061',
    '2026': '61002026-0000-4000-8000-000000000061',
  },
  liga_betplay: {
    '2024': '23900000-0000-4000-8000-000000000239',
    '2026': '23902026-0000-4000-8000-000000000239',
  },
}

/**
 * Competición de la temporada EN CURSO por liga. Es lo que consumen las
 * páginas públicas, la ingesta y la calibración: la plataforma muestra la
 * campaña que se está jugando.
 */
export const LEAGUE_COMPETITION_IDS: Record<string, string> = Object.fromEntries(
  Object.entries(LEAGUE_SEASON_COMPETITIONS)
    .map(([key, seasons]) => [key, seasons[CURRENT_LEAGUE_SEASON]])
    .filter(([, id]) => Boolean(id)),
)

/** TODAS las competiciones de una liga (todas sus temporadas). */
export function leagueAllCompetitionIds(leagueKey: string): string[] {
  return Object.values(LEAGUE_SEASON_COMPETITIONS[leagueKey] ?? {})
}

/**
 * Todas las competiciones de liga de todas las temporadas. La usan el
 * backtest (más temporadas = mejor muestra) y las listas blancas por
 * deporte, que deben reconocer también los partidos históricos.
 */
export const ALL_LEAGUE_COMPETITION_IDS: string[] = Object.values(LEAGUE_SEASON_COMPETITIONS)
  .flatMap((seasons) => Object.values(seasons))

/** Orden editorial por CLAVE de liga (independiente de la temporada). */
export const LEAGUE_KEY_ORDER = [
  'liga_betplay', 'premier_league', 'la_liga', 'serie_a', 'bundesliga', 'ligue_1',
] as const

/** Clave interna de liga → slug de URL. */
export const LEAGUE_KEY_TO_SLUG: Record<string, string> = {
  liga_betplay: 'liga-betplay',
  premier_league: 'premier-league',
  la_liga: 'la-liga',
  serie_a: 'serie-a',
  bundesliga: 'bundesliga',
  ligue_1: 'ligue-1',
}

/** Etiqueta de temporada en BD para una liga y un año de API-Football. */
export function leagueSeasonLabel(leagueKey: string, apiSeason: number): string {
  const calendarYear = leagueKey === 'liga_betplay'
  return calendarYear ? String(apiSeason) : `${apiSeason}-${String((apiSeason + 1) % 100).padStart(2, '0')}`
}

// Slugs de URL de cada liga (/ligas/[slug]) y su nombre visible.
export const LEAGUE_SLUGS: Record<string, string> = {
  'liga-betplay':   LEAGUE_COMPETITION_IDS.liga_betplay,
  'premier-league': LEAGUE_COMPETITION_IDS.premier_league,
  'la-liga':        LEAGUE_COMPETITION_IDS.la_liga,
  'serie-a':        LEAGUE_COMPETITION_IDS.serie_a,
  'bundesliga':     LEAGUE_COMPETITION_IDS.bundesliga,
  'ligue-1':        LEAGUE_COMPETITION_IDS.ligue_1,
}

// Q4: orden editorial de las ligas (relevancia para la audiencia), no
// alfabético. BetPlay va primera: es la liga local de la audiencia
// (plataforma en español, zona horaria de Bogotá).
export const LEAGUE_DISPLAY_ORDER = [
  LEAGUE_COMPETITION_IDS.liga_betplay,
  LEAGUE_COMPETITION_IDS.premier_league,
  LEAGUE_COMPETITION_IDS.la_liga,
  LEAGUE_COMPETITION_IDS.serie_a,
  LEAGUE_COMPETITION_IDS.bundesliga,
  LEAGUE_COMPETITION_IDS.ligue_1,
]

export const LEAGUE_NAMES: Record<string, string> = {
  'liga-betplay':   'Liga BetPlay',
  'premier-league': 'Premier League',
  'la-liga':        'La Liga',
  'serie-a':        'Serie A',
  'bundesliga':     'Bundesliga',
  'ligue-1':        'Ligue 1',
}

// ─── Copa Libertadores ────────────────────────────────────────────────────
//
// No es una liga round-robin (leagueEngine.ts): es grupos + eliminación
// directa a doble partido, como el Mundial — ver services/sync/libertadores-ingest.ts.
// Mismo patrón determinista de UUID que las ligas.

export const LIBERTADORES_API_ID = 13
export const LIBERTADORES_COMPETITION_ID = '13002026-0000-4000-8000-000000000013'

/**
 * Slug de URL de una liga a partir de su competition_id. Reconoce CUALQUIER
 * temporada: un partido de 2024-25 debe seguir enlazando a su liga.
 */
export function leagueSlugById(competitionId: string): string | null {
  for (const [leagueKey, seasons] of Object.entries(LEAGUE_SEASON_COMPETITIONS)) {
    if (Object.values(seasons).includes(competitionId)) {
      const slug = Object.keys(LEAGUE_NAMES).find(
        (s) => LEAGUE_SLUGS[s] === LEAGUE_COMPETITION_IDS[leagueKey],
      )
      if (slug) return slug
    }
  }
  return null
}
