/**
 * Ingesta de Copa Libertadores desde API-Football (liga 13).
 *
 * No es una liga round-robin: es grupos (8 de 4) + eliminación directa a
 * doble partido (ida/vuelta), como el Mundial. Reutiliza matches.phase
 * ('group', 'round_of_16', 'quarter_final', 'semi_final', 'final' — ya
 * existían del Mundial) y las tablas groups/group_standings; NO pasa por
 * leagueEngine.ts (walk-forward de liga, asume tabla continua de temporada).
 *
 * Se ignoran las rondas de clasificación (Qualification Round 1-3): son
 * clubes que quedaron eliminados antes de fase de grupos, de bajo interés
 * y evitan tener que sumar una fase nueva al enum por unos pocos partidos.
 *
 * Idempotente: upserts por api_football_id, igual que ingestLeagues.
 * Costo: 3 requests (equipos, calendario, tabla de grupos) una sola vez;
 * resync posterior es el mismo costo.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchLeagueTeams, fetchLeagueFixtures, fetchCupStandings } from './api-football'
import { LIBERTADORES_API_ID, LIBERTADORES_COMPETITION_ID } from '@/lib/constants'

const STATUS_MAP: Record<string, string> = {
  TBD: 'scheduled', NS: 'scheduled',
  '1H': 'live', HT: 'live', '2H': 'live', ET: 'live', BT: 'live',
  P: 'live', SUSP: 'live', INT: 'live', LIVE: 'live',
  FT: 'finished', AET: 'finished', PEN: 'finished', AWD: 'finished', WO: 'finished',
  PST: 'postponed', CANC: 'cancelled', ABD: 'cancelled',
}

function toCode(name: string, apiCode: string | null, used: Set<string>): string {
  let code = (apiCode ?? name.replace(/[^A-Za-z]/g, '').slice(0, 3))
    .toUpperCase().padEnd(3, 'X').slice(0, 3)
  let n = 0
  while (used.has(code)) { n++; code = code.slice(0, 2) + String(n) }
  used.add(code)
  return code
}

/** "Group Stage - 3" → { phase: 'group', matchday: 3 }. Rondas de eliminatoria
 *  no tienen matchday (partido único o ida/vuelta, no jornada de tabla). */
export function mapRound(round: string): { phase: string; matchday: number | null } | null {
  const r = round.toLowerCase()
  if (r.startsWith('qualification')) return null // fuera de alcance (ver arriba)
  if (r.startsWith('group stage')) {
    const m = round.match(/(\d+)\s*$/)
    return { phase: 'group', matchday: m ? Number(m[1]) : null }
  }
  if (r.includes('round of 16')) return { phase: 'round_of_16', matchday: null }
  if (r.includes('quarter')) return { phase: 'quarter_final', matchday: null }
  if (r.includes('semi')) return { phase: 'semi_final', matchday: null }
  if (r.includes('final')) return { phase: 'final', matchday: null }
  return null // fase desconocida/nueva: no se inventa un mapeo, se ignora y se loguea
}

export interface LibertadoresIngestResult {
  ok: boolean
  teamsUpserted: number
  groupsUpserted: number
  matchesUpserted: number
  skippedRounds: string[]
}

export async function ingestLibertadores(season: number): Promise<LibertadoresIngestResult> {
  const supabase = createAdminClient()
  const competitionId = LIBERTADORES_COMPETITION_ID

  const [apiTeams, fixtures, standings] = await Promise.all([
    fetchLeagueTeams(LIBERTADORES_API_ID, season),
    fetchLeagueFixtures(LIBERTADORES_API_ID, season),
    fetchCupStandings(LIBERTADORES_API_ID, season),
  ])

  // Solo fase de grupos en adelante — ver nota de cabecera.
  const skippedRounds = new Set<string>()
  const mappedFixtures = fixtures
    .map((f) => {
      const mapped = mapRound(f.round)
      if (!mapped) { skippedRounds.add(f.round); return null }
      return { ...f, ...mapped }
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)

  if (mappedFixtures.length === 0) {
    throw new Error('Copa Libertadores: 0 partidos de fase de grupos en adelante — ¿temporada equivocada?')
  }

  // ─── Grupos (A-H) ───────────────────────────────────────────
  const groupLetters = [...new Set(standings.map((s) => s.groupName.replace('Group ', '')))].sort()
  const groupRows = groupLetters.map((letter) => ({
    competition_id: competitionId,
    name: `Grupo ${letter}`,
    letter,
  }))
  const { data: upsertedGroups, error: groupsErr } = await (supabase.from('groups') as any)
    .upsert(groupRows, { onConflict: 'competition_id,letter' })
    .select('id, letter')
  if (groupsErr) throw new Error(`upsert groups: ${groupsErr.message}`)
  const groupIdByLetter = new Map<string, string>((upsertedGroups ?? []).map((g: any) => [g.letter, g.id]))
  const groupLetterByTeamApiId = new Map(standings.map((s) => [s.teamApiId, s.groupName.replace('Group ', '')]))

  // ─── Equipos: solo los que juegan de fase de grupos en adelante ─────────
  const playingApiIds = new Set<number>()
  for (const f of mappedFixtures) { playingApiIds.add(f.homeId); playingApiIds.add(f.awayId) }
  const relevantTeams = apiTeams.filter((t) => playingApiIds.has(t.id))

  const { data: existing } = await supabase
    .from('teams')
    .select('code, api_football_id')
    .eq('competition_id', competitionId)
  const codeByApiId = new Map((existing ?? []).map((t: any) => [t.api_football_id, t.code]))
  const used = new Set<string>((existing ?? []).map((t: any) => t.code))

  const teamRows = relevantTeams.map((t) => {
    const letter = groupLetterByTeamApiId.get(t.id)
    return {
      api_football_id: t.id,
      competition_id: competitionId,
      name: t.name,
      short_name: t.name,
      code: codeByApiId.get(t.id) ?? toCode(t.name, t.code, used),
      logo_url: t.logo,
      confederation: 'CONMEBOL' as const,
      group_id: letter ? (groupIdByLetter.get(letter) ?? null) : null,
      founded_year: t.founded,
      venue_name: t.venueName,
      venue_city: t.venueCity,
      venue_capacity: t.venueCapacity,
      venue_image_url: t.venueImage,
    }
  })
  const { error: teamsErr } = await (supabase.from('teams') as any)
    .upsert(teamRows, { onConflict: 'competition_id,api_football_id' })
  if (teamsErr) throw new Error(`upsert teams: ${teamsErr.message}`)

  const { data: dbTeams } = await supabase
    .from('teams')
    .select('id, api_football_id')
    .eq('competition_id', competitionId)
  const teamUuid = new Map((dbTeams ?? []).map((t: any) => [t.api_football_id, t.id]))

  // ─── Filas de tabla por equipo ────────────────────────────────
  // recalculate_group_standings solo hace UPDATE de filas existentes (no
  // INSERT) — necesita esta fila en cero como punto de partida, o el
  // agregado de partidos jugados no tiene dónde escribirse.
  const standingsSeedRows = relevantTeams
    .map((t) => {
      const letter = groupLetterByTeamApiId.get(t.id)
      const groupId = letter ? groupIdByLetter.get(letter) : null
      const teamId = teamUuid.get(t.id)
      return groupId && teamId ? { group_id: groupId, team_id: teamId } : null
    })
    .filter((r): r is { group_id: string; team_id: string } => r !== null)
  if (standingsSeedRows.length > 0) {
    const { error: seedErr } = await (supabase.from('group_standings') as any)
      .upsert(standingsSeedRows, { onConflict: 'group_id,team_id', ignoreDuplicates: true })
    if (seedErr) throw new Error(`seed group_standings: ${seedErr.message}`)
  }

  // ─── Partidos ───────────────────────────────────────────────
  const matchRows = mappedFixtures
    .filter((f) => teamUuid.has(f.homeId) && teamUuid.has(f.awayId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .map((f, idx) => ({
      api_football_id: f.id,
      competition_id: competitionId,
      group_id: f.phase === 'group' ? (groupIdByLetter.get(groupLetterByTeamApiId.get(f.homeId) ?? '') ?? null) : null,
      phase: f.phase,
      match_number: idx + 1,
      round: f.matchday,
      status: STATUS_MAP[f.statusShort] ?? 'scheduled',
      home_team_id: teamUuid.get(f.homeId),
      away_team_id: teamUuid.get(f.awayId),
      home_score: f.homeGoals,
      away_score: f.awayGoals,
      kickoff_time: f.date,
      venue: f.venueName ?? 'Por confirmar',
      city: f.venueCity ?? 'Por confirmar',
      country: 'Sudamérica',
    }))

  let matchesUpserted = 0
  for (let i = 0; i < matchRows.length; i += 200) {
    const chunk = matchRows.slice(i, i + 200)
    const { error: matchErr } = await (supabase.from('matches') as any)
      .upsert(chunk, { onConflict: 'api_football_id' })
    if (matchErr) throw new Error(`upsert matches: ${matchErr.message}`)
    matchesUpserted += chunk.length
  }

  // ─── Tablas de grupo + stats de equipo: desde resultados reales ya
  // insertados, misma cadena que corre tras cada resultado (post-result.ts) ─
  for (const gid of groupIdByLetter.values()) {
    await supabase.rpc('recalculate_group_standings', { p_group_id: gid })
  }
  await supabase.rpc('refresh_team_statistics')

  await (supabase.from('sync_logs') as any).insert({
    source: 'api_football',
    entity_type: 'libertadores_ingest',
    status: 'success',
    records_processed: teamRows.length + matchesUpserted,
    records_failed: 0,
    metadata: { season, skippedRounds: [...skippedRounds] },
  })

  return {
    ok: teamRows.length > 0 && matchesUpserted > 0,
    teamsUpserted: teamRows.length,
    groupsUpserted: groupRows.length,
    matchesUpserted,
    skippedRounds: [...skippedRounds],
  }
}
