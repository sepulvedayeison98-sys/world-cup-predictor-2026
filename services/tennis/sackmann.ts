import { createAdminClient } from '@/lib/supabase/admin'
import type { Tour } from '@/lib/tennis/constants'
import type { TennisSyncResult, IntegrityReport } from './contracts'

/**
 * DOMINIO TENNIS — ingesta real desde los datasets públicos de Jeff
 * Sackmann (Fase 4). Fuente: github.com/JeffSackmann/tennis_atp y
 * tennis_wta — CSV reales y verificables, licencia CC BY-NC-SA 4.0
 * (atribución obligatoria: se muestra en la UI del dominio y consta en
 * docs/TENNIS_ARCHITECTURE.md).
 *
 * Corre en Vercel (como todos los syncs): el runtime de producción no
 * tiene las restricciones de egreso del sandbox. Idempotente: upserts
 * por claves naturales (051/054 enseñaron la lección).
 *
 * Nota de datos (documentada): la fuente publica la FECHA DE INICIO del
 * torneo (tourney_date), no la fecha exacta de cada partido. scheduled_at
 * guarda esa fecha real del torneo; el orden fino dentro del torneo lo da
 * match_num. No se inventa granularidad que la fuente no tiene.
 */

export const SACKMANN_ATTRIBUTION =
  'Datos de tenis: TML-Database (Tennismylife), derivada del trabajo de Jeff Sackmann (CC BY-NC-SA 4.0)'

// Fuente activa: TML-Database — esquema Sackmann, actualizada a diario,
// un CSV por temporada (1968.csv … 2026.csv). Verificada en vivo el
// 2026-07-12 (los repos originales de Sackmann devuelven 404 en este
// entorno). SOLO cubre ATP: la ingesta WTA queda declarada como pendiente
// de fuente — no se fabrica nada.
const TML_BASE = 'https://raw.githubusercontent.com/Tennismylife/TML-Database/master'

// ── CSV ─────────────────────────────────────────────────────────────────
/** Parser CSV mínimo con soporte de comillas (los CSV de Sackmann son simples). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = [] }
    else if (c !== '\r') field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

async function fetchCsv(url: string): Promise<string[][]> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return parseCsv(await res.text())
}

const toInt = (v: string | undefined) => {
  const n = parseInt(v ?? '', 10)
  return Number.isFinite(n) ? n : null
}
const yyyymmdd = (v: string | undefined) =>
  v && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null
const hand = (v: string | undefined) => (v === 'R' || v === 'L' ? v : null)
const ioc = (v: string | undefined) => (v && /^[A-Z]{3}$/.test(v) ? v : null)

async function upsertBatches(table: string, rows: any[], onConflict: string, batch = 500) {
  const supabase = createAdminClient() as any
  for (let i = 0; i < rows.length; i += batch) {
    const { error } = await supabase.from(table)
      .upsert(rows.slice(i, i + batch), { onConflict, ignoreDuplicates: false })
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

async function logSync(entity: string, tour: Tour, processed: number, failed: number, ms: number, meta: any = {}) {
  const supabase = createAdminClient() as any
  await supabase.from('sync_logs').insert({
    source: 'sackmann_github', entity_type: `tennis_${entity}`, status: failed ? 'partial' : 'success',
    records_processed: processed, records_failed: failed,
    metadata: { tour, ...meta }, duration_ms: ms,
  })
}

// ── Partidos de una temporada (deriva torneos + jugadores + stats) ───────
export async function syncMatchesYear(tour: Tour, year: number): Promise<TennisSyncResult> {
  if (tour === 'WTA') {
    throw new Error('Fuente WTA pendiente: TML-Database solo cubre ATP. No se importa nada (Data First).')
  }
  const started = Date.now()
  const supabase = createAdminClient() as any
  const rows = await fetchCsv(`${TML_BASE}/${year}.csv`)
  const [header, ...data] = rows
  const col = Object.fromEntries(header.map((h, i) => [h, i])) as Record<string, number>
  const g = (r: string[], k: string) => r[col[k]]

  // 1) Torneos únicos del archivo
  const tournaments = new Map<string, any>()
  for (const r of data) {
    const tid = g(r, 'tourney_id'); if (!tid || tournaments.has(tid)) continue
    tournaments.set(tid, {
      tour, external_id: tid, name: g(r, 'tourney_name'),
      level: g(r, 'tourney_level') || null,
      surface: (g(r, 'surface') || '').toLowerCase() || null,
      draw_size: toInt(g(r, 'draw_size')),
      start_date: yyyymmdd(g(r, 'tourney_date')), end_date: null,
      city: null, country_code: null, season: String(year),
    })
  }
  await upsertBatches('tennis_tournaments', [...tournaments.values()], 'tour,external_id,season')

  // 2) Jugadores del archivo (campos reales presentes: id, nombre, mano, país, altura)
  const players = new Map<string, any>()
  for (const r of data) {
    for (const side of ['winner', 'loser'] as const) {
      const ext = g(r, `${side}_id`); if (!ext || players.has(ext)) continue
      players.set(ext, {
        tour, external_id: ext, name: g(r, `${side}_name`),
        plays_hand: hand(g(r, `${side}_hand`)),
        country_code: ioc(g(r, `${side}_ioc`)),
        height_cm: toInt(g(r, `${side}_ht`)),
        birthdate: null, // la fuente no publica DOB (edad decimal ≠ fecha exacta): queda nulo, no se deriva
      })
    }
  }
  await upsertBatches('tennis_players', [...players.values()], 'tour,external_id')

  // 3) Mapas external_id → uuid
  const { data: tRows } = await supabase.from('tennis_tournaments')
    .select('id, external_id').eq('tour', tour).eq('season', String(year))
  const tMap = new Map<string, string>((tRows ?? []).map((t: any) => [t.external_id, t.id]))
  const { data: pRows } = await supabase.from('tennis_players')
    .select('id, external_id').eq('tour', tour)
  const pMap = new Map<string, string>((pRows ?? []).map((p: any) => [p.external_id, p.id]))

  // 4) Partidos + stats. p1 = menor external_id numérico (orden neutro que no
  //    filtra al ganador por posición); winner_id apunta al ganador real.
  // Map por external_id: la fuente puede traer filas duplicadas (re-scrapes)
  // y un upsert no puede afectar la misma fila dos veces en un batch.
  const matchesByExt = new Map<string, any>()
  const statsByExt = new Map<string, { w: any; l: any; wid: string; lid: string }>()
  // Rankings OBSERVADOS: cada fila trae el ranking real del jugador a la
  // fecha del torneo (winner_rank/loser_rank). Serie temporal honesta,
  // deduplicada por (player, fecha) — TML no publica archivo de rankings.
  const rankingObs = new Map<string, any>()
  let failed = 0
  for (const r of data) {
    const tid = tMap.get(g(r, 'tourney_id'))
    const wExt = g(r, 'winner_id'), lExt = g(r, 'loser_id')
    const wId = pMap.get(wExt), lId = pMap.get(lExt)
    if (!tid || !wId || !lId) { failed++; continue }
    const ext = `${g(r, 'tourney_id')}-${g(r, 'match_num')}`
    const score = g(r, 'score') || null
    const status = score?.includes('RET') ? 'retired' : score?.includes('W/O') ? 'walkover' : 'finished'
    const [p1, p2] = wExt <= lExt ? [wId, lId] : [lId, wId] // ids alfanuméricos: orden lexicográfico neutro
    matchesByExt.set(ext, {
      tournament_id: tid, external_id: ext, round: g(r, 'round') || null,
      best_of: toInt(g(r, 'best_of')), surface: (g(r, 'surface') || '').toLowerCase() || null,
      p1_id: p1, p2_id: p2, winner_id: wId, score, status,
      scheduled_at: yyyymmdd(g(r, 'tourney_date')),
    })
    for (const [side, pid] of [['winner', wId], ['loser', lId]] as const) {
      const rk = toInt(g(r, `${side}_rank`)); const pts = toInt(g(r, `${side}_rank_points`))
      const rd = yyyymmdd(g(r, 'tourney_date'))
      if (rk && rd) rankingObs.set(`${pid}|${rd}`, { player_id: pid, ranking_date: rd, position: rk, points: pts })
    }
    statsByExt.set(ext, {
      wid: wId, lid: lId,
      w: { aces: toInt(g(r, 'w_ace')), double_faults: toInt(g(r, 'w_df')), serve_points: toInt(g(r, 'w_svpt')), first_serve_in: toInt(g(r, 'w_1stIn')), first_serve_won: toInt(g(r, 'w_1stWon')), second_serve_won: toInt(g(r, 'w_2ndWon')), service_games: toInt(g(r, 'w_SvGms')), break_points_saved: toInt(g(r, 'w_bpSaved')), break_points_faced: toInt(g(r, 'w_bpFaced')) },
      l: { aces: toInt(g(r, 'l_ace')), double_faults: toInt(g(r, 'l_df')), serve_points: toInt(g(r, 'l_svpt')), first_serve_in: toInt(g(r, 'l_1stIn')), first_serve_won: toInt(g(r, 'l_1stWon')), second_serve_won: toInt(g(r, 'l_2ndWon')), service_games: toInt(g(r, 'l_SvGms')), break_points_saved: toInt(g(r, 'l_bpSaved')), break_points_faced: toInt(g(r, 'l_bpFaced')) },
    })
  }
  const matches = [...matchesByExt.values()]
  await upsertBatches('tennis_matches', matches, 'tournament_id,external_id')
  await upsertBatches('tennis_rankings', [...rankingObs.values()], 'player_id,ranking_date')

  // 5) Stats por (match uuid, player uuid)
  // Paginado: >1000 filas superan el tope de PostgREST (regla de oro)
  const mRows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data: page } = await supabase.from('tennis_matches')
      .select('id, external_id, tournament_id')
      .in('tournament_id', [...tMap.values()])
      .range(from, from + 999)
    mRows.push(...(page ?? []))
    if (!page || page.length < 1000) break
  }
  const stats: any[] = []
  for (const m of mRows) {
    const s = statsByExt.get(m.external_id); if (!s) continue
    stats.push({ match_id: m.id, player_id: s.wid, ...s.w }, { match_id: m.id, player_id: s.lid, ...s.l })
  }
  await upsertBatches('tennis_match_stats', stats, 'match_id,player_id')

  const result: TennisSyncResult = {
    ok: true, source: 'sackmann_github', entity: 'matches', tour,
    processed: data.length, inserted: matches.length, updated: 0, failed,
    duration_ms: Date.now() - started,
  }
  await logSync('matches', tour, data.length, failed, result.duration_ms, { year, tournaments: tournaments.size, players: players.size, stats: stats.length, rankings: rankingObs.size })
  return result
}

// ── Validación de integridad (invariantes del contrato) ─────────────────
export async function validateIntegrity(): Promise<IntegrityReport> {
  const supabase = createAdminClient() as any
  const count = async (q: any) => (await q).count ?? 0
  const orphanRankings = await count(
    supabase.from('tennis_rankings').select('id', { count: 'exact', head: true }).is('player_id', null))
  const orphanMatches = await count(
    supabase.from('tennis_matches').select('id', { count: 'exact', head: true }).or('tournament_id.is.null,p1_id.is.null,p2_id.is.null'))
  const finishedNoWinner = await count(
    supabase.from('tennis_matches').select('id', { count: 'exact', head: true }).eq('status', 'finished').is('winner_id', null))
  // Duplicados de jugador: el UNIQUE(tour, external_id) los impide por schema
  return {
    orphanRankings, orphanMatches, duplicatePlayers: 0,
    matchesWithoutWinnerFinished: finishedNoWinner,
    ok: orphanRankings === 0 && orphanMatches === 0 && finishedNoWinner === 0,
  }
}
