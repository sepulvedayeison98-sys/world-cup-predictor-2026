/**
 * DOMINIO TENNIS — capa de lectura para las páginas públicas (Fase 8).
 *
 * Server-side, cliente anon (ISR). Todas las consultas se acotan al tour
 * (hoy solo ATP con datos; WTA declarada pendiente de fuente). Las tablas
 * tennis_* son exclusivas del dominio, así que la "regla de oro
 * multi-competición" del fútbol/NBA no aplica aquí — el aislamiento es por
 * tabla, no por filtro de competición.
 *
 * El tipo Database aún no conoce las tablas tennis_*, así que el borde con
 * Supabase se castea a any (mismo patrón que services/tennis/backtest.ts);
 * las funciones devuelven modelos de dominio tipados para que las páginas
 * trabajen con tipos.
 */
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { fetchAllRows } from '@/lib/fetchAll'
import { computeTennisPlayerStats, type TennisPlayerSeasonStats } from '@/lib/tennis/stats'
import { computeServeReturnProfile, type ServeReturnProfile } from '@/lib/tennis/serveReturn'
import {
  computePointProfile, simulateTennisMarkets,
  type MCPointProfile, type TennisMarkets,
} from '@/lib/tennis/monteCarlo'
import { TENNIS_MODEL_VERSION, type Tour } from '@/lib/tennis/constants'

const client = () => createStaticSupabaseClient() as any
const COUNTABLE = ['finished', 'retired']

// ── Vistas de dominio para la UI ─────────────────────────────────────────
export interface TennisRankingRow {
  position: number
  points: number | null
  player_id: string
  name: string
  country_code: string | null
  plays_hand: 'R' | 'L' | null
}

export interface TennisResultRow {
  id: string
  scheduled_at: string | null
  round: string | null
  surface: string | null
  status: string
  score: string | null
  winner_id: string | null
  p1: { id: string; name: string } | null
  p2: { id: string; name: string } | null
  tournament: string | null
}

export interface TennisBacktestView {
  model_version: string
  sample_size: number
  accuracy: number | null
  brier_score: number | null
  log_loss: number | null
  date_from: string | null
  date_to: string | null
  metadata: Record<string, any> | null
}

export interface TennisHubData {
  ready: boolean
  playersCount: number
  tournamentsCount: number
  matchesPlayed: number
  lastRankingDate: string | null
  topRanking: TennisRankingRow[]
  recentResults: TennisResultRow[]
  backtest: TennisBacktestView | null
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Fecha del ranking más reciente disponible (o null si no hay datos). */
async function latestRankingDate(sb: any): Promise<string | null> {
  const { data } = await sb
    .from('tennis_rankings')
    .select('ranking_date')
    .order('ranking_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.ranking_date ?? null
}

/**
 * Ranking = ÚLTIMA posición conocida por jugador.
 *
 * OJO (honestidad): tennis_rankings NO es una foto semanal oficial, son
 * observaciones por partido (el rank de cada jugador a la fecha en que jugó).
 * Por eso "la última fecha" sola tiene solo a quienes jugaron ese día. El
 * ranking honesto se arma tomando, por jugador, su observación más reciente
 * y ordenando por posición. Puede haber posiciones repetidas (vienen de
 * fechas distintas): es la mejor verdad disponible de la fuente, declarada.
 */
async function buildLatestRanking(sb: any, tour: Tour, limit?: number): Promise<TennisRankingRow[]> {
  const [obs, players] = await Promise.all([
    fetchAllRows((from, to) => sb
      .from('tennis_rankings')
      .select('player_id, ranking_date, position, points')
      .order('id').range(from, to)),
    fetchAllRows((from, to) => sb
      .from('tennis_players')
      .select('id, name, country_code, plays_hand, tour')
      .eq('tour', tour)
      .order('id').range(from, to)),
  ])
  const latest = new Map<string, any>()
  for (const r of obs as any[]) {
    const cur = latest.get(r.player_id)
    if (!cur || r.ranking_date > cur.ranking_date) latest.set(r.player_id, r)
  }
  const pmap = new Map((players as any[]).map((p) => [p.id, p]))
  const rows: TennisRankingRow[] = []
  for (const [pid, o] of latest) {
    const p = pmap.get(pid)
    if (!p) continue // jugador de otro tour u observación huérfana
    rows.push({
      position: o.position, points: o.points, player_id: pid,
      name: p.name, country_code: p.country_code, plays_hand: p.plays_hand,
    })
  }
  rows.sort((a, b) => a.position - b.position)
  return limit ? rows.slice(0, limit) : rows
}

/** Última posición conocida de UN jugador (su observación más reciente). */
async function latestRankOfPlayer(sb: any, id: string): Promise<{ position: number; points: number | null } | null> {
  const { data } = await sb
    .from('tennis_rankings')
    .select('position, points')
    .eq('player_id', id)
    .order('ranking_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/** Empareja partidos con nombres de jugador resolviendo los ids en una query. */
async function attachPlayers(sb: any, matches: any[]): Promise<Map<string, { id: string; name: string }>> {
  const ids = new Set<string>()
  for (const m of matches) {
    if (m.p1_id) ids.add(m.p1_id)
    if (m.p2_id) ids.add(m.p2_id)
  }
  if (ids.size === 0) return new Map()
  const { data } = await sb.from('tennis_players').select('id, name').in('id', [...ids])
  return new Map(((data ?? []) as any[]).map((p) => [p.id, { id: p.id, name: p.name }]))
}

// ── Consultas públicas ───────────────────────────────────────────────────

/** Datos del hub /tennis. Todo real; si no hay datos, ready=false. */
export async function fetchTennisHub(tour: Tour = 'ATP'): Promise<TennisHubData> {
  const sb = client()

  const [players, tournaments, matchesPlayed, lastDate, backtest] = await Promise.all([
    sb.from('tennis_players').select('id', { count: 'exact', head: true }).eq('tour', tour),
    sb.from('tennis_tournaments').select('id', { count: 'exact', head: true }).eq('tour', tour),
    sb.from('tennis_matches').select('id, tennis_tournaments!inner(tour)', { count: 'exact', head: true })
      .in('status', COUNTABLE).eq('tennis_tournaments.tour', tour),
    latestRankingDate(sb),
    fetchLatestBacktest(tour),
  ])

  const topRanking = await buildLatestRanking(sb, tour, 15)

  // Últimos resultados jugados
  const { data: rawResults } = await sb
    .from('tennis_matches')
    .select('id, scheduled_at, round, surface, status, score, winner_id, p1_id, p2_id, tennis_tournaments!inner(name, tour)')
    .eq('tennis_tournaments.tour', tour)
    .in('status', COUNTABLE)
    .order('scheduled_at', { ascending: false })
    .limit(12)
  const players2 = await attachPlayers(sb, rawResults ?? [])
  const recentResults: TennisResultRow[] = ((rawResults ?? []) as any[]).map((m) => ({
    id: m.id,
    scheduled_at: m.scheduled_at,
    round: m.round,
    surface: m.surface,
    status: m.status,
    score: m.score,
    winner_id: m.winner_id,
    p1: m.p1_id ? players2.get(m.p1_id) ?? null : null,
    p2: m.p2_id ? players2.get(m.p2_id) ?? null : null,
    tournament: m.tennis_tournaments?.name ?? null,
  }))

  const playersCount = players.count ?? 0
  const tournamentsCount = tournaments.count ?? 0
  const matchesCount = matchesPlayed.count ?? 0

  return {
    ready: playersCount > 0 && matchesCount > 0,
    playersCount,
    tournamentsCount,
    matchesPlayed: matchesCount,
    lastRankingDate: lastDate,
    topRanking,
    recentResults,
    backtest,
  }
}

/** Ranking ATP completo a la fecha más reciente. */
export async function fetchTennisRanking(tour: Tour = 'ATP'): Promise<{ date: string | null; rows: TennisRankingRow[] }> {
  const sb = client()
  const [date, rows] = await Promise.all([
    latestRankingDate(sb),      // fecha del dato más reciente (para el "hasta")
    buildLatestRanking(sb, tour),
  ])
  return { date, rows }
}

/** Última corrida de backtest medida para el tour. */
export async function fetchLatestBacktest(tour: Tour = 'ATP'): Promise<TennisBacktestView | null> {
  const sb = client()
  const { data } = await sb
    .from('tennis_backtests')
    .select('model_version, sample_size, accuracy, brier_score, log_loss, date_from, date_to, metadata')
    .eq('tour', tour)
    .eq('model_version', TENNIS_MODEL_VERSION)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as TennisBacktestView) ?? null
}

export interface TennisPlayerProfile {
  player: {
    id: string
    name: string
    country_code: string | null
    plays_hand: 'R' | 'L' | null
    height_cm: number | null
    tour: Tour
  }
  rankPosition: number | null
  rankPoints: number | null
  stats: TennisPlayerSeasonStats
  /** Perfil de saque/devolución con índices 0-100 (métricas reales escaladas). */
  serveReturn: ServeReturnProfile
  recent: TennisResultRow[]
}

/** Perfil de jugador: datos + stats derivadas de partidos reales + últimos. */
export async function fetchTennisPlayer(id: string): Promise<TennisPlayerProfile | null> {
  const sb = client()
  const { data: player } = await sb
    .from('tennis_players')
    .select('id, name, country_code, plays_hand, height_cm, tour')
    .eq('id', id)
    .maybeSingle()
  if (!player) return null

  // Todos sus partidos (paginado; un top player puede superar 100/temporada)
  const matches = await fetchAllRows((from, to) => sb
    .from('tennis_matches')
    .select('id, p1_id, p2_id, winner_id, surface, status, scheduled_at, external_id, score, round, tennis_tournaments!inner(name)')
    .or(`p1_id.eq.${id},p2_id.eq.${id}`)
    .order('id')
    .range(from, to))

  // Stats por partido del jugador y de sus rivales (para Hold%/Break%)
  const matchIds = matches.map((m: any) => m.id)
  const statsRows: any[] = []
  for (let i = 0; i < matchIds.length; i += 200) {
    const chunk = matchIds.slice(i, i + 200)
    const { data } = await sb
      .from('tennis_match_stats')
      .select('match_id, player_id, aces, double_faults, serve_points, first_serve_in, first_serve_won, second_serve_won, service_games, break_points_saved, break_points_faced, return_games_won')
      .in('match_id', chunk)
    statsRows.push(...(data ?? []))
  }

  const stats = computeTennisPlayerStats(matches as any, statsRows as any, id)
  const serveReturn = computeServeReturnProfile(matches as any, statsRows as any, id)

  // Ranking actual = última posición conocida del propio jugador
  const r = await latestRankOfPlayer(sb, id)
  const rankPosition: number | null = r?.position ?? null
  const rankPoints: number | null = r?.points ?? null

  // Últimos 10 resultados (más reciente primero) con nombres de rival
  const played = (matches as any[])
    .filter((m) => COUNTABLE.includes(m.status) && m.winner_id)
    .sort((a, b) => (b.scheduled_at ?? '').localeCompare(a.scheduled_at ?? ''))
    .slice(0, 10)
  const namesMap = await attachPlayers(sb, played)
  const recent: TennisResultRow[] = played.map((m) => ({
    id: m.id,
    scheduled_at: m.scheduled_at,
    round: m.round,
    surface: m.surface,
    status: m.status,
    score: m.score,
    winner_id: m.winner_id,
    p1: m.p1_id ? namesMap.get(m.p1_id) ?? null : null,
    p2: m.p2_id ? namesMap.get(m.p2_id) ?? null : null,
    tournament: m.tennis_tournaments?.name ?? null,
  }))

  return {
    player: player as any,
    rankPosition,
    rankPoints,
    stats,
    serveReturn,
    recent,
  }
}

/** Ids de jugadores con ranking reciente — para prerenderizar sus perfiles. */
export async function fetchRankedPlayerIds(tour: Tour = 'ATP', limit = 50): Promise<string[]> {
  const sb = client()
  const rows = await buildLatestRanking(sb, tour, limit)
  return rows.map((r) => r.player_id)
}

const SURFACES = new Set(['hard', 'clay', 'grass', 'carpet'])

/** Navegador de resultados: filtro opcional por superficie, paginado. */
export async function fetchTennisResults(
  { tour = 'ATP', surface = null, limit = 40, offset = 0 }:
  { tour?: Tour; surface?: string | null; limit?: number; offset?: number },
): Promise<{ rows: TennisResultRow[]; hasMore: boolean }> {
  const sb = client()
  let q = sb
    .from('tennis_matches')
    .select('id, scheduled_at, round, surface, status, score, winner_id, p1_id, p2_id, tennis_tournaments!inner(name, tour)')
    .eq('tennis_tournaments.tour', tour)
    .in('status', COUNTABLE)
  if (surface && SURFACES.has(surface)) q = q.eq('surface', surface)
  q = q.order('scheduled_at', { ascending: false }).range(offset, offset + limit) // +1 para saber si hay más
  const { data } = await q
  const raw = (data ?? []) as any[]
  const hasMore = raw.length > limit
  const page = raw.slice(0, limit)
  const names = await attachPlayers(sb, page)
  const rows: TennisResultRow[] = page.map((m) => ({
    id: m.id, scheduled_at: m.scheduled_at, round: m.round, surface: m.surface,
    status: m.status, score: m.score, winner_id: m.winner_id,
    p1: m.p1_id ? names.get(m.p1_id) ?? null : null,
    p2: m.p2_id ? names.get(m.p2_id) ?? null : null,
    tournament: m.tennis_tournaments?.name ?? null,
  }))
  return { rows, hasMore }
}

/** Jugadores para el selector del H2H (id + nombre, orden alfabético). */
export async function fetchPlayersForPicker(tour: Tour = 'ATP'): Promise<{ id: string; name: string }[]> {
  const sb = client()
  const rows = await fetchAllRows((from, to) => sb
    .from('tennis_players')
    .select('id, name')
    .eq('tour', tour)
    .order('name', { ascending: true })
    .range(from, to))
  return (rows as any[]).map((p) => ({ id: p.id, name: p.name }))
}

export interface TennisH2H {
  p1: { id: string; name: string; country_code: string | null }
  p2: { id: string; name: string; country_code: string | null }
  p1Wins: number
  p2Wins: number
  bySurface: Record<string, { p1: number; p2: number }>
  matches: TennisResultRow[]
}

/** Cara a cara entre dos jugadores — historial real completo. */
export async function fetchTennisH2H(id1: string, id2: string): Promise<TennisH2H | null> {
  if (!id1 || !id2 || id1 === id2) return null
  const sb = client()
  const { data: players } = await sb
    .from('tennis_players')
    .select('id, name, country_code')
    .in('id', [id1, id2])
  const map = new Map(((players ?? []) as any[]).map((p) => [p.id, p]))
  const p1 = map.get(id1), p2 = map.get(id2)
  if (!p1 || !p2) return null

  const { data } = await sb
    .from('tennis_matches')
    .select('id, scheduled_at, round, surface, status, score, winner_id, p1_id, p2_id, tennis_tournaments!inner(name, tour)')
    .in('status', COUNTABLE)
    .or(`and(p1_id.eq.${id1},p2_id.eq.${id2}),and(p1_id.eq.${id2},p2_id.eq.${id1})`)
    .order('scheduled_at', { ascending: false })
  const raw = (data ?? []) as any[]

  let p1Wins = 0, p2Wins = 0
  const bySurface: Record<string, { p1: number; p2: number }> = {}
  for (const m of raw) {
    if (m.winner_id === id1) p1Wins++
    else if (m.winner_id === id2) p2Wins++
    const s = (m.surface ?? '').toLowerCase()
    if (s) {
      const e = bySurface[s] ?? { p1: 0, p2: 0 }
      if (m.winner_id === id1) e.p1++; else if (m.winner_id === id2) e.p2++
      bySurface[s] = e
    }
  }
  const names = new Map([[id1, { id: id1, name: p1.name }], [id2, { id: id2, name: p2.name }]])
  const matches: TennisResultRow[] = raw.map((m) => ({
    id: m.id, scheduled_at: m.scheduled_at, round: m.round, surface: m.surface,
    status: m.status, score: m.score, winner_id: m.winner_id,
    p1: m.p1_id ? names.get(m.p1_id) ?? null : null,
    p2: m.p2_id ? names.get(m.p2_id) ?? null : null,
    tournament: m.tennis_tournaments?.name ?? null,
  }))

  return { p1, p2, p1Wins, p2Wins, bySurface, matches }
}

export interface TennisDashboardStrip {
  top: TennisRankingRow[]
  backtest: TennisBacktestView | null
}

/**
 * Franja de tenis para el dashboard raíz: top del ranking honesto + última
 * medición del motor en producción. Pensada para consumirse desde la app
 * neutral (el dashboard no importa motores, solo esta vista).
 */
export async function fetchTennisDashboardStrip(tour: Tour = 'ATP'): Promise<TennisDashboardStrip> {
  const sb = client()
  const [top, backtest] = await Promise.all([
    buildLatestRanking(sb, tour, 3),
    fetchLatestBacktest(tour),
  ])
  return { top, backtest }
}

// ── Saque/devolución y simulador de mercados ─────────────────────────────

/** Partidos + filas de stats de un jugador (para perfiles saque/resto). */
async function playerMatchesWithStats(sb: any, pid: string): Promise<{ matches: any[]; stats: any[] }> {
  const matches = await fetchAllRows((from, to) => sb
    .from('tennis_matches')
    .select('id, p1_id, p2_id, winner_id, surface, status, scheduled_at, external_id')
    .or(`p1_id.eq.${pid},p2_id.eq.${pid}`)
    .order('id')
    .range(from, to))
  const stats: any[] = []
  const ids = (matches as any[]).map((m) => m.id)
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb
      .from('tennis_match_stats')
      .select('match_id, player_id, aces, double_faults, serve_points, first_serve_in, first_serve_won, second_serve_won, service_games, break_points_saved, break_points_faced, return_games_won')
      .in('match_id', ids.slice(i, i + 200))
    stats.push(...(data ?? []))
  }
  return { matches, stats }
}

export interface TennisMatchupSim {
  markets: TennisMarkets
  p1: MCPointProfile
  p2: MCPointProfile
}

/**
 * Simulador Monte Carlo de mercados para un enfrentamiento hipotético HOY
 * (best-of-3): perfiles de puntos REALES de cada jugador → punto→juego→set→
 * partido. Null si alguno no llega al mínimo de partidos con stats (se
 * declara en la UI, no se estima).
 */
export async function fetchTennisMatchupSim(id1: string, id2: string): Promise<TennisMatchupSim | null> {
  if (!id1 || !id2 || id1 === id2) return null
  const sb = client()
  const [a, b] = await Promise.all([
    playerMatchesWithStats(sb, id1),
    playerMatchesWithStats(sb, id2),
  ])
  const p1 = computePointProfile(a.matches, a.stats, id1)
  const p2 = computePointProfile(b.matches, b.stats, id2)
  if (!p1 || !p2) return null
  return { markets: simulateTennisMarkets(p1, p2, { sims: 10000, seed: 20260717 }), p1, p2 }
}

export interface TennisMatchPlayer {
  id: string
  name: string
  country_code: string | null
  plays_hand: 'R' | 'L' | null
  rankPosition: number | null
  /** Forma reciente ANTES de este partido (más reciente al final) */
  formBefore: ('W' | 'L')[]
  /** Índices 0-100 de saque/devolución del histórico completo (como el rank,
   *  es la última verdad conocida del jugador, no una foto pre-partido). */
  serveIndex: number | null
  returnIndex: number | null
}

export interface TennisMatchDetail {
  id: string
  scheduled_at: string | null
  round: string | null
  surface: string | null
  status: string
  score: string | null
  best_of: number | null
  winner_id: string | null
  tournament: { name: string | null; level: string | null; city: string | null; season: string | null }
  p1: TennisMatchPlayer | null
  p2: TennisMatchPlayer | null
  h2h: { p1Wins: number; p2Wins: number } | null
}

/** Forma reciente de un jugador ANTES de una fecha (últimos n, W/L cronológico). */
async function formBefore(sb: any, playerId: string, beforeIso: string | null, n = 5): Promise<('W' | 'L')[]> {
  let q = sb
    .from('tennis_matches')
    .select('winner_id, scheduled_at')
    .in('status', COUNTABLE)
    .or(`p1_id.eq.${playerId},p2_id.eq.${playerId}`)
    .order('scheduled_at', { ascending: false })
    .limit(n)
  if (beforeIso) q = q.lt('scheduled_at', beforeIso)
  const { data } = await q
  return ((data ?? []) as any[])
    .reverse() // cronológico: más reciente al final
    .map((m) => (m.winner_id === playerId ? 'W' : 'L'))
}

/** Detalle de un partido: hechos reales + contexto (rank, forma, H2H). */
export async function fetchTennisMatchDetail(id: string): Promise<TennisMatchDetail | null> {
  const sb = client()
  const { data: m } = await sb
    .from('tennis_matches')
    .select('id, scheduled_at, round, surface, status, score, best_of, winner_id, p1_id, p2_id, tennis_tournaments!inner(name, level, city, season)')
    .eq('id', id)
    .maybeSingle()
  if (!m) return null

  const ids = [m.p1_id, m.p2_id].filter(Boolean) as string[]
  const { data: players } = ids.length
    ? await sb.from('tennis_players').select('id, name, country_code, plays_hand').in('id', ids)
    : { data: [] }
  const pmap = new Map(((players ?? []) as any[]).map((p) => [p.id, p]))

  const build = async (pid: string | null): Promise<TennisMatchPlayer | null> => {
    if (!pid) return null
    const p = pmap.get(pid)
    if (!p) return null
    const [rank, form, sr] = await Promise.all([
      latestRankOfPlayer(sb, pid),
      formBefore(sb, pid, m.scheduled_at),
      playerMatchesWithStats(sb, pid),
    ])
    const profile = computeServeReturnProfile(sr.matches as any, sr.stats as any, pid)
    return {
      id: pid, name: p.name, country_code: p.country_code, plays_hand: p.plays_hand,
      rankPosition: rank?.position ?? null, formBefore: form,
      serveIndex: profile.serveIndex, returnIndex: profile.returnIndex,
    }
  }

  const [p1, p2, h2hFull] = await Promise.all([
    build(m.p1_id), build(m.p2_id),
    m.p1_id && m.p2_id ? fetchTennisH2H(m.p1_id, m.p2_id) : Promise.resolve(null),
  ])

  return {
    id: m.id, scheduled_at: m.scheduled_at, round: m.round, surface: m.surface,
    status: m.status, score: m.score, best_of: m.best_of, winner_id: m.winner_id,
    tournament: {
      name: m.tennis_tournaments?.name ?? null, level: m.tennis_tournaments?.level ?? null,
      city: m.tennis_tournaments?.city ?? null, season: m.tennis_tournaments?.season ?? null,
    },
    p1, p2,
    h2h: h2hFull ? { p1Wins: h2hFull.p1Wins, p2Wins: h2hFull.p2Wins } : null,
  }
}
