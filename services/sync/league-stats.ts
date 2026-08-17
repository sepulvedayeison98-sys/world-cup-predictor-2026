/**
 * Ingesta de boxscores de liga (córners, tarjetas, tiros, posesión, xG).
 *
 * Por qué existe: la ingesta de ligas solo pedía `/teams` y `/fixtures`, así
 * que los 2.427 partidos jugados de las seis ligas estaban SIN una sola
 * estadística. Consecuencias medidas: `team_statistics` usaba "xG proxy =
 * goles" como parche declarado, y los Smart Bets de córners y tarjetas no se
 * podían calificar nunca porque no había contra qué contrastarlos.
 *
 * DISCIPLINA DE CUOTA (regla de oro del HANDOFF §7): cada partido cuesta UNA
 * petición. Con 2.427 pendientes y 7.500/día, esto NO se corre a ciegas: se
 * acota siempre por liga y por número de partidos, y se reparte en varias
 * pasadas. Además el límite de 60 s de Vercel Hobby lo acota de hecho.
 *
 * DATA FIRST: lo que la fuente no entrega se queda en NULL.
 *   - big_chances / big_chances_missed → API-Football no los da. NULL.
 *   - xga → NO es una estimación: por definición son los xG del rival en ese
 *     mismo partido, así que se copia del otro equipo. Si el rival no trae
 *     xG, queda NULL.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchFixtureStatistics } from './api-football'
import { LEAGUE_SEASON_COMPETITIONS, leagueAllCompetitionIds } from '@/lib/constants'
import { fetchAllRows, chunk } from '@/lib/fetchAll'

/** Tope por corrida. Ni la cuota diaria ni los 60 s de Vercel dan para más. */
const DEFAULT_LIMIT = 40
const MAX_LIMIT = 150

export interface LeagueStatsResult {
  league: string
  pendingBefore: number
  matchesProcessed: number
  rowsUpserted: number
  withoutStats: number
  requestsUsed: number
}

/**
 * Trae boxscores de los partidos FINALIZADOS de una liga que aún no los
 * tienen, del más reciente al más antiguo (lo reciente pesa más en la forma).
 */
export async function ingestLeagueStats(
  leagueKey: string,
  limit = DEFAULT_LIMIT,
): Promise<LeagueStatsResult> {
  if (!LEAGUE_SEASON_COMPETITIONS[leagueKey]) {
    throw new Error(`Liga desconocida: ${leagueKey}`)
  }
  const capped = Math.max(1, Math.min(MAX_LIMIT, limit))
  const supabase = createAdminClient()
  const competitionIds = leagueAllCompetitionIds(leagueKey)

  // Partidos jugados de la liga (todas sus temporadas) con id de la fuente
  const finished = await fetchAllRows((from, to) =>
    supabase
      .from('matches')
      .select('id, api_football_id, kickoff_time')
      .in('competition_id', competitionIds)
      .eq('status', 'finished')
      .not('api_football_id', 'is', null)
      .order('kickoff_time', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
  )

  // Cuáles ya tienen boxscore: una consulta, no una por partido
  const yaConStats = new Set<string>()
  for (const ids of chunk(finished.map((m: any) => m.id), 200)) {
    const { data, error } = await supabase
      .from('match_statistics')
      .select('match_id')
      .in('match_id', ids)
    if (error) throw new Error(`match_statistics: ${error.message}`)
    for (const r of (data ?? []) as any[]) yaConStats.add(r.match_id)
  }

  const pendientes = (finished as any[]).filter((m) => !yaConStats.has(m.id))
  const tanda = pendientes.slice(0, capped)

  // Mapa id de la fuente → nuestro uuid, para las dos filas de cada partido
  const { data: teamRows, error: tErr } = await supabase
    .from('teams')
    .select('id, api_football_id')
    .in('competition_id', competitionIds)
    .not('api_football_id', 'is', null)
  if (tErr) throw new Error(`teams: ${tErr.message}`)
  const teamByApiId = new Map<number, string>()
  for (const t of (teamRows ?? []) as any[]) teamByApiId.set(t.api_football_id, t.id)

  const rows: any[] = []
  let requestsUsed = 0
  let withoutStats = 0

  for (const m of tanda) {
    let stats
    try {
      stats = await fetchFixtureStatistics(m.api_football_id)
      requestsUsed++
    } catch (err: any) {
      // Un partido que falla no debe tumbar la tanda; la cuota ya se gastó.
      requestsUsed++
      console.error(`[league-stats] fixture ${m.api_football_id}: ${err?.message}`)
      continue
    }
    if (stats.length === 0) { withoutStats++; continue }

    for (const s of stats) {
      const teamId = teamByApiId.get(s.apiTeamId)
      if (!teamId) continue // equipo de otra temporada: no se fuerza el enlace
      // xGA = xG del rival en el mismo partido. Definición, no estimación.
      const rival = stats.find((o) => o.apiTeamId !== s.apiTeamId)
      rows.push({
        match_id: m.id,
        team_id: teamId,
        possession: s.possession,
        shots: s.shots,
        shots_on_target: s.shots_on_target,
        corners: s.corners,
        fouls: s.fouls,
        yellow_cards: s.yellow_cards,
        red_cards: s.red_cards,
        offsides: s.offsides,
        passes: s.passes,
        pass_accuracy: s.pass_accuracy,
        xg: s.xg,
        xga: rival?.xg ?? null,
        saves: s.saves,
        source: 'api_football',
      })
    }
  }

  let rowsUpserted = 0
  for (const batch of chunk(rows, 200)) {
    const { error } = await (supabase.from('match_statistics') as any)
      .upsert(batch, { onConflict: 'match_id,team_id' })
    if (error) throw new Error(`upsert match_statistics: ${error.message}`)
    rowsUpserted += batch.length
  }

  await (supabase.from('sync_logs') as any).insert({
    source: 'api_football',
    entity_type: 'league_stats',
    status: 'success',
    records_processed: rowsUpserted,
    records_failed: withoutStats,
    metadata: { league: leagueKey, requestsUsed, pendingBefore: pendientes.length },
  })

  return {
    league: leagueKey,
    pendingBefore: pendientes.length,
    matchesProcessed: tanda.length,
    rowsUpserted,
    withoutStats,
    requestsUsed,
  }
}

/** Cuántos partidos siguen sin boxscore, por liga. No consume cuota. */
export async function pendingLeagueStats(): Promise<Record<string, number>> {
  const supabase = createAdminClient()
  const out: Record<string, number> = {}

  for (const leagueKey of Object.keys(LEAGUE_SEASON_COMPETITIONS)) {
    const competitionIds = leagueAllCompetitionIds(leagueKey)
    const finished = await fetchAllRows((from, to) =>
      supabase
        .from('matches')
        .select('id')
        .in('competition_id', competitionIds)
        .eq('status', 'finished')
        .not('api_football_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
    )
    const conStats = new Set<string>()
    for (const ids of chunk(finished.map((m: any) => m.id), 200)) {
      const { data } = await supabase.from('match_statistics').select('match_id').in('match_id', ids)
      for (const r of (data ?? []) as any[]) conStats.add(r.match_id)
    }
    out[leagueKey] = finished.length - conStats.size
  }
  return out
}
