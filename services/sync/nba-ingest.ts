/**
 * Ingesta de la NBA desde API-Basketball (api-sports.io, liga 12).
 *
 * Carga las 30 franquicias y el calendario completo de la temporada
 * 2024-25 (accesible en el plan Free) en las MISMAS tablas del fútbol
 * (teams/matches) bajo la competición NBA. Las vistas del resto de la
 * plataforma filtran por competición, así que nada se mezcla.
 *
 * Idempotente: upserts por api_football_id (reutilizado como id externo
 * de api-sports, sea cual sea el deporte). Consume 2 requests por corrida.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import {
  NBA_COMPETITION_ID, NBA_API_LEAGUE_ID, NBA_API_SEASON, matchFranchise,
} from '@/lib/nba'

const HOST = 'v1.basketball.api-sports.io'

function apiHeaders() {
  const key = process.env.SPORTS_API_KEY
  if (!key) throw new Error('SPORTS_API_KEY no configurada')
  return { 'x-apisports-key': key }
}

async function apiGet(path: string): Promise<any> {
  const res = await fetch(`https://${HOST}${path}`, { headers: apiHeaders(), cache: 'no-store' })
  if (!res.ok) throw new Error(`API-Basketball ${path} → HTTP ${res.status}`)
  const body = await res.json()
  const errs = body?.errors
  if (errs && !Array.isArray(errs) && Object.keys(errs).length > 0) {
    throw new Error(`API-Basketball ${path}: ${Object.values(errs).join('; ')}`)
  }
  return body
}

/** Estados de API-Basketball → nuestro enum match_status. */
const STATUS_MAP: Record<string, string> = {
  NS: 'scheduled',
  Q1: 'live', Q2: 'live', Q3: 'live', Q4: 'live', OT: 'live', BT: 'live', HT: 'live', LIVE: 'live',
  FT: 'finished', AOT: 'finished',
  POST: 'postponed', CANC: 'cancelled', SUSP: 'cancelled', ABD: 'cancelled', AWD: 'finished',
}

export interface NbaIngestResult {
  teamsUpserted: number
  matchesUpserted: number
  requestsUsed: number
}

export async function ingestNba(): Promise<NbaIngestResult> {
  const supabase = createAdminClient()

  // ── Equipos ──────────────────────────────────────────────
  const teamsBody = await apiGet(`/teams?league=${NBA_API_LEAGUE_ID}&season=${NBA_API_SEASON}`)
  const apiTeams = (teamsBody?.response ?? []) as any[]

  // Solo franquicias reales (matchFranchise filtra All-Star, etc.)
  const teamRows = apiTeams
    .map((t) => {
      const fr = matchFranchise(t.name ?? '')
      if (!fr) return null
      return {
        api_football_id: t.id,
        competition_id: NBA_COMPETITION_ID,
        name: fr.name,
        short_name: fr.name,
        code: fr.code,
        logo_url: t.logo ?? null,
        conference: fr.conference,
        division: fr.division,
        confederation: null,
      }
    })
    .filter(Boolean) as any[]

  if (teamRows.length === 0) throw new Error('API-Basketball devolvió 0 franquicias NBA reconocibles')

  // Dedupe defensivo por código (una franquicia = un código, aunque la API
  // liste variantes del mismo equipo): conserva la primera aparición.
  const seenCodes = new Set<string>()
  const dedupedTeams = teamRows.filter((t) => {
    if (seenCodes.has(t.code)) return false
    seenCodes.add(t.code)
    return true
  })

  const { error: teamsErr } = await (supabase.from('teams') as any)
    .upsert(dedupedTeams, { onConflict: 'competition_id,api_football_id' })
  if (teamsErr) throw new Error(`upsert teams NBA: ${teamsErr.message}`)

  const { data: dbTeams } = await supabase
    .from('teams').select('id, api_football_id').eq('competition_id', NBA_COMPETITION_ID)
  const teamUuid = new Map((dbTeams ?? []).map((t: any) => [t.api_football_id, t.id]))

  // ── Calendario ───────────────────────────────────────────
  const gamesBody = await apiGet(`/games?league=${NBA_API_LEAGUE_ID}&season=${NBA_API_SEASON}`)
  const apiGames = (gamesBody?.response ?? []) as any[]

  // Ventanas de la temporada 2024-25 (la API mezcla pretemporada, regular
  // y playoffs bajo una sola "season"). Clasificamos por fecha:
  //   < 22 oct 2024 → pretemporada (se ignora, baja señal)
  //   22 oct 2024 – 14 abr 2025 → temporada regular (cuenta para standings)
  //   ≥ 15 abr 2025 → play-in + playoffs
  const REGULAR_START = '2024-10-22'
  const PLAYOFFS_START = '2025-04-15'
  const dayOf = (iso: string) => String(iso).slice(0, 10)

  const matchRows = apiGames
    .filter((g) => teamUuid.has(g.teams?.home?.id) && teamUuid.has(g.teams?.away?.id))
    .filter((g) => dayOf(g.date) >= REGULAR_START) // descarta pretemporada
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id)
    .map((g, idx) => {
      const isPlayoff = dayOf(g.date) >= PLAYOFFS_START
      return {
        api_football_id: g.id,
        competition_id: NBA_COMPETITION_ID,
        phase: isPlayoff ? 'playoffs' : 'regular_season',
        match_number: idx + 1,
        status: STATUS_MAP[g.status?.short] ?? 'scheduled',
        home_team_id: teamUuid.get(g.teams.home.id),
        away_team_id: teamUuid.get(g.teams.away.id),
        home_score: g.scores?.home?.total ?? null,
        away_score: g.scores?.away?.total ?? null,
        kickoff_time: g.date,
        venue: g.venue ?? 'Por confirmar',
        city: 'Estados Unidos',
        country: 'Estados Unidos',
      }
    })

  let matchesUpserted = 0
  for (let i = 0; i < matchRows.length; i += 200) {
    const chunk = matchRows.slice(i, i + 200)
    const { error } = await (supabase.from('matches') as any)
      .upsert(chunk, { onConflict: 'api_football_id' })
    if (error) throw new Error(`upsert matches NBA: ${error.message}`)
    matchesUpserted += chunk.length
  }

  await (supabase.from('sync_logs') as any).insert({
    source: 'api_basketball',
    entity_type: 'nba_ingest',
    status: 'success',
    records_processed: dedupedTeams.length + matchesUpserted,
    records_failed: 0,
    metadata: { season: NBA_API_SEASON, teams: dedupedTeams.length, matches: matchesUpserted },
  })

  return { teamsUpserted: dedupedTeams.length, matchesUpserted, requestsUsed: 2 }
}
