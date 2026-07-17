/**
 * DOMINIO TENNIS — proxy de fatiga y descanso (motor tennis-2.0). Módulo
 * puro. Se deriva SOLO del calendario real (fechas de partido, granularidad
 * de día) y del marcador (para detectar partidos largos).
 *
 * HONESTIDAD: la fuente no trae minutos jugados ni viajes, así que esto es un
 * PROXY declarado — densidad de partidos + descanso + partidos a 3+ sets
 * recientes. No pretende ser carga física exacta; se declara como
 * aproximación. Nada se inventa.
 */

export interface FatigueMatch {
  p1_id: string | null
  p2_id: string | null
  scheduled_at: string | null
  score: string | null
  status: string
}

const COUNTABLE = new Set(['finished', 'retired'])
const DAY = 86400000

/** Nº de sets del marcador ("6-4 3-6 7-6(5)" → 3). 0 si no se puede leer. */
export function setCount(score: string | null): number {
  if (!score) return 0
  return score.trim().split(/\s+/).filter((s) => /^\d+-\d+/.test(s)).length
}

export interface FatigueProfile {
  matchesLast7d: number
  matchesLast14d: number
  daysRest: number | null       // días desde el último partido (null si ninguno)
  threeSetLast14d: number       // partidos de 3+ sets en 14 días
  freshnessIndex: number        // 0-100 (100 = fresco; proxy)
}

/**
 * Perfil de frescura de un jugador a una fecha de referencia, usando solo sus
 * partidos ANTERIORES a esa fecha (walk-forward safe).
 */
export function computeFatigue(
  matches: FatigueMatch[], playerId: string, refIso: string,
): FatigueProfile {
  const ref = new Date(refIso).getTime()
  const mine = matches
    .filter((m) => COUNTABLE.has(m.status) && (m.p1_id === playerId || m.p2_id === playerId))
    .map((m) => ({ t: new Date(m.scheduled_at ?? '').getTime(), sets: setCount(m.score) }))
    .filter((m) => Number.isFinite(m.t) && m.t < ref)
    .sort((a, b) => b.t - a.t) // más reciente primero

  const out: FatigueProfile = {
    matchesLast7d: 0, matchesLast14d: 0, daysRest: null, threeSetLast14d: 0, freshnessIndex: 100,
  }
  if (mine.length === 0) return out

  out.daysRest = Math.floor((ref - mine[0].t) / DAY)
  for (const m of mine) {
    const ageDays = (ref - m.t) / DAY
    if (ageDays <= 7) out.matchesLast7d++
    if (ageDays <= 14) { out.matchesLast14d++; if (m.sets >= 3) out.threeSetLast14d++ }
  }

  // Escalado a frescura 0-100 (anclas a priori, documentadas). Cada partido
  // en 7 días pesa; los de 3+ sets suman carga extra; el descanso modula.
  let load = out.matchesLast7d * 14 + out.threeSetLast14d * 8
  if (out.daysRest != null) {
    if (out.daysRest <= 1) load *= 1.3        // back-to-back
    else if (out.daysRest >= 6) load *= 0.5   // bien descansado
  }
  out.freshnessIndex = Math.max(0, Math.min(100, Math.round(100 - load)))
  return out
}
