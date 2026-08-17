/**
 * Historial de aciertos de Smart Bets AI.
 *
 * Dos pasos, siempre en este orden:
 *   1. snapshotScheduledPicks — ANTES del partido: congela el top-5 que
 *      el motor recomienda en ese momento (status='scheduled'). Se
 *      puede re-ejecutar mientras el partido no empiece (recalibra con
 *      la última predicción/forma disponible sin tocar lo ya jugado).
 *   2. resolvePendingPicks — DESPUÉS del partido: califica cada pick
 *      contra el resultado real. Nunca reconstruye picks en retrospectiva.
 *
 * Ambos son best-effort: se llaman desde las cadenas de recalibración
 * existentes (Mundial y ligas) envueltos en try/catch — un fallo aquí
 * jamás debe romper la recalibración de predicciones.
 *
 * AISLAMIENTO POR DEPORTE: el motor de Smart Bets es exclusivo de fútbol
 * (goles, córners, tarjetas). Ambas funciones filtran por la lista blanca
 * de competiciones de fútbol del registro — un partido de NBA (o de
 * cualquier deporte futuro) jamás entra a este pipeline.
 *
 * ACCESO A DATOS EN LOTE (2026-08): antes esto recorría partido por partido
 * y lanzaba ~5 consultas en cada vuelta (partido, lesiones, cuotas y la
 * forma de los dos equipos). Con 1.820 partidos programados eran ~3.600
 * viajes secuenciales a la BD: ~160 s medidos, imposible dentro del tope de
 * 60 s de Vercel Hobby. Ahora el número de consultas depende del número de
 * COMPETICIONES, no de partidos, y la forma se calcula una sola vez por
 * equipo en vez de una vez por partido. De paso desaparecen dos truncados
 * silenciosos a 1.000 filas (trampa conocida de PostgREST).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { computeSmartBets, type MatchFormEntry } from '@/lib/smartBetsEngine'
import { gradeSmartBetPick } from '@/lib/smartBetGrading'
import { fetchCompetitionForms } from '@/lib/teamForm'
import { competitionIdsOfSport } from '@/lib/sports'
import { leagueAllCompetitionIds } from '@/lib/constants'
import { fetchAllRows, chunk } from '@/lib/fetchAll'

/** Tamaño de lote para filtros `.in(...)` y para los upsert. */
const BATCH = 200

const MATCH_COLUMNS = `
  *,
  home_team:teams!matches_home_team_id_fkey(*, team_statistics(*)),
  away_team:teams!matches_away_team_id_fkey(*, team_statistics(*)),
  predictions(*)
`

/**
 * Traduce el acotado del endpoint a ids de competición de FÚTBOL.
 *
 * Sin acotar devuelve la lista blanca completa del deporte. Acotando, lo
 * pedido se INTERSECTA con esa lista blanca: el aislamiento por deporte no
 * es negociable ni siquiera pasando ids a mano.
 */
export function resolveCompetitionScope(opts?: {
  leagues?: string[]
  competitionIds?: string[]
}): string[] {
  const whitelist = competitionIdsOfSport('futbol')

  const requested: string[] = []
  for (const key of opts?.leagues ?? []) {
    const ids = leagueAllCompetitionIds(key)
    if (ids.length === 0) throw new Error(`Liga desconocida: ${key}`)
    requested.push(...ids) // todas sus temporadas: los picks históricos también se resuelven
  }
  requested.push(...(opts?.competitionIds ?? []))
  if (requested.length === 0) return whitelist

  const scoped = [...new Set(requested)].filter((id) => whitelist.includes(id))
  if (scoped.length === 0) {
    throw new Error('El acotado no coincide con ninguna competición de fútbol')
  }
  return scoped
}

/** Lesiones activas de los equipos indicados, agrupadas por equipo. */
async function fetchInjuriesByTeam(supabase: any, teamIds: string[]) {
  const byTeam = new Map<string, any[]>()
  for (const ids of chunk(teamIds, BATCH)) {
    const { data, error } = await supabase
      .from('injuries')
      .select('*')
      .in('team_id', ids)
      .eq('is_active', true)
    if (error) throw new Error(`injuries: ${error.message}`)
    for (const row of (data ?? []) as any[]) {
      const list = byTeam.get(row.team_id)
      if (list) list.push(row)
      else byTeam.set(row.team_id, [row])
    }
  }
  return byTeam
}

/** Cuotas de los partidos indicados, agrupadas por partido. */
async function fetchOddsByMatch(supabase: any, matchIds: string[]) {
  const byMatch = new Map<string, any[]>()
  for (const ids of chunk(matchIds, BATCH)) {
    const { data, error } = await supabase
      .from('odds')
      .select('match_id, bookmaker, market, odds_value')
      .in('match_id', ids)
    if (error) throw new Error(`odds: ${error.message}`)
    for (const row of (data ?? []) as any[]) {
      const list = byMatch.get(row.match_id)
      if (list) list.push(row)
      else byMatch.set(row.match_id, [row])
    }
  }
  return byMatch
}

export async function snapshotScheduledPicks(
  competitionIds?: string[],
): Promise<{ matchesSnapshotted: number; picksStored: number; picksFailed: number }> {
  const supabase = createAdminClient()
  const scope = resolveCompetitionScope({ competitionIds })

  const scheduled = await fetchAllRows((from, to) =>
    supabase
      .from('matches')
      .select(MATCH_COLUMNS)
      .eq('status', 'scheduled')
      .in('competition_id', scope)
      .order('id', { ascending: true }) // orden estable: paginar sin orden repite y pierde filas
      .range(from, to),
  )
  if (scheduled.length === 0) return { matchesSnapshotted: 0, picksStored: 0, picksFailed: 0 }

  const teamIds = [
    ...new Set(scheduled.flatMap((m: any) => [m.home_team_id, m.away_team_id]).filter(Boolean)),
  ] as string[]

  const [injuriesByTeam, oddsByMatch] = await Promise.all([
    fetchInjuriesByTeam(supabase, teamIds),
    fetchOddsByMatch(supabase, scheduled.map((m: any) => m.id)),
  ])

  // Forma reciente: una pasada por competición en vez de dos consultas por
  // partido. Un equipo juega decenas de partidos programados y su forma es
  // la misma en todos ellos.
  const formsByTeam = new Map<string, MatchFormEntry[]>()
  for (const competitionId of new Set(scheduled.map((m: any) => m.competition_id))) {
    const forms = await fetchCompetitionForms(supabase, competitionId as string)
    for (const [teamId, entries] of forms) formsByTeam.set(teamId, entries)
  }

  const snapshotAt = new Date().toISOString()
  const picks: any[] = []

  for (const m of scheduled as any[]) {
    const prediction = Array.isArray(m.predictions) ? (m.predictions[0] ?? null) : (m.predictions ?? null)
    if (!prediction?.is_published) continue

    const recs = computeSmartBets(
      prediction,
      m.home_team?.team_statistics?.[0] ?? null,
      m.away_team?.team_statistics?.[0] ?? null,
      m.home_team,
      m.away_team,
      [...(injuriesByTeam.get(m.home_team_id) ?? []), ...(injuriesByTeam.get(m.away_team_id) ?? [])],
      m,
      oddsByMatch.get(m.id) ?? [],
      formsByTeam.get(m.home_team_id) ?? [],
      formsByTeam.get(m.away_team_id) ?? [],
    )
    if (recs.length === 0) continue

    for (const r of recs.slice(0, 5)) {
      picks.push({
        match_id: m.id,
        competition_id: m.competition_id,
        market_id: r.id,
        category: r.category,
        label: r.label,
        rank: r.rank,
        confidence: r.confidence,
        snapshot_at: snapshotAt,
      })
    }
  }

  // Un lote que falla no debe tumbar el resto: se cuenta y se reporta. Solo
  // se dan por congelados los partidos cuyos picks llegaron de verdad a la BD.
  let picksStored = 0
  let picksFailed = 0
  const snapshotted = new Set<string>()
  for (const batch of chunk(picks, BATCH)) {
    const { error } = await (supabase.from('smart_bet_picks') as any)
      .upsert(batch, { onConflict: 'match_id,market_id' })
    if (error) {
      picksFailed += batch.length
      console.error('[smartBetTracking] upsert de picks falló:', error.message)
    } else {
      picksStored += batch.length
      for (const p of batch) snapshotted.add(p.match_id)
    }
  }

  return { matchesSnapshotted: snapshotted.size, picksStored, picksFailed }
}

export async function resolvePendingPicks(
  competitionIds?: string[],
): Promise<{ matchesResolved: number; picksResolved: number; picksFailed: number }> {
  const supabase = createAdminClient()
  const scope = resolveCompetitionScope({ competitionIds })

  // Se reescribe la fila entera (upsert por la única (match_id, market_id)),
  // así que hay que traerse también las columnas NOT NULL que no cambian.
  const pending = await fetchAllRows((from, to) =>
    supabase
      .from('smart_bet_picks')
      .select('id, match_id, competition_id, market_id, category, label, rank, confidence, snapshot_at')
      .eq('resolved', false)
      .in('competition_id', scope)
      .order('id', { ascending: true })
      .range(from, to),
  )
  if (pending.length === 0) return { matchesResolved: 0, picksResolved: 0, picksFailed: 0 }

  const matchIds = [...new Set((pending as any[]).map((p) => p.match_id))]

  const finished = new Map<string, any>()
  for (const ids of chunk(matchIds, BATCH)) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, home_score, away_score, status')
      .in('id', ids)
      .eq('status', 'finished')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
    if (error) throw new Error(`matches: ${error.message}`)
    for (const row of (data ?? []) as any[]) finished.set(row.id, row)
  }
  if (finished.size === 0) return { matchesResolved: 0, picksResolved: 0, picksFailed: 0 }

  // Córners y tarjetas salen del boxscore. Si no hay estadísticas el pick se
  // marca no calificable (Data First): no se estima un total plausible.
  const statsByMatch = new Map<string, { corners: number; yellowCards: number }>()
  for (const ids of chunk([...finished.keys()], BATCH)) {
    const { data, error } = await supabase
      .from('match_statistics')
      .select('match_id, corners, yellow_cards')
      .in('match_id', ids)
    if (error) throw new Error(`match_statistics: ${error.message}`)
    for (const row of (data ?? []) as any[]) {
      const acc = statsByMatch.get(row.match_id) ?? { corners: 0, yellowCards: 0 }
      acc.corners += row.corners ?? 0
      acc.yellowCards += row.yellow_cards ?? 0
      statsByMatch.set(row.match_id, acc)
    }
  }

  const resolvedAt = new Date().toISOString()
  const rows: any[] = []
  const matchesTouched = new Set<string>()

  for (const pick of pending as any[]) {
    const match = finished.get(pick.match_id)
    if (!match) continue
    const stats = statsByMatch.get(pick.match_id)

    const grade = gradeSmartBetPick({
      marketId: pick.market_id,
      homeScore: match.home_score,
      awayScore: match.away_score,
      totalCorners: stats?.corners ?? null,
      totalYellowCards: stats?.yellowCards ?? null,
    })

    matchesTouched.add(pick.match_id)
    rows.push({
      ...pick,
      resolved: true,
      gradable: grade.gradable,
      correct: grade.correct,
      actual_detail: grade.detail,
      resolved_at: resolvedAt,
    })
  }

  let picksResolved = 0
  let picksFailed = 0
  for (const batch of chunk(rows, BATCH)) {
    const { error } = await (supabase.from('smart_bet_picks') as any)
      .upsert(batch, { onConflict: 'match_id,market_id' })
    if (error) {
      picksFailed += batch.length
      console.error('[smartBetTracking] resolución de picks falló:', error.message)
    } else {
      picksResolved += batch.length
    }
  }

  return { matchesResolved: matchesTouched.size, picksResolved, picksFailed }
}

/** Best-effort: nunca lanza — se llama desde las cadenas de recalibración. */
export async function syncSmartBetTracking(competitionIds?: string[]): Promise<void> {
  try {
    await snapshotScheduledPicks(competitionIds)
    await resolvePendingPicks(competitionIds)
  } catch (err: any) {
    console.error('[smartBetTracking] sync falló (no crítico):', err?.message)
  }
}
