/**
 * DOMINIO TENNIS — perfil de saque y devolución (motor tennis-2.0). Módulo
 * puro, sin I/O. Todo sale de tennis_match_stats reales (cobertura 100% del
 * histórico ATP); ninguna métrica se estima.
 *
 * Devuelve tanto las RATIOS crudas (verificables 1:1 contra la fuente) como
 * dos índices 0-100 (saque, devolución) para mostrar al usuario. El paso a
 * 0-100 es un escalado transparente entre anclas fijas típicas del circuito
 * ATP, elegidas A PRIORI (no ajustadas a resultados) — no es dato fabricado,
 * es una normalización declarada de métricas reales.
 */
import type { TStatsMatch, TStatsRow } from './stats'

const COUNTABLE = new Set(['finished', 'retired'])

/** Anclas típicas ATP para el escalado 0-100 (documentadas, a priori). */
export const SR_ANCHORS = {
  holdPct: [0.60, 0.95] as const,          // % juegos de saque mantenidos
  firstServeWonPct: [0.60, 0.85] as const, // % puntos ganados con 1er saque
  acesPerMatch: [0, 18] as const,
  breakPct: [0.05, 0.35] as const,          // % juegos al resto ganados
  returnPtsWonPct: [0.28, 0.45] as const,   // % puntos ganados al resto
}

const norm = (v: number, [lo, hi]: readonly [number, number]) =>
  Math.max(0, Math.min(1, (v - lo) / (hi - lo)))
const round1 = (v: number) => Math.round(v * 10) / 10

export interface ServeReturnProfile {
  matchesWithStats: number
  serve: {
    firstServePct: number | null      // 1er saque dentro / puntos de saque
    firstServeWonPct: number | null
    secondServeWonPct: number | null
    holdPct: number | null
    bpSavedPct: number | null
    acesPerMatch: number | null
    dfPerMatch: number | null
  }
  return: {
    breakPct: number | null            // juegos al resto ganados
    returnPtsWonPct: number | null
    bpConvertedPct: number | null
  }
  /** Índice 0-100 de saque (null si no hay stats suficientes). */
  serveIndex: number | null
  /** Índice 0-100 de devolución. */
  returnIndex: number | null
}

const empty = (): ServeReturnProfile => ({
  matchesWithStats: 0,
  serve: { firstServePct: null, firstServeWonPct: null, secondServeWonPct: null, holdPct: null, bpSavedPct: null, acesPerMatch: null, dfPerMatch: null },
  return: { breakPct: null, returnPtsWonPct: null, bpConvertedPct: null },
  serveIndex: null, returnIndex: null,
})

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null)

/**
 * Perfil de saque/devolución de un jugador. La devolución se deriva de las
 * filas del RIVAL en los mismos partidos (mismo criterio que stats.ts).
 */
export function computeServeReturnProfile(
  matches: TStatsMatch[], stats: TStatsRow[], playerId: string,
): ServeReturnProfile {
  const mine = new Set(
    matches.filter((m) => COUNTABLE.has(m.status) &&
      (m.p1_id === playerId || m.p2_id === playerId)).map((m) => m.id))
  if (mine.size === 0) return empty()

  const own = stats.filter((r) => r.player_id === playerId && mine.has(r.match_id))
  const rivalByMatch = new Map(
    stats.filter((r) => r.player_id !== playerId && mine.has(r.match_id)).map((r) => [r.match_id, r]))

  // Acumuladores de saque (propio)
  let svPoints = 0, firstIn = 0, firstWon = 0, secondWon = 0
  let svGames = 0, svBroken = 0, bpFaced = 0, bpSaved = 0
  let aces = 0, dfs = 0, withServe = 0, withAces = 0
  // Acumuladores de devolución (del rival)
  let retPoints = 0, retWon = 0, retGames = 0, breaks = 0, rivalBpFaced = 0

  for (const r of own) {
    if (r.serve_points != null && r.first_serve_in != null) {
      svPoints += r.serve_points; firstIn += r.first_serve_in
      if (r.first_serve_won != null) firstWon += r.first_serve_won
      if (r.second_serve_won != null) secondWon += r.second_serve_won
      withServe++
    }
    if (r.service_games != null && r.break_points_faced != null && r.break_points_saved != null) {
      svGames += r.service_games
      svBroken += Math.max(0, r.break_points_faced - r.break_points_saved)
      bpFaced += r.break_points_faced; bpSaved += r.break_points_saved
    }
    if (r.aces != null) { aces += r.aces; withAces++ }
    if (r.double_faults != null) dfs += r.double_faults

    const rival = rivalByMatch.get(r.match_id)
    if (rival) {
      if (rival.serve_points != null && rival.first_serve_won != null && rival.second_serve_won != null) {
        retPoints += rival.serve_points
        retWon += rival.serve_points - (rival.first_serve_won + rival.second_serve_won)
      }
      if (rival.service_games != null && rival.break_points_faced != null && rival.break_points_saved != null) {
        retGames += rival.service_games
        breaks += Math.max(0, rival.break_points_faced - rival.break_points_saved)
        rivalBpFaced += rival.break_points_faced
      }
    }
  }

  const out = empty()
  out.matchesWithStats = withServe
  const secondPts = svPoints - firstIn
  out.serve = {
    firstServePct: div(firstIn, svPoints),
    firstServeWonPct: div(firstWon, firstIn),
    secondServeWonPct: div(secondWon, secondPts),
    holdPct: div(svGames - svBroken, svGames),
    bpSavedPct: div(bpSaved, bpFaced),
    acesPerMatch: withAces ? round1(aces / withAces) : null,
    dfPerMatch: withAces ? round1(dfs / withAces) : null,
  }
  out.return = {
    breakPct: div(breaks, retGames),
    returnPtsWonPct: div(retWon, retPoints),
    bpConvertedPct: div(breaks, rivalBpFaced),
  }

  // Índices 0-100 (escalado transparente de métricas reales)
  const { serve, return: ret } = out
  if (serve.holdPct != null && serve.firstServeWonPct != null) {
    const acesN = serve.acesPerMatch != null ? norm(serve.acesPerMatch, SR_ANCHORS.acesPerMatch) : 0
    out.serveIndex = Math.round(100 * (
      0.6 * norm(serve.holdPct, SR_ANCHORS.holdPct) +
      0.3 * norm(serve.firstServeWonPct, SR_ANCHORS.firstServeWonPct) +
      0.1 * acesN))
  }
  if (ret.breakPct != null && ret.returnPtsWonPct != null) {
    out.returnIndex = Math.round(100 * (
      0.6 * norm(ret.breakPct, SR_ANCHORS.breakPct) +
      0.4 * norm(ret.returnPtsWonPct, SR_ANCHORS.returnPtsWonPct)))
  }
  return out
}
