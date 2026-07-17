/**
 * DOMINIO TENNIS — motor predictivo tennis-1.0 (Fase 7). Módulo puro, sin
 * I/O. Combina factores según TENNIS_WEIGHTS (especificación aprobada):
 * 35% ranking+ELO · 25% forma · 20% superficie · 10% H2H · 10% mercado.
 *
 * Regla de honestidad: si un factor no existe para un partido (jugadores
 * sin historial en la superficie, sin H2H previo, sin cuota de mercado),
 * NO se estima — su peso se renormaliza entre los factores presentes.
 * El feature store (tennis_predictions.features) guarda qué factores
 * entraron en cada veredicto, desde el día 1.
 *
 * ELO walk-forward: rating global + rating por superficie, K=32, inicial
 * 1500. Solo actualizan partidos con tenis jugado (finished/retired);
 * los walkover no mueven ratings. El orden cronológico usa la fecha real
 * del torneo (granularidad de la fuente) + orden de ronda + match_num.
 */
import { TENNIS_WEIGHTS } from './constants'

// ── Tipos de entrada (subconjunto de tennis_matches) ─────────────────────
export interface TEngineMatch {
  id: string
  p1_id: string | null
  p2_id: string | null
  winner_id: string | null
  surface: string | null
  status: string
  scheduled_at: string | null
  round: string | null
  external_id: string | null
}

export const ELO_INITIAL = 1500
export const ELO_K = 32
/** Partidos con tenis jugado: los walkover no cuentan (igual que en stats). */
export const ELO_COUNTABLE = new Set(['finished', 'retired'])

/**
 * Semilla de ELO desde el ranking (experimento tennis-1.1). En 1.0 todo
 * jugador nuevo arranca en 1500; con solo 2 temporadas el ELO no "calienta"
 * a tiempo y queda por debajo del ranking puro. La hipótesis de 1.1 es que
 * arrancar a cada debutante desde una estimación basada en su ranking de
 * entrada corrige ese arranque en frío.
 *
 * Priores elegidos A PRIORI (no ajustados a los datos de prueba, para no
 * hacer overfitting): a rango de referencia 50 le corresponde el 1500 medio,
 * y cada década de ranking vale ~SCALE puntos de ELO. rank 1 ≈ 1806,
 * rank 100 ≈ 1446, rank 500 ≈ 1320.
 */
export const TENNIS_RANK_SEED = { refRank: 50, scale: 180 } as const

/** Estimación de ELO inicial a partir de una posición de ranking (≥1). */
export function rankToSeedElo(rank: number): number {
  if (!(rank > 0)) return ELO_INITIAL
  return ELO_INITIAL + TENNIS_RANK_SEED.scale * Math.log10(TENNIS_RANK_SEED.refRank / rank)
}

/** Orden de rondas dentro de un torneo (BR = bronce en JJOO). */
export const ROUND_ORDER: Record<string, number> = {
  RR: 0, ER: 0, R128: 1, R64: 2, R32: 3, R16: 4, QF: 5, SF: 6, BR: 7, F: 8,
}

/** Probabilidad ELO clásica de que A gane a B. */
export function eloExpected(rA: number, rB: number): number {
  return 1 / (1 + 10 ** ((rB - rA) / 400))
}

const matchNum = (ext: string | null) => {
  const n = parseInt((ext ?? '').split('-').pop() ?? '', 10)
  return Number.isFinite(n) ? n : 0
}

/**
 * Orden cronológico honesto con la granularidad de la fuente: fecha de
 * inicio del torneo → ronda → match_num. Dentro de una misma fecha esto
 * garantiza que ningún partido "vea" el resultado de una ronda posterior.
 */
export function sortChronologically<T extends TEngineMatch>(matches: T[]): T[] {
  return [...matches].sort((a, b) =>
    (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '') ||
    ((ROUND_ORDER[a.round ?? ''] ?? 0) - (ROUND_ORDER[b.round ?? ''] ?? 0)) ||
    (matchNum(a.external_id) - matchNum(b.external_id)) ||
    (a.external_id ?? '').localeCompare(b.external_id ?? ''))
}

// ── Estado walk-forward (ELO + forma + H2H) ──────────────────────────────
export interface TennisWalkState {
  elo: Map<string, number>
  /** clave `${playerId}|${surface}` */
  surfaceElo: Map<string, number>
  surfacePlayed: Map<string, number>
  played: Map<string, number>
  /** últimos resultados por jugador (máx 10, más reciente al final) */
  recent: Map<string, ('W' | 'L')[]>
  /** clave par ordenado `${a}|${b}` (a<b) → [victorias de a, victorias de b] */
  h2h: Map<string, [number, number]>
}

export function createWalkState(): TennisWalkState {
  return {
    elo: new Map(), surfaceElo: new Map(), surfacePlayed: new Map(),
    played: new Map(), recent: new Map(), h2h: new Map(),
  }
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/**
 * Semilla opcional de ELO por ranking al momento del partido (tennis-1.1).
 * Solo afecta a jugadores COMPLETAMENTE nuevos (sin ELO global aún); si se
 * omite, el comportamiento es el de 1.0 (arranque en 1500).
 */
export interface WalkSeed {
  seedRank1?: number | null
  seedRank2?: number | null
}

/** Actualiza el estado con el resultado real (llamar DESPUÉS de predecir). */
export function advanceWalkState(state: TennisWalkState, m: TEngineMatch, seed?: WalkSeed): void {
  if (!m.p1_id || !m.p2_id || !m.winner_id || !ELO_COUNTABLE.has(m.status)) return
  const { p1_id: p1, p2_id: p2, winner_id: w } = m
  // Cold-start: un debutante arranca desde su ranking (1.1) o en 1500 (1.0).
  const new1 = !state.elo.has(p1), new2 = !state.elo.has(p2)
  const seed1 = new1 && seed?.seedRank1 != null ? rankToSeedElo(seed.seedRank1) : ELO_INITIAL
  const seed2 = new2 && seed?.seedRank2 != null ? rankToSeedElo(seed.seedRank2) : ELO_INITIAL
  const s1 = state.elo.get(p1) ?? seed1
  const s2 = state.elo.get(p2) ?? seed2
  const e1 = eloExpected(s1, s2)
  const y1 = w === p1 ? 1 : 0
  state.elo.set(p1, s1 + ELO_K * (y1 - e1))
  state.elo.set(p2, s2 + ELO_K * ((1 - y1) - (1 - e1)))

  const surf = (m.surface ?? '').toLowerCase()
  if (surf) {
    const k1 = `${p1}|${surf}`, k2 = `${p2}|${surf}`
    // Un debutante también siembra su ELO de superficie desde el ranking;
    // un jugador conocido nuevo en la superficie arranca en 1500 (como 1.0).
    const r1 = state.surfaceElo.get(k1) ?? (new1 ? seed1 : ELO_INITIAL)
    const r2 = state.surfaceElo.get(k2) ?? (new2 ? seed2 : ELO_INITIAL)
    const es = eloExpected(r1, r2)
    state.surfaceElo.set(k1, r1 + ELO_K * (y1 - es))
    state.surfaceElo.set(k2, r2 + ELO_K * ((1 - y1) - (1 - es)))
    state.surfacePlayed.set(k1, (state.surfacePlayed.get(k1) ?? 0) + 1)
    state.surfacePlayed.set(k2, (state.surfacePlayed.get(k2) ?? 0) + 1)
  }

  state.played.set(p1, (state.played.get(p1) ?? 0) + 1)
  state.played.set(p2, (state.played.get(p2) ?? 0) + 1)
  for (const [pid, res] of [[p1, y1 ? 'W' : 'L'], [p2, y1 ? 'L' : 'W']] as const) {
    const arr = state.recent.get(pid) ?? []
    arr.push(res)
    if (arr.length > 10) arr.shift()
    state.recent.set(pid, arr)
  }

  const key = pairKey(p1, p2)
  const rec = state.h2h.get(key) ?? [0, 0]
  const winnerIsFirst = (p1 < p2 ? p1 : p2) === w
  rec[winnerIsFirst ? 0 : 1]++
  state.h2h.set(key, rec)
}

// ── Factores → probabilidad p1 ───────────────────────────────────────────
export interface TennisFactorInput {
  eloP1: number | null
  eloP2: number | null
  surfaceEloP1: number | null   // null si el jugador no tiene historial en la superficie
  surfaceEloP2: number | null
  /** Victorias/derrotas recientes (W/L); null si sin historial */
  recentP1: ('W' | 'L')[] | null
  recentP2: ('W' | 'L')[] | null
  h2hP1Wins: number
  h2hTotal: number
  rankP1: number | null         // ranking oficial observado (menor = mejor)
  rankP2: number | null
  marketP1: number | null       // prob. implícita de mercado (Fase 9; hoy null)
}

/** Extrae los factores del estado walk-forward para un partido próximo. */
export function extractFactors(
  state: TennisWalkState, m: TEngineMatch,
  rankP1: number | null = null, rankP2: number | null = null,
  marketP1: number | null = null,
): TennisFactorInput | null {
  if (!m.p1_id || !m.p2_id) return null
  const surf = (m.surface ?? '').toLowerCase()
  const k1 = `${m.p1_id}|${surf}`, k2 = `${m.p2_id}|${surf}`
  const key = pairKey(m.p1_id, m.p2_id)
  const h = state.h2h.get(key) ?? [0, 0]
  const p1First = (m.p1_id < m.p2_id ? m.p1_id : m.p2_id) === m.p1_id
  return {
    eloP1: state.played.get(m.p1_id) ? state.elo.get(m.p1_id)! : null,
    eloP2: state.played.get(m.p2_id) ? state.elo.get(m.p2_id)! : null,
    surfaceEloP1: state.surfacePlayed.get(k1) ? state.surfaceElo.get(k1)! : null,
    surfaceEloP2: state.surfacePlayed.get(k2) ? state.surfaceElo.get(k2)! : null,
    recentP1: state.recent.get(m.p1_id) ?? null,
    recentP2: state.recent.get(m.p2_id) ?? null,
    h2hP1Wins: p1First ? h[0] : h[1],
    h2hTotal: h[0] + h[1],
    rankP1, rankP2, marketP1,
  }
}

export interface TennisPrediction {
  p1Probability: number
  favorite: 'p1' | 'p2'
  confidence: 'alta' | 'media' | 'baja'
  /** Prob. p1 por factor (null = factor ausente, peso renormalizado) */
  factors: {
    rankingElo: number | null
    form: number | null
    surface: number | null
    headToHead: number | null
    market: number | null
  }
  /** Pesos efectivos tras renormalizar (transparencia del feature store) */
  effectiveWeights: Record<string, number>
}

const winRate = (recent: ('W' | 'L')[] | null): number | null => {
  if (!recent || recent.length < 3) return null // <3 partidos: sin señal honesta
  const w = recent.filter((r) => r === 'W').length
  return (w + 1) / (recent.length + 2) // suavizado de Laplace
}

/**
 * Prob. de forma vía log5 de las tasas recientes suavizadas (Laplace).
 * Exportada para reutilizarla en el motor 2.0 sin duplicar la fórmula.
 */
export function formLog5(recentP1: ('W' | 'L')[] | null, recentP2: ('W' | 'L')[] | null): number | null {
  const wr1 = winRate(recentP1), wr2 = winRate(recentP2)
  if (wr1 == null || wr2 == null) return null
  const num = wr1 * (1 - wr2)
  const den = num + wr2 * (1 - wr1)
  return den > 0 ? num / den : 0.5
}

/** Opciones de combinación (versionado del motor sin romper 1.0/1.1). */
export interface PredictOptions {
  /**
   * Mapeo ranking→probabilidad del factor de ranking:
   * · 'ratio'  (1.0/1.1): rank2/(rank1+rank2) — de referencia, poco calibrado.
   * · 'logElo' (1.2): eloExpected(rankToSeedElo(r1), rankToSeedElo(r2)) — misma
   *   escala Elo que la señal de ELO, mejor calibrado en los extremos.
   */
  rankMapping?: 'ratio' | 'logElo'
}

/**
 * Combina los factores según TENNIS_WEIGHTS. Devuelve null si NINGÚN factor
 * existe (dos debutantes absolutos): sin datos no hay veredicto (Data First).
 */
export function predictTennisMatch(f: TennisFactorInput, opts: PredictOptions = {}): TennisPrediction | null {
  // Ranking + ELO: promedio de las señales disponibles (ELO global y ranking
  // oficial). El mapeo del ranking depende de la versión (ver PredictOptions).
  const parts: number[] = []
  if (f.eloP1 != null && f.eloP2 != null) parts.push(eloExpected(f.eloP1, f.eloP2))
  if (f.rankP1 != null && f.rankP2 != null && f.rankP1 > 0 && f.rankP2 > 0) {
    parts.push(opts.rankMapping === 'logElo'
      ? eloExpected(rankToSeedElo(f.rankP1), rankToSeedElo(f.rankP2))
      : f.rankP2 / (f.rankP1 + f.rankP2))
  }
  const rankingElo = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null

  // Forma: log5 de las tasas recientes suavizadas (ambos con historial)
  const form = formLog5(f.recentP1, f.recentP2)

  const surface = f.surfaceEloP1 != null && f.surfaceEloP2 != null
    ? eloExpected(f.surfaceEloP1, f.surfaceEloP2) : null

  const headToHead = f.h2hTotal > 0 ? (f.h2hP1Wins + 1) / (f.h2hTotal + 2) : null

  const market = f.marketP1

  const values = { rankingElo, form, surface, headToHead, market }
  let wSum = 0, acc = 0
  const effectiveWeights: Record<string, number> = {}
  for (const [k, v] of Object.entries(values)) {
    if (v == null) continue
    const w = TENNIS_WEIGHTS[k as keyof typeof TENNIS_WEIGHTS]
    wSum += w; acc += w * v
  }
  if (wSum === 0) return null
  for (const [k, v] of Object.entries(values)) {
    if (v != null) effectiveWeights[k] = TENNIS_WEIGHTS[k as keyof typeof TENNIS_WEIGHTS] / wSum
  }
  const p1Probability = Math.min(0.98, Math.max(0.02, acc / wSum))
  const dist = Math.abs(p1Probability - 0.5)
  return {
    p1Probability,
    favorite: p1Probability >= 0.5 ? 'p1' : 'p2',
    confidence: dist >= 0.15 ? 'alta' : dist >= 0.07 ? 'media' : 'baja',
    factors: values,
    effectiveWeights,
  }
}
