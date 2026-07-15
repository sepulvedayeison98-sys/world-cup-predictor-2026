/**
 * DOMINIO TENNIS — estadísticas de jugador derivadas de partidos reales
 * (Fase 5). Módulo puro, sin I/O. Todo sale de tennis_matches +
 * tennis_match_stats importados de la fuente; nada se estima.
 */
import type { Surface } from './constants'

export interface TStatsMatch {
  id: string
  p1_id: string | null
  p2_id: string | null
  winner_id: string | null
  surface: string | null
  status: string
  scheduled_at: string | null
  external_id: string | null
}

export interface TStatsRow {
  match_id: string
  player_id: string
  aces: number | null
  double_faults: number | null
  serve_points: number | null
  first_serve_in: number | null
  first_serve_won: number | null
  second_serve_won: number | null
  service_games: number | null
  break_points_saved: number | null
  break_points_faced: number | null
  return_games_won: number | null
}

export interface TennisPlayerSeasonStats {
  played: number
  won: number
  winRate: number
  /** Por superficie: jugados/ganados */
  bySurface: Partial<Record<Surface, { played: number; won: number }>>
  /** Forma reciente: W/L, más reciente al final */
  last10: ('W' | 'L')[]
  /** % de juegos de saque ganados (hold) — solo partidos con stats */
  holdPct: number | null
  /** % de juegos al resto ganados (break) — solo partidos con stats */
  breakPct: number | null
  acesPerMatch: number | null
  dfPerMatch: number | null
  statsMatches: number   // sobre cuántos partidos con stats se calculó
}

/** Los walkover no cuentan como jugados (no hubo tenis). */
const COUNTABLE = new Set(['finished', 'retired'])

export function computeTennisPlayerStats(
  matches: TStatsMatch[],
  stats: TStatsRow[],
  playerId: string,
): TennisPlayerSeasonStats {
  const mine = matches
    .filter((m) => COUNTABLE.has(m.status) && m.winner_id &&
      (m.p1_id === playerId || m.p2_id === playerId))
    .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '') ||
      (a.external_id ?? '').localeCompare(b.external_id ?? ''))

  const out: TennisPlayerSeasonStats = {
    played: mine.length, won: 0, winRate: 0, bySurface: {}, last10: [],
    holdPct: null, breakPct: null, acesPerMatch: null, dfPerMatch: null,
    statsMatches: 0,
  }
  const results: ('W' | 'L')[] = []
  for (const m of mine) {
    const won = m.winner_id === playerId
    if (won) out.won++
    results.push(won ? 'W' : 'L')
    const s = (m.surface ?? '') as Surface
    if (s) {
      const e = out.bySurface[s] ?? { played: 0, won: 0 }
      e.played++; if (won) e.won++
      out.bySurface[s] = e
    }
  }
  out.winRate = out.played ? out.won / out.played : 0
  out.last10 = results.slice(-10)

  // Hold/Break de las filas de stats propias y del rival (mismo partido)
  const mineIds = new Set(mine.map((m) => m.id))
  const own = stats.filter((r) => r.player_id === playerId && mineIds.has(r.match_id))
  const rivalByMatch = new Map(
    stats.filter((r) => r.player_id !== playerId && mineIds.has(r.match_id))
      .map((r) => [r.match_id, r]),
  )
  let svGames = 0, svBroken = 0, aces = 0, dfs = 0, withServe = 0, withAces = 0
  let retGames = 0, breaks = 0
  for (const r of own) {
    if (r.service_games != null && r.break_points_faced != null && r.break_points_saved != null) {
      svGames += r.service_games
      svBroken += Math.max(0, r.break_points_faced - r.break_points_saved)
      withServe++
    }
    if (r.aces != null) { aces += r.aces; withAces++ }
    if (r.double_faults != null) dfs += r.double_faults
    const rival = rivalByMatch.get(r.match_id)
    if (rival?.service_games != null && rival.break_points_faced != null && rival.break_points_saved != null) {
      retGames += rival.service_games
      breaks += Math.max(0, rival.break_points_faced - rival.break_points_saved)
    }
  }
  out.statsMatches = withServe
  if (svGames > 0) out.holdPct = (svGames - svBroken) / svGames
  if (retGames > 0) out.breakPct = breaks / retGames
  if (withAces > 0) {
    out.acesPerMatch = Math.round((aces / withAces) * 10) / 10
    out.dfPerMatch = Math.round((dfs / withAces) * 10) / 10
  }
  return out
}
