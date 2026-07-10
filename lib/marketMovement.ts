/**
 * Movimiento del mercado (playbook Sofascore, mejora 7) — módulo puro.
 *
 * Compara las cuotas nuevas de Pinnacle contra las anteriores y produce
 * filas para `market_movements` cuando el precio real se movió. La historia
 * la escribe el sync (append-only); aquí solo la lógica, testeable. Cero
 * datos fabricados: si no hay cuota previa, no hay movimiento que reportar.
 */

export interface MovementRow {
  match_id: string
  market: string
  bookmaker: string
  odds_before: number
  odds_after: number
  /** Cambio en probabilidad implícita: positivo = cuota bajó (equipo sube) */
  prob_shift_pct: number
  is_significant: boolean
}

/** Cambio mínimo de prob. implícita para registrar (filtra ruido de redondeo). */
const MIN_SHIFT = 0.01
/** Umbral de "movimiento significativo" (coincide con el schema: |shift| > 5%). */
const SIGNIFICANT = 0.05

/**
 * `oldMap`/`newMap`: market → odds_value (decimal). Devuelve una fila por
 * mercado cuya cuota se movió más que MIN_SHIFT en probabilidad implícita.
 */
export function computeMovements(
  matchId: string,
  bookmaker: string,
  oldMap: Map<string, number>,
  newMap: Map<string, number>,
): MovementRow[] {
  const rows: MovementRow[] = []
  for (const [market, after] of newMap) {
    const before = oldMap.get(market)
    if (before == null || before <= 1 || after <= 1) continue
    const shift = 1 / after - 1 / before // Δ probabilidad implícita
    if (Math.abs(shift) < MIN_SHIFT) continue
    rows.push({
      match_id: matchId,
      market,
      bookmaker,
      odds_before: Math.round(before * 100) / 100,
      odds_after: Math.round(after * 100) / 100,
      prob_shift_pct: Math.round(shift * 10000) / 10000,
      is_significant: Math.abs(shift) > SIGNIFICANT,
    })
  }
  return rows
}
