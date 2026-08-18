/**
 * Proveedor de FÚTBOL sobre API-Football — el PRIMARIO.
 *
 * Es el único de la casa que cubre el bloque caro: plantillas, lesiones,
 * alineaciones con formación y estadísticas por jugador. ESPN cubre lo demás
 * gratis, pero no esto, y esto es lo que convierte un listado de partidos en
 * un perfil de equipo utilizable.
 *
 * Coste consciente: cada método de aquí gasta cuota real (7.500/día en Pro).
 * Los TTL de `core/cache` no son decoración — son el presupuesto.
 */

import { ProviderError } from '../../core/errors'
import { TTL } from '../../core/cache'
import type { CompetitionScope, FixtureQuery, FootballProvider } from '../../core/ports'
import { ref } from '../../core/ports'
import type {
  Capability, Competition, Fixture, Injury, Lineup, LineupPlayer, Player,
  PlayerStats, Sourced, Standing, Team, TeamStats, Venue,
} from '../../core/types'
import { apiFootball, API_FOOTBALL } from './client'
import type {
  AfFixture, AfInjury, AfLeague, AfLineup, AfPlayerStats, AfSquad,
  AfStanding, AfTeamEntry, AfTeamStats,
} from './shapes'

const CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>([
  'competitions', 'teams', 'team', 'squad', 'players', 'fixtures', 'results',
  'standings', 'teamStats', 'playerStats', 'lineups', 'injuries', 'h2h',
])

// ─── Traductores ─────────────────────────────────────────────────────────────

function toVenue(v: AfTeamEntry['venue']): Venue | null {
  if (!v?.name) return null
  return {
    name: v.name,
    city: v.city ?? null,
    country: null, // el país va en `team`, no en `venue`
    capacity: v.capacity ?? null,
    surface: v.surface ?? null,
    imageUrl: v.image ?? null,
  }
}

function toTeam(entry: AfTeamEntry, endpoint: string): Team {
  const t = entry.team
  if (!t?.id || !t.name) {
    throw new ProviderError({ kind: 'parse', provider: API_FOOTBALL, endpoint, message: 'equipo sin id o nombre' })
  }
  const venue = toVenue(entry.venue)
  return {
    ref: ref(API_FOOTBALL, t.id),
    name: t.name,
    shortName: null,
    code: t.code ?? null,
    country: t.country ?? null,
    logoUrl: t.logo ?? null,
    founded: t.founded ?? null,
    venue: venue ? { ...venue, country: t.country ?? null } : null,
    // El técnico está en /coachs (otra llamada, otra cuota): se resuelve
    // aparte cuando hace falta, no de tapadillo en cada listado.
    coach: null,
    // API-Football no publica palmarés. En null, jamás inventado.
    honours: null,
  }
}

function toFixture(f: AfFixture, endpoint: string): Fixture {
  const id = f.fixture?.id
  const home = f.teams?.home
  const away = f.teams?.away
  if (!id || !home?.id || !away?.id || !f.fixture?.date) {
    throw new ProviderError({ kind: 'parse', provider: API_FOOTBALL, endpoint, message: 'partido incompleto' })
  }
  const short = f.fixture.status?.short ?? ''
  const status: Fixture['status'] =
    ['FT', 'AET', 'PEN'].includes(short) ? 'finished'
    : ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(short) ? 'live'
    : ['PST'].includes(short) ? 'postponed'
    : ['CANC', 'ABD', 'AWD', 'WO'].includes(short) ? 'cancelled'
    : 'scheduled'

  const score = f.score
  const periods = [
    { label: '1T', home: score?.halftime?.home ?? null, away: score?.halftime?.away ?? null },
    { label: '2T', home: score?.fulltime?.home ?? null, away: score?.fulltime?.away ?? null },
  ].filter((p) => p.home !== null || p.away !== null)

  return {
    ref: ref(API_FOOTBALL, id),
    sport: 'futbol',
    competitionRef: f.league?.id ? ref(API_FOOTBALL, f.league.id) : null,
    kickoff: new Date(f.fixture.date).toISOString(),
    status,
    statusDetail: f.fixture.status?.long ?? null,
    round: f.league?.round ?? null,
    venue: f.fixture.venue?.name
      ? { name: f.fixture.venue.name, city: f.fixture.venue.city ?? null, country: null, capacity: null, surface: null, imageUrl: null }
      : null,
    home: {
      teamRef: ref(API_FOOTBALL, home.id), name: home.name ?? 'Desconocido',
      shortName: null, logoUrl: home.logo ?? null,
      score: f.goals?.home ?? null, record: null,
    },
    away: {
      teamRef: ref(API_FOOTBALL, away.id), name: away.name ?? 'Desconocido',
      shortName: null, logoUrl: away.logo ?? null,
      score: f.goals?.away ?? null, record: null,
    },
    periods: periods.length > 0 ? periods : null,
  }
}

/** "WDLWW" de API-Football → secuencia tipada, de más reciente a más antiguo. */
function parseFormString(form: string | null | undefined): Fixture extends never ? never : Standing['form'] {
  if (!form) return null
  const results = [...form].reverse().filter((c): c is 'W' | 'D' | 'L' => c === 'W' || c === 'D' || c === 'L')
  if (results.length === 0) return null
  return {
    results,
    played: results.length,
    won: results.filter((r) => r === 'W').length,
    drawn: results.filter((r) => r === 'D').length,
    lost: results.filter((r) => r === 'L').length,
  }
}

function toStanding(s: AfStanding, endpoint: string): Standing {
  if (!s.team?.id) {
    throw new ProviderError({ kind: 'parse', provider: API_FOOTBALL, endpoint, message: 'clasificación sin equipo' })
  }
  return {
    rank: s.rank ?? 0,
    teamRef: ref(API_FOOTBALL, s.team.id),
    teamName: s.team.name ?? 'Desconocido',
    played: s.all?.played ?? 0,
    won: s.all?.win ?? 0,
    drawn: s.all?.draw ?? 0,
    lost: s.all?.lose ?? 0,
    goalsFor: s.all?.goals?.for ?? null,
    goalsAgainst: s.all?.goals?.against ?? null,
    points: s.points ?? null,
    winPct: s.all?.played ? (s.all.win ?? 0) / s.all.played : null,
    form: parseFormString(s.form),
    group: s.group ?? null,
    description: s.description ?? null,
  }
}

/**
 * Aplana las estadísticas de equipo a un mapa plano.
 *
 * Solo entran valores numéricos presentes. Un porcentaje que llega como
 * "58%" se convierte; uno ausente NO aparece en el mapa, que es distinto de
 * aparecer con valor 0.
 */
function toTeamStats(s: AfTeamStats, teamId: string, competitionId: string): TeamStats {
  const m: Record<string, number> = {}
  const put = (k: string, v: unknown) => {
    if (typeof v === 'number' && Number.isFinite(v)) { m[k] = v; return }
    if (typeof v === 'string') {
      const n = Number(v.replace('%', ''))
      if (Number.isFinite(n)) m[k] = n
    }
  }
  put('played', s.fixtures?.played?.total)
  put('wins', s.fixtures?.wins?.total)
  put('draws', s.fixtures?.draws?.total)
  put('loses', s.fixtures?.loses?.total)
  put('goalsFor', s.goals?.for?.total?.total)
  put('goalsAgainst', s.goals?.against?.total?.total)
  put('goalsForAvg', s.goals?.for?.average?.total)
  put('goalsAgainstAvg', s.goals?.against?.average?.total)
  put('cleanSheets', s.clean_sheet?.total)
  put('failedToScore', s.failed_to_score?.total)
  put('penaltyScored', s.penalty?.scored?.total)
  put('penaltyMissed', s.penalty?.missed?.total)

  return {
    teamRef: ref(API_FOOTBALL, teamId),
    competitionRef: ref(API_FOOTBALL, competitionId),
    metrics: m,
    form: parseFormString(s.form),
  }
}

function toLineupPlayer(p: { player?: { id?: number; name?: string; number?: number; pos?: string; grid?: string | null } }, starter: boolean): LineupPlayer | null {
  const pl = p.player
  if (!pl?.id || !pl.name) return null
  return {
    playerRef: ref(API_FOOTBALL, pl.id),
    name: pl.name,
    shirtNumber: pl.number ?? null,
    position: pl.pos ?? null,
    gridPosition: pl.grid ?? null,
    starter,
  }
}

// ─── Proveedor ───────────────────────────────────────────────────────────────

export const apiFootballProvider: FootballProvider = {
  id: API_FOOTBALL,
  sport: 'futbol',
  capabilities: CAPABILITIES,
  quotaCostPerCall: 1,

  async listCompetitions(season?: number): Promise<Sourced<Competition[]>> {
    const { data, provenance } = await apiFootball<AfLeague>('/leagues', { season }, TTL.catalog)
    return {
      data: data.flatMap((l): Competition[] => {
        if (!l.league?.id || !l.league.name) return []
        const s = l.seasons?.[l.seasons.length - 1]
        return [{
          ref: ref(API_FOOTBALL, l.league.id),
          sport: 'futbol',
          name: l.league.name,
          shortName: null,
          country: l.country?.name ?? null,
          logoUrl: l.league.logo ?? null,
          season: s?.year ?? season ?? null,
          seasonLabel: s?.year ? String(s.year) : null,
          type: l.league.type === 'Cup' ? 'cup' : 'league',
        }]
      }),
      provenance,
    }
  },

  async listTeams(scope: CompetitionScope): Promise<Sourced<Team[]>> {
    const { data, provenance } = await apiFootball<AfTeamEntry>(
      '/teams', { league: scope.competitionId, season: scope.season }, TTL.catalog,
    )
    return { data: data.map((t) => toTeam(t, '/teams')), provenance }
  },

  async getTeam(teamId: string): Promise<Sourced<Team>> {
    const { data, provenance } = await apiFootball<AfTeamEntry>('/teams', { id: teamId }, TTL.static)
    const first = data[0]
    if (!first) {
      throw new ProviderError({ kind: 'not_found', provider: API_FOOTBALL, endpoint: '/teams', message: `equipo ${teamId} no existe` })
    }
    return { data: toTeam(first, '/teams'), provenance }
  },

  async getSquad(teamId: string): Promise<Sourced<Player[]>> {
    const { data, provenance } = await apiFootball<AfSquad>('/players/squads', { team: teamId }, TTL.roster)
    const squad = data[0]
    if (!squad) {
      throw new ProviderError({ kind: 'not_found', provider: API_FOOTBALL, endpoint: '/players/squads', message: `sin plantilla para ${teamId}` })
    }
    return {
      data: (squad.players ?? []).flatMap((p): Player[] => {
        if (!p.id || !p.name) return []
        return [{
          ref: ref(API_FOOTBALL, p.id),
          name: p.name,
          firstName: null, lastName: null,
          age: p.age ?? null,
          birthDate: null,
          nationality: null,
          height: null, weight: null,
          photoUrl: p.photo ?? null,
          position: p.position ?? null,
          shirtNumber: p.number ?? null,
          teamRef: ref(API_FOOTBALL, teamId),
        }]
      }),
      provenance,
    }
  },

  async getFixtures(query: FixtureQuery): Promise<Sourced<Fixture[]>> {
    const params: Record<string, string | number | undefined> = {
      league: query.competitionId,
      season: query.season,
      team: query.teamId,
      date: query.date,
      from: query.from,
      to: query.to,
      last: query.state === 'finished' && !query.date && !query.from ? query.limit : undefined,
      next: query.state === 'scheduled' && !query.date && !query.from ? query.limit : undefined,
    }
    if (query.state === 'live') params.live = 'all'
    const revalidate = query.state === 'live' ? TTL.live : query.state === 'finished' ? TTL.historical : TTL.schedule
    const { data, provenance } = await apiFootball<AfFixture>('/fixtures', params, revalidate)

    const out: Fixture[] = []
    for (const f of data) {
      try { out.push(toFixture(f, '/fixtures')) } catch { /* partido incompleto: se omite */ }
    }
    return { data: query.limit ? out.slice(0, query.limit) : out, provenance }
  },

  async getFixture(fixtureId: string): Promise<Sourced<Fixture>> {
    const { data, provenance } = await apiFootball<AfFixture>('/fixtures', { id: fixtureId }, TTL.schedule)
    const first = data[0]
    if (!first) {
      throw new ProviderError({ kind: 'not_found', provider: API_FOOTBALL, endpoint: '/fixtures', message: `partido ${fixtureId} no existe` })
    }
    return { data: toFixture(first, '/fixtures'), provenance }
  },

  async getStandings(scope: CompetitionScope): Promise<Sourced<Standing[]>> {
    const { data, provenance } = await apiFootball<{ league?: { standings?: AfStanding[][] } }>(
      '/standings', { league: scope.competitionId, season: scope.season }, TTL.standings,
    )
    const groups = data[0]?.league?.standings ?? []
    if (groups.length === 0) {
      throw new ProviderError({ kind: 'not_found', provider: API_FOOTBALL, endpoint: '/standings', message: 'sin clasificación' })
    }
    return { data: groups.flat().map((s) => toStanding(s, '/standings')), provenance }
  },

  async getTeamStats(teamId: string, scope: CompetitionScope): Promise<Sourced<TeamStats>> {
    // Este endpoint devuelve un OBJETO, no un array; el sobre lo envuelve igual.
    const { data, provenance } = await apiFootball<AfTeamStats>(
      '/teams/statistics', { team: teamId, league: scope.competitionId, season: scope.season }, TTL.seasonStats,
    )
    const raw = (Array.isArray(data) ? data[0] : data) as AfTeamStats | undefined
    if (!raw) {
      throw new ProviderError({ kind: 'not_found', provider: API_FOOTBALL, endpoint: '/teams/statistics', message: 'sin estadísticas' })
    }
    return { data: toTeamStats(raw, teamId, scope.competitionId), provenance }
  },

  async getPlayerStats(scope: CompetitionScope, teamId?: string): Promise<Sourced<PlayerStats[]>> {
    const { data, provenance } = await apiFootball<AfPlayerStats>(
      '/players', { league: scope.competitionId, season: scope.season, team: teamId }, TTL.seasonStats,
    )
    return {
      data: data.flatMap((row): PlayerStats[] => {
        const id = row.player?.id
        const s = row.statistics?.[0]
        if (!id || !s) return []
        const m: Record<string, number> = {}
        const put = (k: string, v: unknown) => { if (typeof v === 'number' && Number.isFinite(v)) m[k] = v }
        put('appearances', s.games?.appearences)
        put('minutes', s.games?.minutes)
        put('rating', s.games?.rating ? Number(s.games.rating) : undefined)
        put('goals', s.goals?.total)
        put('assists', s.goals?.assists)
        put('shots', s.shots?.total)
        put('shotsOn', s.shots?.on)
        put('yellowCards', s.cards?.yellow)
        put('redCards', s.cards?.red)
        return [{
          playerRef: ref(API_FOOTBALL, id),
          teamRef: s.team?.id ? ref(API_FOOTBALL, s.team.id) : null,
          competitionRef: ref(API_FOOTBALL, scope.competitionId),
          metrics: m,
        }]
      }),
      provenance,
    }
  },

  async getLineups(fixtureId: string): Promise<Sourced<Lineup[]>> {
    const { data, provenance } = await apiFootball<AfLineup>('/fixtures/lineups', { fixture: fixtureId }, TTL.lineups)
    if (data.length === 0) {
      // Antes del anuncio oficial no hay alineación. Es `not_found`, no un
      // fallo: el servicio lo traducirá a "todavía no publicada".
      throw new ProviderError({ kind: 'not_found', provider: API_FOOTBALL, endpoint: '/fixtures/lineups', message: 'alineaciones no publicadas' })
    }
    return {
      data: data.flatMap((l): Lineup[] => {
        if (!l.team?.id) return []
        return [{
          teamRef: ref(API_FOOTBALL, l.team.id),
          formation: l.formation ?? null,
          coach: l.coach?.name ? { name: l.coach.name, nationality: null, since: null, photoUrl: l.coach.photo ?? null } : null,
          starters: (l.startXI ?? []).map((p) => toLineupPlayer(p, true)).filter((p): p is LineupPlayer => p !== null),
          substitutes: (l.substitutes ?? []).map((p) => toLineupPlayer(p, false)).filter((p): p is LineupPlayer => p !== null),
        }]
      }),
      provenance,
    }
  },

  async getInjuries(scope: CompetitionScope, teamId?: string): Promise<Sourced<Injury[]>> {
    const { data, provenance } = await apiFootball<AfInjury>(
      '/injuries', { league: scope.competitionId, season: scope.season, team: teamId }, TTL.injuries,
    )
    return {
      data: data.flatMap((i): Injury[] => {
        const p = i.player
        if (!p?.id || !p.name) return []
        // "Missing Fixture" = baja segura; "Questionable" = duda.
        const t = (p.type ?? '').toLowerCase()
        const status: Injury['status'] =
          t.includes('missing') ? 'out' : t.includes('question') ? 'questionable' : t ? 'doubtful' : 'unknown'
        return [{
          playerRef: ref(API_FOOTBALL, p.id),
          playerName: p.name,
          teamRef: i.team?.id ? ref(API_FOOTBALL, i.team.id) : null,
          reason: p.reason ?? null,
          status,
          since: i.fixture?.date ? new Date(i.fixture.date).toISOString() : null,
          expectedReturn: null, // la fuente no lo publica
        }]
      }),
      provenance,
    }
  },

  async getHeadToHead(teamA: string, teamB: string, limit = 10): Promise<Sourced<Fixture[]>> {
    const { data, provenance } = await apiFootball<AfFixture>(
      '/fixtures/headtohead', { h2h: `${teamA}-${teamB}`, last: limit }, TTL.historical,
    )
    const out: Fixture[] = []
    for (const f of data) {
      try { out.push(toFixture(f, '/fixtures/headtohead')) } catch { /* se omite */ }
    }
    return { data: out, provenance }
  },
}
