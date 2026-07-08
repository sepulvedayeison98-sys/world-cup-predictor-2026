/**
 * Constantes globales de la app.
 */

// Versión del motor de predicción. Fuente única de verdad: se muestra en
// el sidebar, dashboard y predicciones para evitar desincronización.
export const MODEL_VERSION = '1.2.0'

// Competición activa (Mundial FIFA 2026). Fuente única de verdad: antes
// estaba copiado como literal en ~10 archivos.
export const COMPETITION_ID =
  process.env.NEXT_PUBLIC_COMPETITION_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

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

// Competiciones de ligas (Fase 4, migraciones 043/045). Los UUID codifican
// el id de liga de API-Football (39 = Premier, 140 = La Liga, 135 = Serie A,
// 78 = Bundesliga, 61 = Ligue 1).
export const LEAGUE_COMPETITION_IDS: Record<string, string> = {
  premier_league: '39000000-0000-4000-8000-000000000039',
  la_liga:        '14000000-0000-4000-8000-000000000140',
  serie_a:        '13500000-0000-4000-8000-000000000135',
  bundesliga:     '78000000-0000-4000-8000-000000000078',
  ligue_1:        '61000000-0000-4000-8000-000000000061',
}

// Slugs de URL de cada liga (/ligas/[slug]) y su nombre visible.
export const LEAGUE_SLUGS: Record<string, string> = {
  'premier-league': LEAGUE_COMPETITION_IDS.premier_league,
  'la-liga':        LEAGUE_COMPETITION_IDS.la_liga,
  'serie-a':        LEAGUE_COMPETITION_IDS.serie_a,
  'bundesliga':     LEAGUE_COMPETITION_IDS.bundesliga,
  'ligue-1':        LEAGUE_COMPETITION_IDS.ligue_1,
}

export const LEAGUE_NAMES: Record<string, string> = {
  'premier-league': 'Premier League',
  'la-liga':        'La Liga',
  'serie-a':        'Serie A',
  'bundesliga':     'Bundesliga',
  'ligue-1':        'Ligue 1',
}

/** Slug de URL de una liga a partir de su competition_id. */
export function leagueSlugById(competitionId: string): string | null {
  const entry = Object.entries(LEAGUE_SLUGS).find(([, id]) => id === competitionId)
  return entry ? entry[0] : null
}
