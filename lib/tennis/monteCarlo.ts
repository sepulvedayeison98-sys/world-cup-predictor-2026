/**
 * DOMINIO TENNIS — simulador Monte Carlo de mercados (punto→juego→set→partido).
 * Módulo puro, sin I/O, determinista con semilla.
 *
 * Entrada: el % REAL de puntos ganados al saque y al resto de cada jugador
 * (tennis_match_stats, cobertura 100 % del histórico ATP). El paso
 * punto→juego usa la cadena de Markov cerrada del juego con ventaja; el
 * tiebreak, el set y el partido se simulan. Publica probabilidades de
 * marcador en sets (2-0/2-1…), over/under de juegos y hándicap de juegos —
 * SIN cuotas (los mercados con EV llegan con la Fase 9).
 *
 * La probabilidad de punto al saque combina saque propio y resto del rival
 * con el ajuste clásico de Barnett–Clarke (2005):
 *   pSaque(A vs B) = spwA − (rpwB − rpwMedia)
 * donde rpwMedia es la media del circuito MEDIDA sobre la fuente (no un
 * número inventado; ver TOUR_AVG_RETURN_PTS_WON). Validado contra las
 * frecuencias reales del histórico antes de UI (docs/TENNIS_ARCHITECTURE.md).
 */

/**
 * Media ATP de puntos ganados al resto, MEDIDA sobre tennis_match_stats
 * (10.848 filas con saque completo, 2024-2026): 1 − Σganados/Σpuntos = 0,3594.
 */
export const TOUR_AVG_RETURN_PTS_WON = 0.3594

/** Mínimo de partidos con stats para que el perfil de puntos exista. */
export const MC_MIN_STAT_MATCHES = 3

/**
 * Desviación del choque de rendimiento por partido (se suma a la prob. de
 * punto al saque de cada jugador en cada simulación). El modelo iid puro
 * (sigma=0) predijo 54,8 % de partidos a dos sets cuando el histórico real
 * marca 64,0 %, y 25,0 juegos de media vs 23,6 reales: los promedios de
 * saque subestiman la variabilidad real entre días/matchups. Sigma se
 * CALIBRÓ por rejilla contra esas frecuencias observadas (walk-forward, sin
 * fuga, n=3.704 Bo3): con 0,065 → 2-0 64,11 % (real 63,96 %), juegos 23,59
 * (real 23,61), over 22,5 46,92 % (real 46,60 %). Ver TENNIS_ARCHITECTURE.md.
 */
export const PERFORMANCE_SIGMA = 0.065

/** Tope declarado de la prob. de punto al saque (evita degenerados). */
const P_SERVE_CLAMP: readonly [number, number] = [0.35, 0.9]

// ── Perfil de puntos (desde filas reales) ────────────────────────────────

export interface MCPointProfile {
  /** % de puntos ganados con el propio saque (real). */
  servePointsWonPct: number
  /** % de puntos ganados al resto (real, filas del rival). */
  returnPointsWonPct: number
  /** Sobre cuántos partidos con stats se calculó. */
  statMatches: number
}

interface MCStatsMatch {
  id: string
  p1_id: string | null
  p2_id: string | null
  status: string
}

interface MCStatsRow {
  match_id: string
  player_id: string
  serve_points: number | null
  first_serve_won: number | null
  second_serve_won: number | null
}

const COUNTABLE = new Set(['finished', 'retired'])

/**
 * Perfil de puntos de un jugador a partir de partidos + stats reales.
 * Devuelve null si no llega al mínimo de partidos con stats (Data First:
 * sin datos suficientes no hay simulación).
 */
export function computePointProfile(
  matches: MCStatsMatch[], stats: MCStatsRow[], playerId: string,
): MCPointProfile | null {
  const mine = new Set(matches
    .filter((m) => COUNTABLE.has(m.status) && (m.p1_id === playerId || m.p2_id === playerId))
    .map((m) => m.id))
  let svPts = 0, svWon = 0, retPts = 0, retWon = 0, statMatches = 0
  for (const r of stats) {
    if (!mine.has(r.match_id)) continue
    if (r.serve_points == null || r.first_serve_won == null || r.second_serve_won == null || r.serve_points <= 0) continue
    const won = r.first_serve_won + r.second_serve_won
    if (r.player_id === playerId) {
      svPts += r.serve_points; svWon += won; statMatches++
    } else {
      retPts += r.serve_points; retWon += r.serve_points - won
    }
  }
  if (statMatches < MC_MIN_STAT_MATCHES || svPts === 0 || retPts === 0) return null
  return {
    servePointsWonPct: svWon / svPts,
    returnPointsWonPct: retWon / retPts,
    statMatches,
  }
}

// ── Punto → juego (forma cerrada) ────────────────────────────────────────

/** Prob. de punto al saque de A contra B (ajuste Barnett–Clarke, acotado). */
export function servePointProb(a: MCPointProfile, b: MCPointProfile, tourAvgRpw = TOUR_AVG_RETURN_PTS_WON): number {
  const p = a.servePointsWonPct - (b.returnPointsWonPct - tourAvgRpw)
  return Math.max(P_SERVE_CLAMP[0], Math.min(P_SERVE_CLAMP[1], p))
}

/**
 * Prob. de ganar el propio juego de saque con prob. de punto p (cadena del
 * juego con deuce/ventaja, forma cerrada estándar).
 */
export function gameWinProb(p: number): number {
  const q = 1 - p
  const deuceReach = 20 * p ** 3 * q ** 3
  const deuceWin = p ** 2 / (1 - 2 * p * q)
  return p ** 4 * (1 + 4 * q + 10 * q ** 2) + deuceReach * deuceWin
}

// ── PRNG determinista (mulberry32) ───────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Simulación tiebreak / set / partido ──────────────────────────────────

/**
 * Tiebreak punto a punto (a 7, diferencia de 2; saca 1 punto el que toca y
 * luego se alterna cada 2). Devuelve true si lo gana el jugador `first`.
 */
export function simulateTiebreak(pServeFirst: number, pServeOther: number, rng: () => number): boolean {
  let ptsF = 0, ptsO = 0, serves = 0 // serves: índice de punto (0-based)
  for (;;) {
    // Patrón de saque: punto 0 → first; 1,2 → other; 3,4 → first; …
    const firstServes = serves === 0 || Math.floor((serves + 1) / 2) % 2 === 0
    const pServe = firstServes ? pServeFirst : pServeOther
    const serverWins = rng() < pServe
    if (firstServes === serverWins) ptsF++; else ptsO++
    serves++
    if ((ptsF >= 7 || ptsO >= 7) && Math.abs(ptsF - ptsO) >= 2) return ptsF > ptsO
  }
}

interface SetResult { games1: number; games2: number; p1Won: boolean }

/**
 * Set juego a juego: cada juego se decide con su prob. cerrada de juego;
 * 6 juegos con diferencia de 2, tiebreak en 6-6 (set 7-6).
 * `p1ServesFirst` indica quién saca el primer juego del set.
 */
export function simulateSet(
  pGame1: number, pGame2: number, pServe1: number, pServe2: number,
  p1ServesFirst: boolean, rng: () => number,
): SetResult {
  let g1 = 0, g2 = 0
  let p1Serves = p1ServesFirst
  for (;;) {
    if (g1 === 6 && g2 === 6) {
      const firstWins = simulateTiebreak(
        p1Serves ? pServe1 : pServe2, p1Serves ? pServe2 : pServe1, rng)
      const p1Won = p1Serves ? firstWins : !firstWins
      if (p1Won) g1++; else g2++
      return { games1: g1, games2: g2, p1Won }
    }
    const serverHolds = rng() < (p1Serves ? pGame1 : pGame2)
    const p1WinsGame = p1Serves === serverHolds
    if (p1WinsGame) g1++; else g2++
    p1Serves = !p1Serves
    if ((g1 >= 6 || g2 >= 6) && Math.abs(g1 - g2) >= 2) {
      return { games1: g1, games2: g2, p1Won: g1 > g2 }
    }
  }
}

// ── Mercados ─────────────────────────────────────────────────────────────

export interface TennisMarkets {
  sims: number
  bestOf: number
  /** Prob. de punto al saque usadas (transparencia del modelo). */
  pServe1: number
  pServe2: number
  /** Prob. de que gane el jugador 1 (según el propio simulador). */
  matchWinP1: number
  /** Distribución de marcador en sets, p. ej. { '2-0': …, '2-1': …, '1-2': …, '0-2': … }. */
  setScores: Record<string, number>
  /** Media de juegos totales simulados. */
  gamesAvg: number
  /** P(over) por línea de juegos totales. */
  totalGamesOver: { line: number; over: number }[]
  /** P(jugador 1 cubre) por línea de hándicap de juegos (j1 + línea > j2). */
  handicap: { line: number; p1Covers: number }[]
}

const TOTAL_LINES: Record<number, number[]> = {
  3: [20.5, 21.5, 22.5, 23.5],
  5: [37.5, 39.5, 41.5],
}
const HANDICAP_LINES: Record<number, number[]> = {
  3: [-5.5, -3.5, -1.5, 1.5, 3.5, 5.5],
  5: [-7.5, -4.5, 4.5, 7.5],
}

export interface SimulateOptions {
  bestOf?: 3 | 5
  sims?: number
  seed?: number
  tourAvgRpw?: number
  /** Desviación del choque de rendimiento por partido (default calibrado). */
  performanceSigma?: number
}

/** Normal(0,1) por Box–Muller sobre el PRNG uniforme. */
function gaussian(rng: () => number): number {
  let u = 0
  while (u === 0) u = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

/** Simula el partido completo N veces y agrega los mercados. */
export function simulateTennisMarkets(
  p1: MCPointProfile, p2: MCPointProfile, opts: SimulateOptions = {},
): TennisMarkets {
  const bestOf = opts.bestOf ?? 3
  const sims = opts.sims ?? 10000
  const rng = mulberry32(opts.seed ?? 20260717)
  const sigma = opts.performanceSigma ?? PERFORMANCE_SIGMA
  const pServe1 = servePointProb(p1, p2, opts.tourAvgRpw)
  const pServe2 = servePointProb(p2, p1, opts.tourAvgRpw)
  const clamp = (v: number) => Math.max(P_SERVE_CLAMP[0], Math.min(P_SERVE_CLAMP[1], v))
  const setsToWin = Math.ceil(bestOf / 2)
  const totalLines = TOTAL_LINES[bestOf] ?? TOTAL_LINES[3]
  const handicapLines = HANDICAP_LINES[bestOf] ?? HANDICAP_LINES[3]

  let winsP1 = 0, gamesSum = 0
  const setScores: Record<string, number> = {}
  const overCounts = new Array(totalLines.length).fill(0)
  const coverCounts = new Array(handicapLines.length).fill(0)

  for (let i = 0; i < sims; i++) {
    // Choque de rendimiento del día, independiente por jugador (calibrado)
    const ps1 = sigma > 0 ? clamp(pServe1 + sigma * gaussian(rng)) : pServe1
    const ps2 = sigma > 0 ? clamp(pServe2 + sigma * gaussian(rng)) : pServe2
    const pGame1 = gameWinProb(ps1)
    const pGame2 = gameWinProb(ps2)
    // Quién saca el primer juego del partido: sorteo (como en la pista)
    let p1ServesFirst = rng() < 0.5
    let sets1 = 0, sets2 = 0, g1 = 0, g2 = 0
    while (sets1 < setsToWin && sets2 < setsToWin) {
      const s = simulateSet(pGame1, pGame2, ps1, ps2, p1ServesFirst, rng)
      if (s.p1Won) sets1++; else sets2++
      g1 += s.games1; g2 += s.games2
      // El primer sacador del set siguiente alterna con los juegos jugados
      if ((s.games1 + s.games2) % 2 === 1) p1ServesFirst = !p1ServesFirst
    }
    const total = g1 + g2
    if (sets1 > sets2) winsP1++
    gamesSum += total
    const key = `${sets1}-${sets2}`
    setScores[key] = (setScores[key] ?? 0) + 1
    for (let l = 0; l < totalLines.length; l++) if (total > totalLines[l]) overCounts[l]++
    for (let l = 0; l < handicapLines.length; l++) if (g1 + handicapLines[l] > g2) coverCounts[l]++
  }

  for (const k of Object.keys(setScores)) setScores[k] /= sims
  return {
    sims, bestOf, pServe1, pServe2,
    matchWinP1: winsP1 / sims,
    setScores,
    gamesAvg: gamesSum / sims,
    totalGamesOver: totalLines.map((line, i) => ({ line, over: overCounts[i] / sims })),
    handicap: handicapLines.map((line, i) => ({ line, p1Covers: coverCounts[i] / sims })),
  }
}
