/**
 * Probabilidad implícita del mercado 1X2 (playbook Sofascore, mejora 9) —
 * módulo puro. A partir de las cuotas 1X2 de Pinnacle quita el margen
 * (overround) normalizando para que sumen 1: así se compara la probabilidad
 * JUSTA del mercado contra la del modelo. Cero fabricado: si falta alguna de
 * las tres cuotas, no hay mercado que mostrar (devuelve null).
 */

export interface Implied1X2 {
  home: number
  draw: number
  away: number
}

/** Devig 1X2: implícitas crudas (1/cuota) normalizadas a suma 1. */
export function deviggedImplied(
  homeOdds: number | null | undefined,
  drawOdds: number | null | undefined,
  awayOdds: number | null | undefined,
): Implied1X2 | null {
  if (!homeOdds || !drawOdds || !awayOdds) return null
  if (homeOdds <= 1 || drawOdds <= 1 || awayOdds <= 1) return null
  const rh = 1 / homeOdds, rd = 1 / drawOdds, ra = 1 / awayOdds
  const sum = rh + rd + ra
  if (sum <= 0) return null
  return { home: rh / sum, draw: rd / sum, away: ra / sum }
}

/**
 * A partir de un arreglo de odds (filas de la BD con market + implied_probability)
 * arma las implícitas 1X2 de un bookmaker, ya normalizadas (devig).
 */
export function marketImpliedFromOdds(
  odds: { bookmaker?: string; market?: string; implied_probability?: number; odds_value?: number }[],
  bookmaker = 'Pinnacle',
): Implied1X2 | null {
  const pick = (market: string) =>
    odds.find((o) => o.bookmaker === bookmaker && o.market === market)
  const h = pick('home_win'), d = pick('draw'), a = pick('away_win')
  if (!h || !d || !a) return null
  // Preferir odds_value (para devig por cuota); si no, usar implícita cruda
  if (h.odds_value && d.odds_value && a.odds_value) {
    return deviggedImplied(h.odds_value, d.odds_value, a.odds_value)
  }
  const rh = h.implied_probability, rd = d.implied_probability, ra = a.implied_probability
  if (rh == null || rd == null || ra == null) return null
  const sum = rh + rd + ra
  return sum > 0 ? { home: rh / sum, draw: rd / sum, away: ra / sum } : null
}
