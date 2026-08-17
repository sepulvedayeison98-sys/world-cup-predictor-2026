/**
 * Ingesta de PLANTILLAS, LESIONES y ALINEACIONES de fútbol.
 *
 * Es el primer proceso de sincronización que consume la capa de proveedores
 * (`services/sports/`) en vez de hablar con la API directamente. No sabe que
 * existe API-Football: pide "la plantilla del equipo 33" y recibe un
 * `DataResult`. El día que la fuente cambie, este archivo no se toca.
 *
 * Estado que corrige: 78 jugadores en base (solo Mundial), 3 lesiones, 2
 * alineaciones. Las seis ligas de clubes no tenían ni una ficha.
 *
 * ── Techo de 60 s de Vercel Hobby ──────────────────────────────────────
 * Una plantilla cuesta una petición por equipo: 20 por liga, 120 si se
 * hicieran las seis de golpe. En serie eso no cabe en 60 s. Por eso el
 * proceso trabaja SIEMPRE sobre una liga (o las que se le pasen), con
 * concurrencia acotada y un presupuesto de tiempo que corta limpio y
 * devuelve lo hecho en vez de que la función muera a medias.
 *
 * ── Idempotencia ───────────────────────────────────────────────────────
 * Todo son upserts por clave natural (migración 057). Re-correrlo no
 * duplica nada.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { footballService } from '@/services/sports/football/football.service'
import { TARGET_LEAGUES, seasonForLeague, DEFAULT_SEASON } from './api-football'
import { LEAGUE_COMPETITION_IDS } from '@/lib/constants'
import type { Injury, Lineup, Player } from '@/services/sports/core/types'

/**
 * `types/database.ts` se genera desde el esquema y todavía refleja el estado
 * anterior a la migración 057: da `date_of_birth` e `impact_score` por
 * obligatorios y `grid_x`/`grid_y` por no nulos, que es justo lo que la 057
 * relaja. Hasta que se regeneren, las escrituras a esas tablas se hacen
 * contra un cliente sin tipar. Es la misma convención que ya usa el dominio
 * de tenis con sus tablas `tennis_*`.
 */
type UntypedClient = any

// ─── Presupuesto y concurrencia ──────────────────────────────────────────────

/** Margen bajo los 60 s de Vercel para cerrar la respuesta con calma. */
const TIME_BUDGET_MS = 45_000

/** Peticiones en paralelo. Suficiente para 20 equipos en pocos segundos sin
 *  disparar el rate limit por minuto de API-Football. */
const CONCURRENCY = 4

function deadline(): () => boolean {
  const start = Date.now()
  return () => Date.now() - start > TIME_BUDGET_MS
}

/** Ejecuta en lotes de `CONCURRENCY`, parando si se agota el presupuesto. */
async function inBatches<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  expired: () => boolean,
): Promise<{ results: R[]; processed: number; truncated: boolean }> {
  const results: R[] = []
  let processed = 0
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    if (expired()) return { results, processed, truncated: true }
    const chunk = items.slice(i, i + CONCURRENCY)
    results.push(...await Promise.all(chunk.map(fn)))
    processed += chunk.length
  }
  return { results, processed, truncated: false }
}

// ─── Resultado común ─────────────────────────────────────────────────────────

export interface RosterSyncResult {
  ok: boolean
  entity: 'squads' | 'injuries' | 'lineups'
  leagues: string[]
  /** Unidades pedidas a la fuente (equipos, ligas o partidos). */
  requested: number
  processed: number
  upserted: number
  /** Filas descartadas por no poder resolverse contra nuestra base. */
  skipped: number
  /** Fuentes que respondieron "no cubierto" o fallaron, con su motivo. */
  problems: string[]
  /** true si se cortó por presupuesto de tiempo: falta trabajo por hacer. */
  truncated: boolean
  durationMs: number
}

// ─── Utilidades de mapeo ─────────────────────────────────────────────────────

interface TeamRow { id: string; api_football_id: number; competition_id: string }

/**
 * Equipos de las ligas pedidas, con su id de API-Football.
 *
 * Solo la temporada EN CURSO: `LEAGUE_COMPETITION_IDS` apunta a la campaña
 * activa. Traer plantillas de temporadas cerradas sería gastar cuota en
 * datos que ya no cambian.
 */
async function loadTeams(supabase: any, leagueKeys: string[]): Promise<Map<string, TeamRow[]>> {
  const byLeague = new Map<string, TeamRow[]>()
  for (const key of leagueKeys) {
    const competitionId = LEAGUE_COMPETITION_IDS[key]
    if (!competitionId) continue
    const { data, error } = await supabase
      .from('teams')
      .select('id, api_football_id, competition_id')
      .eq('competition_id', competitionId)
      .not('api_football_id', 'is', null)
    if (error) throw new Error(`leer equipos de ${key}: ${error.message}`)
    byLeague.set(key, (data ?? []) as TeamRow[])
  }
  return byLeague
}

/**
 * Posición del enum a partir de la que publica la fuente.
 *
 * API-Football solo distingue cuatro grupos: Goalkeeper, Defender,
 * Midfielder, Attacker. Nuestro enum exige CB, LB, RB, CDM, CM… Traducir
 * "Defender" a "CB" sería inventar una precisión que nadie nos dio, así que
 * solo se mapea el único caso EXACTO y el resto queda en null. El texto
 * original siempre se guarda en `position_raw`.
 */
export function toPositionEnum(raw: string | null): string | null {
  return raw?.toLowerCase() === 'goalkeeper' ? 'GK' : null
}

/** Clasifica el parte médico. Es una lectura del texto de la fuente, no un
 *  diagnóstico: el original se conserva íntegro en `reason_raw`. */
export function toInjuryType(reason: string | null): string {
  const r = (reason ?? '').toLowerCase()
  if (!r) return 'other'
  if (/suspend|red card|yellow card|banned/.test(r)) return 'suspension'
  if (/fracture|broken|break/.test(r)) return 'fracture'
  if (/ligament|acl|mcl|cruciate|meniscus/.test(r)) return 'ligament'
  if (/muscle|muscular|hamstring|thigh|calf|groin|adductor|strain/.test(r)) return 'muscular'
  if (/illness|virus|flu|covid|sick|fever|infection/.test(r)) return 'illness'
  return 'other'
}

/** "4:2" de API-Football → fila y posición dentro de la fila. */
export function parseGrid(grid: string | null): { x: number; y: number } | null {
  if (!grid) return null
  const m = /^(\d+):(\d+)$/.exec(grid.trim())
  if (!m) return null
  const x = Number(m[1])
  const y = Number(m[2])
  // Los CHECK de la migración 057 admiten 1..8 y 1..11. Fuera de eso el dato
  // viene mal y es mejor guardarlo sin rejilla que romper la ingesta entera.
  if (x < 1 || x > 8 || y < 1 || y > 11) return null
  return { x, y }
}

// ─── 1. Plantillas ───────────────────────────────────────────────────────────

/**
 * Trae la plantilla de cada equipo de las ligas pedidas.
 *
 * Coste: 1 petición por equipo (20 por liga). Un jugador es una fila POR
 * EQUIPO, que es como está modelada la tabla desde 001.
 */
export async function ingestSquads(onlyKeys?: string[]): Promise<RosterSyncResult> {
  const t0 = Date.now()
  const expired = deadline()
  const supabase = createAdminClient()
  const leagues = resolveLeagues(onlyKeys)
  const problems: string[] = []
  let upserted = 0
  let skipped = 0
  let requested = 0
  let truncated = false

  const teamsByLeague = await loadTeams(supabase, leagues)

  for (const key of leagues) {
    const teams = teamsByLeague.get(key) ?? []
    requested += teams.length

    const batch = await inBatches(teams, async (team) => {
      const result = await footballService.getSquad(String(team.api_football_id))
      if (result.status !== 'ok') {
        problems.push(`${key}/equipo ${team.api_football_id}: ${result.reason}`)
        return null
      }
      return { team, players: result.data }
    }, expired)

    truncated = truncated || batch.truncated

    const rows = batch.results.flatMap((r) => {
      if (!r) return []
      return r.players.flatMap((p: Player) => {
        const apiId = Number(p.ref.id)
        if (!Number.isFinite(apiId)) { skipped++; return [] }
        return [{
          team_id: r.team.id,
          api_football_id: apiId,
          name: p.name,
          // La fuente ya entrega el nombre abreviado ("K. Darlow"); no hay
          // nombre completo que acortar, así que se guarda el mismo.
          short_name: p.name,
          number: p.shirtNumber,
          position: toPositionEnum(p.position),
          position_raw: p.position,
          age: p.age,
          photo_url: p.photoUrl,
          // La fuente no publica nacionalidad ni fecha de nacimiento en el
          // endpoint de plantillas: quedan en null, no en un valor plausible.
          nationality: null,
          date_of_birth: null,
          source: 'api_football',
          updated_at: new Date().toISOString(),
        }]
      })
    })

    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await (supabase as UntypedClient)
          .from('players')
          .upsert(rows.slice(i, i + 500), { onConflict: 'team_id,api_football_id' })
        if (error) throw new Error(`upsert players ${key}: ${error.message}`)
      }
      upserted += rows.length
    }
    if (truncated) break
  }

  return {
    ok: problems.length === 0 && !truncated,
    entity: 'squads', leagues, requested,
    processed: upserted + skipped, upserted, skipped,
    problems: problems.slice(0, 10), truncated,
    durationMs: Date.now() - t0,
  }
}

// ─── 2. Lesiones ─────────────────────────────────────────────────────────────

/**
 * Partes de baja de la temporada en curso.
 *
 * API-Football devuelve las lesiones POR PARTIDO: un jugador con una lesión
 * larga aparece una vez por cada jornada que se pierde (3.402 filas en una
 * temporada de Premier). Esta tabla no modela eso: se consulta con
 * `is_active = true` para saber quién está fuera AHORA. Así que se colapsa
 * a una fila por jugador y competición, quedándose con el parte más
 * reciente, y se marca activa si corresponde a un partido aún por jugar.
 *
 * `impact_score` se deja en NULL a propósito. Ver el punto 5 de la
 * migración 057: la columna alimenta al motor de predicción y rellenarla
 * con un valor por defecto sería inyectar señal inventada.
 */
export async function ingestInjuries(onlyKeys?: string[]): Promise<RosterSyncResult> {
  const t0 = Date.now()
  const supabase = createAdminClient()
  const leagues = resolveLeagues(onlyKeys)
  const problems: string[] = []
  let upserted = 0
  let skipped = 0

  const teamsByLeague = await loadTeams(supabase, leagues)
  const now = new Date()

  for (const key of leagues) {
    const league = TARGET_LEAGUES.find((l) => l.key === key)
    const competitionId = LEAGUE_COMPETITION_IDS[key]
    if (!league || !competitionId) continue

    const season = seasonForLeague(league, DEFAULT_SEASON, now)
    const result = await footballService.getInjuries({
      competitionId: String(league.apiFootballId), season,
    })
    if (result.status !== 'ok') {
      problems.push(`${key}: ${result.reason}`)
      continue
    }

    // Índice equipo(api) → uuid, y jugador(api) → uuid, para resolver las
    // referencias sin una consulta por fila.
    const teams = teamsByLeague.get(key) ?? []
    const teamByApi = new Map(teams.map((t) => [t.api_football_id, t.id]))
    const playerByApi = await loadPlayerIndex(supabase, teams.map((t) => t.id))

    // Un parte por jugador: el más reciente gana.
    const latest = new Map<string, Injury>()
    for (const inj of result.data) {
      const key2 = inj.playerRef.id
      const prev = latest.get(key2)
      if (!prev || (inj.since ?? '') > (prev.since ?? '')) latest.set(key2, inj)
    }

    // Una parte de los lesionados NO aparece en `/players/squads`: la fuente
    // omite del listado de plantilla a bastantes bajas de larga duración
    // (11 de 31 partes de La Liga en la primera corrida). Descartarlos
    // dejaría fuera justo las lesiones que más pesan. El propio parte trae
    // id, nombre y equipo del jugador, así que se crea la ficha mínima con
    // eso —dato de la fuente, no inventado— y el resto de campos en null.
    const orphans = [...latest.values()].flatMap((inj) => {
      const teamApi = inj.teamRef ? Number(inj.teamRef.id) : null
      const teamUuid = teamApi !== null ? teamByApi.get(teamApi) : undefined
      if (!teamUuid || playerByApi.has(Number(inj.playerRef.id))) return []
      const apiId = Number(inj.playerRef.id)
      if (!Number.isFinite(apiId)) return []
      return [{
        team_id: teamUuid,
        api_football_id: apiId,
        name: inj.playerName,
        short_name: inj.playerName,
        number: null, position: null, position_raw: null, age: null,
        photo_url: null, nationality: null, date_of_birth: null,
        source: 'api_football:injuries',
        updated_at: new Date().toISOString(),
      }]
    })

    if (orphans.length > 0) {
      const { error } = await (supabase as UntypedClient)
        .from('players')
        .upsert(orphans, { onConflict: 'team_id,api_football_id' })
      if (error) throw new Error(`upsert players (desde lesiones) ${key}: ${error.message}`)
      // Reindexar para que las filas recién creadas resuelvan.
      const refreshed = await loadPlayerIndex(supabase, teams.map((t) => t.id))
      for (const [k2, v] of refreshed) playerByApi.set(k2, v)
    }

    const rows = [...latest.values()].flatMap((inj) => {
      const teamApi = inj.teamRef ? Number(inj.teamRef.id) : null
      const teamUuid = teamApi !== null ? teamByApi.get(teamApi) : undefined
      const playerUuid = playerByApi.get(Number(inj.playerRef.id))
      // Solo queda fuera lo que ni siquiera tiene equipo reconocible.
      if (!teamUuid || !playerUuid) { skipped++; return [] }

      return [{
        player_id: playerUuid,
        team_id: teamUuid,
        competition_id: competitionId,
        injury_type: toInjuryType(inj.reason),
        reason_raw: inj.reason,
        description: inj.reason,
        reported_at: inj.since ?? new Date().toISOString(),
        // Activa solo si el partido que se pierde aún no se ha jugado.
        is_active: inj.since ? new Date(inj.since) >= now : true,
        // Ver cabecera: sin dato de impacto no se inventa uno.
        impact_score: null,
        source: 'api_football',
        updated_at: new Date().toISOString(),
      }]
    })

    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await (supabase as UntypedClient)
          .from('injuries')
          .upsert(rows.slice(i, i + 500), { onConflict: 'player_id,competition_id' })
        if (error) throw new Error(`upsert injuries ${key}: ${error.message}`)
      }
      upserted += rows.length
    }
  }

  return {
    ok: problems.length === 0,
    entity: 'injuries', leagues, requested: leagues.length,
    processed: upserted + skipped, upserted, skipped,
    problems: problems.slice(0, 10), truncated: false,
    durationMs: Date.now() - t0,
  }
}

// ─── 3. Alineaciones ─────────────────────────────────────────────────────────

/**
 * Alineaciones de los partidos de una ventana temporal.
 *
 * Cuesta una petición POR PARTIDO, así que la ventana importa: por defecto,
 * los partidos entre ayer y mañana, que son los que tienen alineación
 * publicada o recién confirmada. Antes del anuncio oficial la fuente
 * responde "no encontrado", que aquí no es un fallo sino "todavía no".
 */
export async function ingestLineups(opts: {
  leagues?: string[]
  /** Horas hacia atrás y hacia delante desde ahora. */
  windowHours?: number
  maxMatches?: number
} = {}): Promise<RosterSyncResult> {
  const t0 = Date.now()
  const expired = deadline()
  const supabase = createAdminClient()
  const leagues = resolveLeagues(opts.leagues)
  const windowHours = opts.windowHours ?? 24
  const maxMatches = opts.maxMatches ?? 40
  const problems: string[] = []
  let upserted = 0
  let skipped = 0

  const competitionIds = leagues.map((k) => LEAGUE_COMPETITION_IDS[k]).filter(Boolean)
  if (competitionIds.length === 0) {
    return emptyResult('lineups', leagues, t0)
  }

  const from = new Date(Date.now() - windowHours * 3_600_000).toISOString()
  const to = new Date(Date.now() + windowHours * 3_600_000).toISOString()

  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, api_football_id, home_team_id, away_team_id, competition_id')
    .in('competition_id', competitionIds)
    .not('api_football_id', 'is', null)
    .gte('kickoff_time', from)
    .lte('kickoff_time', to)
    .order('kickoff_time')
    .limit(maxMatches)
  if (error) throw new Error(`leer partidos: ${error.message}`)

  const rows = (matches ?? []) as any[]
  if (rows.length === 0) return emptyResult('lineups', leagues, t0)

  // Índice equipo(api)→uuid de todas las ligas implicadas, y jugadores.
  const teamsByLeague = await loadTeams(supabase, leagues)
  const allTeams = [...teamsByLeague.values()].flat()
  const teamByApi = new Map(allTeams.map((t) => [t.api_football_id, t.id]))
  const playerByApi = await loadPlayerIndex(supabase, allTeams.map((t) => t.id))

  const batch = await inBatches(rows, async (match) => {
    const result = await footballService.getLineups(String(match.api_football_id))
    if (result.status !== 'ok') {
      // "Todavía no publicada" es lo normal: no ensucia el informe.
      if (!/no encontramos/i.test(result.reason)) {
        problems.push(`partido ${match.api_football_id}: ${result.reason}`)
      }
      return null
    }
    return { match, lineups: result.data }
  }, expired)

  for (const entry of batch.results) {
    if (!entry) continue
    for (const lineup of entry.lineups as Lineup[]) {
      const teamUuid = teamByApi.get(Number(lineup.teamRef.id))
      if (!teamUuid) { skipped++; continue }

      const { data: saved, error: lErr } = await (supabase as UntypedClient)
        .from('lineups')
        .upsert({
          match_id: entry.match.id,
          team_id: teamUuid,
          formation: lineup.formation,
          // Publicada por la fuente = confirmada. La fuente no anuncia
          // alineaciones probables en este endpoint.
          is_confirmed: true,
          source: 'api_football',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'match_id,team_id' })
        .select('id')
        .maybeSingle()
      if (lErr) throw new Error(`upsert lineup: ${lErr.message}`)
      const lineupId = (saved as any)?.id
      if (!lineupId) { skipped++; continue }

      const squad = [...lineup.starters, ...lineup.substitutes]

      // Igual que en las lesiones: la alineación incluye jugadores que
      // `/players/squads` no lista (canteranos convocados, fichajes recién
      // inscritos). Sin esto se perdían 19 de 179 fichas de un once. El
      // nombre y el id vienen en la propia alineación.
      const missing = squad.flatMap((p) => {
        const apiId = Number(p.playerRef.id)
        if (!Number.isFinite(apiId) || playerByApi.has(apiId)) return []
        return [{
          team_id: teamUuid,
          api_football_id: apiId,
          name: p.name,
          short_name: p.name,
          number: p.shirtNumber,
          position: null, position_raw: p.position, age: null,
          photo_url: null, nationality: null, date_of_birth: null,
          source: 'api_football:lineups',
          updated_at: new Date().toISOString(),
        }]
      })
      if (missing.length > 0) {
        const { error: pErr } = await (supabase as UntypedClient)
          .from('players')
          .upsert(missing, { onConflict: 'team_id,api_football_id' })
        if (pErr) throw new Error(`upsert players (desde alineación): ${pErr.message}`)
        const refreshed = await loadPlayerIndex(supabase, [teamUuid])
        for (const [k, v] of refreshed) playerByApi.set(k, v)
      }

      const slots = squad.flatMap((p) => {
        const playerUuid = playerByApi.get(Number(p.playerRef.id))
        if (!playerUuid) { skipped++; return [] }
        const grid = parseGrid(p.gridPosition)
        return [{
          lineup_id: lineupId,
          player_id: playerUuid,
          position: null,          // ver toPositionEnum: la fuente da "G"/"D"/"M"/"F"
          position_raw: p.position,
          grid_x: grid?.x ?? null, // los suplentes no tienen sitio en el campo
          grid_y: grid?.y ?? null,
          is_starter: p.starter,
        }]
      })

      if (slots.length > 0) {
        const { error: spErr } = await (supabase as UntypedClient)
          .from('lineup_players')
          .upsert(slots, { onConflict: 'lineup_id,player_id' })
        if (spErr) throw new Error(`upsert lineup_players: ${spErr.message}`)
        upserted += slots.length
      }
    }
  }

  return {
    ok: problems.length === 0 && !batch.truncated,
    entity: 'lineups', leagues, requested: rows.length,
    processed: batch.processed, upserted, skipped,
    problems: problems.slice(0, 10), truncated: batch.truncated,
    durationMs: Date.now() - t0,
  }
}

// ─── Auxiliares ──────────────────────────────────────────────────────────────

function resolveLeagues(onlyKeys?: string[]): string[] {
  const all = TARGET_LEAGUES.map((l) => l.key as string)
  if (!onlyKeys || onlyKeys.length === 0) return all
  return all.filter((k) => onlyKeys.includes(k))
}

/** Índice api_football_id → uuid de los jugadores de unos equipos. */
async function loadPlayerIndex(supabase: any, teamIds: string[]): Promise<Map<number, string>> {
  const index = new Map<number, string>()
  if (teamIds.length === 0) return index
  // La tabla supera el tope de 1.000 filas de PostgREST en cuanto hay unas
  // pocas plantillas, así que se pagina explícitamente.
  const PAGE = 1000
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('players')
      .select('id, api_football_id')
      .in('team_id', teamIds)
      .not('api_football_id', 'is', null)
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`leer jugadores: ${error.message}`)
    const page = (data ?? []) as { id: string; api_football_id: number }[]
    for (const p of page) index.set(p.api_football_id, p.id)
    if (page.length < PAGE) break
  }
  return index
}

function emptyResult(entity: RosterSyncResult['entity'], leagues: string[], t0: number): RosterSyncResult {
  return {
    ok: true, entity, leagues, requested: 0, processed: 0, upserted: 0,
    skipped: 0, problems: [], truncated: false, durationMs: Date.now() - t0,
  }
}
