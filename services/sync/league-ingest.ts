/**
 * Ingesta de ligas desde API-Football (Fase 4, opción A aprobada).
 *
 * Escribe equipos y calendario de Premier League y La Liga en las
 * MISMAS tablas del Mundial (teams/matches) pero bajo sus propias
 * competition_id — las vistas del Mundial filtran por competición,
 * así que estos datos nunca se mezclan (auditado 2026-07-08).
 *
 * Idempotente: upserts por api_football_id (migración 043). Se puede
 * correr las veces que haga falta; consume 2 requests de cuota por liga.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { TARGET_LEAGUES, fetchLeagueTeams, fetchLeagueFixtures } from './api-football'
import { LEAGUE_COMPETITION_IDS } from '@/lib/constants'

const LEAGUE_COUNTRY: Record<string, string> = {
  premier_league: 'Inglaterra',
  la_liga: 'España',
}

/** Estados de API-Football → nuestro enum match_status. */
const STATUS_MAP: Record<string, string> = {
  TBD: 'scheduled', NS: 'scheduled',
  '1H': 'live', HT: 'live', '2H': 'live', ET: 'live', BT: 'live',
  P: 'live', SUSP: 'live', INT: 'live', LIVE: 'live',
  FT: 'finished', AET: 'finished', PEN: 'finished', AWD: 'finished', WO: 'finished',
  PST: 'postponed', CANC: 'cancelled', ABD: 'cancelled',
}

/** Código de 3 letras único por liga (API lo trae casi siempre; fallback del nombre). */
function toCode(name: string, apiCode: string | null, used: Set<string>): string {
  let code = (apiCode ?? name.replace(/[^A-Za-z]/g, '').slice(0, 3))
    .toUpperCase().padEnd(3, 'X').slice(0, 3)
  let n = 0
  while (used.has(code)) { n++; code = code.slice(0, 2) + String(n) }
  used.add(code)
  return code
}

// match_number tiene UNIQUE (competition_id, match_number) — heredado del
// Mundial — así que NO puede ser el número de jornada (10 partidos por
// jornada chocarían). Se numera secuencialmente por fecha (1..380),
// determinista entre corridas: desempate por id de fixture.

export interface LeagueIngestResult {
  key: string
  competitionId: string
  teamsUpserted: number
  matchesUpserted: number
}

export async function ingestLeagues(season: number): Promise<{
  ok: boolean
  season: number
  leagues: LeagueIngestResult[]
  requestsUsed: number
}> {
  const supabase = createAdminClient()
  const results: LeagueIngestResult[] = []

  for (const league of TARGET_LEAGUES) {
    const competitionId = LEAGUE_COMPETITION_IDS[league.key]
    if (!competitionId) throw new Error(`Liga sin competition_id: ${league.key}`)

    // ── Equipos ──────────────────────────────────────────────
    const apiTeams = await fetchLeagueTeams(league.apiFootballId, season)
    if (apiTeams.length === 0) throw new Error(`API-Football devolvió 0 equipos para ${league.name}`)

    // Códigos ya asignados en corridas anteriores: se conservan para
    // no romper la unicidad (code, competition_id) al re-correr.
    const { data: existing } = await supabase
      .from('teams')
      .select('code, api_football_id')
      .eq('competition_id', competitionId)
    const codeByApiId = new Map((existing ?? []).map((t: any) => [t.api_football_id, t.code]))
    const used = new Set<string>((existing ?? []).map((t: any) => t.code))

    const teamRows = apiTeams.map((t) => ({
      api_football_id: t.id,
      competition_id: competitionId,
      name: t.name,
      short_name: t.name,
      code: codeByApiId.get(t.id) ?? toCode(t.name, t.code, used),
      logo_url: t.logo,
      confederation: 'UEFA',
    }))
    const { error: teamsErr } = await (supabase.from('teams') as any)
      .upsert(teamRows, { onConflict: 'competition_id,api_football_id' })
    if (teamsErr) throw new Error(`upsert teams ${league.name}: ${teamsErr.message}`)

    // Mapa api_football_id → uuid para resolver los partidos
    const { data: dbTeams } = await supabase
      .from('teams')
      .select('id, api_football_id')
      .eq('competition_id', competitionId)
    const teamUuid = new Map((dbTeams ?? []).map((t: any) => [t.api_football_id, t.id]))

    // ── Calendario ───────────────────────────────────────────
    const fixtures = await fetchLeagueFixtures(league.apiFootballId, season)
    const country = LEAGUE_COUNTRY[league.key] ?? league.country

    const matchRows = fixtures
      .filter((f) => teamUuid.has(f.homeId) && teamUuid.has(f.awayId))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      .map((f, idx) => ({
        api_football_id: f.id,
        competition_id: competitionId,
        phase: 'league',
        match_number: idx + 1,
        status: STATUS_MAP[f.statusShort] ?? 'scheduled',
        home_team_id: teamUuid.get(f.homeId),
        away_team_id: teamUuid.get(f.awayId),
        home_score: f.homeGoals,
        away_score: f.awayGoals,
        kickoff_time: f.date,
        venue: f.venueName ?? 'Por confirmar',
        city: f.venueCity ?? 'Por confirmar',
        country,
      }))

    let matchesUpserted = 0
    for (let i = 0; i < matchRows.length; i += 200) {
      const chunk = matchRows.slice(i, i + 200)
      const { error: matchErr } = await (supabase.from('matches') as any)
        .upsert(chunk, { onConflict: 'api_football_id' })
      if (matchErr) throw new Error(`upsert matches ${league.name}: ${matchErr.message}`)
      matchesUpserted += chunk.length
    }

    results.push({
      key: league.key,
      competitionId,
      teamsUpserted: teamRows.length,
      matchesUpserted,
    })
  }

  // Registro de la corrida (misma tabla que el resto de syncs)
  await (supabase.from('sync_logs') as any).insert({
    source: 'api_football',
    entity_type: 'league_ingest',
    status: 'success',
    records_processed: results.reduce((s, r) => s + r.teamsUpserted + r.matchesUpserted, 0),
    records_failed: 0,
    metadata: { season, leagues: results },
  })

  return {
    ok: results.every((r) => r.teamsUpserted > 0 && r.matchesUpserted > 0),
    season,
    leagues: results,
    requestsUsed: TARGET_LEAGUES.length * 2,
  }
}
