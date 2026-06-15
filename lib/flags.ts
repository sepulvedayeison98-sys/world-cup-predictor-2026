/**
 * Mapeo de código FIFA (3 letras, `teams.code`) -> código de bandera para
 * flagcdn.com (ISO 3166-1 alpha-2, o subdivisión gb-eng/gb-sct para UK).
 * Cubre los 48 equipos del Mundial 2026.
 */
export const CODE_TO_ISO: Record<string, string> = {
  // Grupo A
  MEX: 'mx', RSA: 'za', KOR: 'kr', CZE: 'cz',
  // Grupo B
  CAN: 'ca', BIH: 'ba', QAT: 'qa', SUI: 'ch',
  // Grupo C
  BRA: 'br', MAR: 'ma', HAI: 'ht', SCO: 'gb-sct',
  // Grupo D
  USA: 'us', PAR: 'py', AUS: 'au', TUR: 'tr',
  // Grupo E
  GER: 'de', CUW: 'cw', CIV: 'ci', ECU: 'ec',
  // Grupo F
  NED: 'nl', JPN: 'jp', SWE: 'se', TUN: 'tn',
  // Grupo G
  BEL: 'be', EGY: 'eg', IRN: 'ir', NZL: 'nz',
  // Grupo H
  ESP: 'es', CPV: 'cv', KSA: 'sa', URU: 'uy',
  // Grupo I
  FRA: 'fr', SEN: 'sn', IRQ: 'iq', NOR: 'no',
  // Grupo J
  ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo',
  // Grupo K
  POR: 'pt', COD: 'cd', UZB: 'uz', COL: 'co',
  // Grupo L
  ENG: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa',
}

export function isoForCode(code?: string | null): string | null {
  if (!code) return null
  return CODE_TO_ISO[code] ?? null
}
