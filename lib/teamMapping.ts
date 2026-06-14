/**
 * Mapeo de nombres de equipo (en ingles, como los devuelven API-Football y
 * The Odds API) -> codigo FIFA de 3 letras usado en nuestra tabla `teams.code`.
 *
 * Incluye alias para las variantes mas comunes. La resolucion normaliza
 * (minusculas, sin acentos ni puntuacion) antes de buscar.
 */

export const ENGLISH_NAME_TO_CODE: Record<string, string> = {
  // Group A
  'mexico': 'MEX',
  'south africa': 'RSA',
  'south korea': 'KOR', 'korea republic': 'KOR', 'republic of korea': 'KOR',
  'czechia': 'CZE', 'czech republic': 'CZE',
  // Group B
  'canada': 'CAN',
  'bosnia and herzegovina': 'BIH', 'bosnia herzegovina': 'BIH', 'bosnia': 'BIH',
  'qatar': 'QAT',
  'switzerland': 'SUI',
  // Group C
  'brazil': 'BRA',
  'morocco': 'MAR',
  'haiti': 'HAI',
  'scotland': 'SCO',
  // Group D
  'united states': 'USA', 'usa': 'USA', 'united states of america': 'USA',
  'paraguay': 'PAR',
  'australia': 'AUS',
  'turkiye': 'TUR', 'turkey': 'TUR',
  // Group E
  'germany': 'GER',
  'curacao': 'CUW',
  'ivory coast': 'CIV', 'cote divoire': 'CIV',
  'ecuador': 'ECU',
  // Group F
  'netherlands': 'NED',
  'japan': 'JPN',
  'sweden': 'SWE',
  'tunisia': 'TUN',
  // Group G
  'belgium': 'BEL',
  'egypt': 'EGY',
  'iran': 'IRN', 'ir iran': 'IRN',
  'new zealand': 'NZL',
  // Group H
  'spain': 'ESP',
  'cape verde': 'CPV', 'cabo verde': 'CPV',
  'saudi arabia': 'KSA',
  'uruguay': 'URU',
  // Group I
  'france': 'FRA',
  'senegal': 'SEN',
  'iraq': 'IRQ',
  'norway': 'NOR',
  // Group J
  'argentina': 'ARG',
  'algeria': 'ALG',
  'austria': 'AUT',
  'jordan': 'JOR',
  // Group K
  'portugal': 'POR',
  'dr congo': 'COD', 'congo dr': 'COD', 'democratic republic of the congo': 'COD', 'congo democratic republic': 'COD',
  'uzbekistan': 'UZB',
  'colombia': 'COL',
  // Group L
  'england': 'ENG',
  'croatia': 'CRO',
  'ghana': 'GHA',
  'panama': 'PAN',
}

/** Normaliza un nombre: minusculas, sin acentos, sin puntuacion, espacios colapsados. */
export function normalizeTeamName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // quita diacriticos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')      // quita puntuacion
    .replace(/\s+/g, ' ')
    .trim()
}

/** Devuelve el codigo FIFA para un nombre en ingles, o null si no se reconoce. */
export function resolveTeamCode(name: string): string | null {
  if (!name) return null
  return ENGLISH_NAME_TO_CODE[normalizeTeamName(name)] ?? null
}
