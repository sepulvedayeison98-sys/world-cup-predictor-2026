/**
 * DOMINIO TENNIS — motor tennis-2.0 (composición FINAL, elegida por ablación
 * medida sobre el histórico real; ver docs/TENNIS_ARCHITECTURE.md).
 *
 * Pesos (TENNIS2_WEIGHTS): 40% ranking+ELO (el ancla probada de 1.1) · 15%
 * ELO por superficie · 15% forma · 15% saque/devolución · 10% H2H · 5%
 * mercado (hoy sin fuente → renormalizado). Todo factor ausente renormaliza
 * los presentes; si no hay ninguno, no hay veredicto (Data First).
 *
 * Notas de la ablación (todas medidas walk-forward, sin fuga):
 * · La especificación "superficie dominante 30%" midió PEOR que 1.1: el ELO
 *   de superficie solo es más ruidoso que el ancla ranking+ELO. Descartada.
 * · saque/devolución (hold%+break% reales, cobertura 100%) SUMA señal.
 * · La fatiga con granularidad "fecha de inicio de torneo" midió dañina y
 *   quedó FUERA del motor (lib/tennis/fatigue.ts permanece como módulo puro
 *   para cuando la fuente tenga fechas/minutos por partido).
 *
 * Se construye SOBRE el walk-state 1.1 (ELO global+superficie con siembra
 * por ranking, forma, H2H) y añade el acumulador walk-forward de
 * saque/devolución por jugador.
 */
import { TENNIS2_WEIGHTS } from './constants'
import {
  ELO_COUNTABLE, eloExpected, formLog5, rankToSeedElo,
  createWalkState, advanceWalkState,
  type TEngineMatch, type TennisWalkState, type WalkSeed,
} from './engine'

/** Filas de stats de un partido, por jugador (subconjunto que usa 2.0). */
export interface T2MatchStats {
  service_games: number | null
  break_points_faced: number | null
  break_points_saved: number | null
}

interface SRAccum { svGames: number; svBroken: number; retGames: number; breaks: number; statMatches: number }

export interface TennisWalkState2 {
  base: TennisWalkState
  sr: Map<string, SRAccum>
}

export function createWalkState2(): TennisWalkState2 {
  return { base: createWalkState(), sr: new Map() }
}

/** Escala a priori del matchup saque/devolución (hold+break combinados). */
export const K_SERVE_RETURN = 2.7
/** Mínimo de partidos con stats por jugador para que el factor exista. */
export const SR_MIN_MATCHES = 3

/**
 * Incorpora el resultado real al estado 2.0 (llamar DESPUÉS de predecir).
 * stats: filas del partido por jugador (p1/p2), si la fuente las trae.
 */
export function advanceWalkState2(
  state: TennisWalkState2, m: TEngineMatch,
  stats?: { p1?: T2MatchStats | null; p2?: T2MatchStats | null },
  seed?: WalkSeed,
): void {
  if (!m.p1_id || !m.p2_id || !m.winner_id || !ELO_COUNTABLE.has(m.status)) return
  advanceWalkState(state.base, m, seed)

  // Acumuladores de saque/devolución (propio = saque; rival = devolución)
  const upd = (pid: string, own?: T2MatchStats | null, rival?: T2MatchStats | null) => {
    const a = state.sr.get(pid) ?? { svGames: 0, svBroken: 0, retGames: 0, breaks: 0, statMatches: 0 }
    let touched = false
    if (own && own.service_games != null && own.break_points_faced != null && own.break_points_saved != null) {
      a.svGames += own.service_games
      a.svBroken += Math.max(0, own.break_points_faced - own.break_points_saved)
      touched = true
    }
    if (rival && rival.service_games != null && rival.break_points_faced != null && rival.break_points_saved != null) {
      a.retGames += rival.service_games
      a.breaks += Math.max(0, rival.break_points_faced - rival.break_points_saved)
      touched = true
    }
    if (touched) { a.statMatches++; state.sr.set(pid, a) }
  }
  upd(m.p1_id, stats?.p1, stats?.p2)
  upd(m.p2_id, stats?.p2, stats?.p1)
}

export interface Tennis2FactorInput {
  rankingElo: number | null
  surfaceElo: number | null
  form: number | null
  serveReturn: number | null
  headToHead: number | null
  market: number | null
}

/** Fuerza combinada saque+resto de un jugador (hold% + break%, reales). */
function srStrength(a: SRAccum | undefined): number | null {
  if (!a || a.statMatches < SR_MIN_MATCHES || a.svGames === 0 || a.retGames === 0) return null
  return (a.svGames - a.svBroken) / a.svGames + a.breaks / a.retGames
}

/** Extrae los factores 2.0 del estado para un partido próximo. */
export function extractFactors2(
  state: TennisWalkState2, m: TEngineMatch,
  rankP1: number | null = null, rankP2: number | null = null,
  marketP1: number | null = null,
): Tennis2FactorInput | null {
  if (!m.p1_id || !m.p2_id) return null
  const { base } = state
  const surf = (m.surface ?? '').toLowerCase()
  const k1 = `${m.p1_id}|${surf}`, k2 = `${m.p2_id}|${surf}`

  // Ancla 40%: promedio de ELO global y ratio de ranking (fórmula 1.1, la
  // medida como mejor — el mapeo logElo midió peor y quedó descartado).
  const parts: number[] = []
  if (base.played.get(m.p1_id) && base.played.get(m.p2_id)) {
    parts.push(eloExpected(base.elo.get(m.p1_id)!, base.elo.get(m.p2_id)!))
  }
  if (rankP1 != null && rankP2 != null && rankP1 > 0 && rankP2 > 0) {
    parts.push(rankP2 / (rankP1 + rankP2))
  }
  const rankingElo = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null

  // 15%: superficie con respaldo jerárquico (la composición MEDIDA como
  // campeona): ELO de superficie si ambos tienen historial en ella; si no,
  // ELO global; si no, ranking (logElo). Sin señal alguna → null.
  let surfaceElo: number | null = null
  if (surf && base.surfacePlayed.get(k1) && base.surfacePlayed.get(k2)) {
    surfaceElo = eloExpected(base.surfaceElo.get(k1)!, base.surfaceElo.get(k2)!)
  } else if (base.played.get(m.p1_id) && base.played.get(m.p2_id)) {
    surfaceElo = eloExpected(base.elo.get(m.p1_id)!, base.elo.get(m.p2_id)!)
  } else if (rankP1 != null && rankP2 != null && rankP1 > 0 && rankP2 > 0) {
    surfaceElo = eloExpected(rankToSeedElo(rankP1), rankToSeedElo(rankP2))
  }

  const form = formLog5(base.recent.get(m.p1_id) ?? null, base.recent.get(m.p2_id) ?? null)

  const s1 = srStrength(state.sr.get(m.p1_id))
  const s2 = srStrength(state.sr.get(m.p2_id))
  const serveReturn = s1 != null && s2 != null
    ? 1 / (1 + 10 ** (-(s1 - s2) * K_SERVE_RETURN)) : null

  const pk = m.p1_id < m.p2_id ? `${m.p1_id}|${m.p2_id}` : `${m.p2_id}|${m.p1_id}`
  const h = base.h2h.get(pk) ?? [0, 0]
  const p1First = (m.p1_id < m.p2_id ? m.p1_id : m.p2_id) === m.p1_id
  const total = h[0] + h[1]
  const headToHead = total > 0 ? ((p1First ? h[0] : h[1]) + 1) / (total + 2) : null

  return { rankingElo, surfaceElo, form, serveReturn, headToHead, market: marketP1 }
}

export interface Tennis2Prediction {
  p1Probability: number
  favorite: 'p1' | 'p2'
  confidence: 'alta' | 'media' | 'baja'
  factors: Tennis2FactorInput
  effectiveWeights: Record<string, number>
}

/** Combina los factores 2.0 con renormalización honesta. */
export function predictTennisMatch2(f: Tennis2FactorInput): Tennis2Prediction | null {
  let wSum = 0, acc = 0
  const effectiveWeights: Record<string, number> = {}
  for (const [k, v] of Object.entries(f)) {
    if (v == null) continue
    const w = TENNIS2_WEIGHTS[k as keyof typeof TENNIS2_WEIGHTS]
    wSum += w; acc += w * v
  }
  if (wSum === 0) return null
  for (const [k, v] of Object.entries(f)) {
    if (v != null) effectiveWeights[k] = TENNIS2_WEIGHTS[k as keyof typeof TENNIS2_WEIGHTS] / wSum
  }
  const p1Probability = Math.min(0.98, Math.max(0.02, acc / wSum))
  const dist = Math.abs(p1Probability - 0.5)
  return {
    p1Probability,
    favorite: p1Probability >= 0.5 ? 'p1' : 'p2',
    confidence: dist >= 0.15 ? 'alta' : dist >= 0.07 ? 'media' : 'baja',
    factors: f,
    effectiveWeights,
  }
}
