/**
 * Collector de API-Football (api-sports.io) — Fase 4: otras ligas.
 *
 * FASE ACTUAL: validación. Este módulo SOLO LEE de la API para verificar
 * que la cuenta, los equipos y el calendario de las ligas elegidas
 * (Premier League y La Liga) responden bien. No escribe en la base de
 * datos: la ingesta real llega en la siguiente fase, cuando existan las
 * competiciones/temporadas en el schema multi-deporte (migración 041).
 *
 * Credenciales: SPORTS_API_KEY (Vercel, ya verificada) y opcionalmente
 * SPORTS_API_HOST. Plan Free: 100 requests/día y solo temporadas
 * 2022-2024. Para 2025-26 (ya jugada) y 2026-27 (en vivo) se necesita el
 * upgrade de plan; una vez contratado, basta con la env FOOTBALL_API_SEASON
 * (ver DEFAULT_SEASON abajo) — no hace falta tocar código.
 *
 * NOTA: SPORTS_API_SEASON y SPORTS_API_LEAGUE existen en Vercel como
 * restos de una configuración anterior con valores desconocidos; se
 * ignoran a propósito. El knob válido es FOOTBALL_API_SEASON.
 */

// IDs oficiales de liga en API-Football. Opción A aprobada (Premier +
// La Liga); etapa 5 completa las 5 grandes ligas europeas.
export const TARGET_LEAGUES = [
  { key: 'premier_league', apiFootballId: 39, name: 'Premier League', country: 'England', seasonFormat: 'european' },
  { key: 'la_liga', apiFootballId: 140, name: 'La Liga', country: 'Spain', seasonFormat: 'european' },
  { key: 'serie_a', apiFootballId: 135, name: 'Serie A', country: 'Italy', seasonFormat: 'european' },
  { key: 'bundesliga', apiFootballId: 78, name: 'Bundesliga', country: 'Germany', seasonFormat: 'european' },
  { key: 'ligue_1', apiFootballId: 61, name: 'Ligue 1', country: 'France', seasonFormat: 'european' },
  // Primera A de Colombia. Su temporada es el AÑO CALENDARIO (ene-dic) con
  // dos torneos (Apertura y Clausura) más cuadrangulares y finales: NO es
  // el formato europeo agosto-mayo. Por eso lleva seasonFormat propio.
  { key: 'liga_betplay', apiFootballId: 239, name: 'Liga BetPlay', country: 'Colombia', seasonFormat: 'calendar' },
] as const

/**
 * Temporada a pedir a la API para una liga concreta.
 *
 * En API-Football el número de temporada es el año de INICIO de la campaña.
 * Para las ligas europeas eso significa que la 2024-25 se pide como 2024;
 * para las de año calendario (Colombia) el año es literal. Ambas coinciden
 * numéricamente cuando se ingesta un año ya cerrado, pero la semántica es
 * distinta y conviene que el código la exprese en vez de que sea una
 * coincidencia afortunada.
 */
export function seasonForLeague(
  league: { seasonFormat?: string }, baseSeason: number, now: Date = new Date(),
): number {
  if (league.seasonFormat !== 'calendar') return baseSeason
  // Año calendario: nunca por delante del año en curso (la API no tiene futuro).
  return Math.min(baseSeason, now.getUTCFullYear())
}

/**
 * Temporada de fútbol en el formato de API-Football: el AÑO DE INICIO de la
 * campaña europea (2024 = temporada 2024-25, ago-2024 → may-2025). La liga
 * arranca a mediados de agosto y los fixtures salen en junio-julio; de julio
 * en adelante ya apunta a la campaña que empieza ese año.
 *
 * Hoy NO es el default (ver DEFAULT_SEASON): el plan Free solo sirve hasta
 * 2024. Queda listo para que, tras contratar el plan de pago, el fallback se
 * cambie a esta función y el número de temporada avance solo cada año.
 */
export function currentFootballSeason(now: Date = new Date()): number {
  const y = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1 // 1-12
  return month >= 7 ? y : y - 1
}

/**
 * Temporada por defecto de la validación y la ingesta. Se fuerza con la env
 * `FOOTBALL_API_SEASON` — ESE es el único knob a mover en Vercel tras el
 * upgrade de plan (p. ej. `FOOTBALL_API_SEASON=2026` para la 2026-27).
 *
 * Fallback: 2024, la última temporada accesible en el plan Free. Se mantiene
 * fijo a propósito: subirlo sin plan de pago haría que la API devuelva 0
 * equipos/partidos y el ingest falle. Con el plan de pago ya activo, se puede
 * dejar la env o cambiar este fallback a `currentFootballSeason()`.
 */
export const DEFAULT_SEASON: number = ((): number => {
  const env = Number(process.env.FOOTBALL_API_SEASON)
  return Number.isFinite(env) && env > 2000 ? env : 2024
})()

interface ApiFootballResponse<T> {
  errors: Record<string, string> | string[]
  results: number
  paging: { current: number; total: number }
  response: T[]
}

function getConfig() {
  const key = process.env.SPORTS_API_KEY
  if (!key) throw new Error('SPORTS_API_KEY no está configurada')
  const host = process.env.SPORTS_API_HOST || 'v3.football.api-sports.io'
  const headers: Record<string, string> = host.includes('rapidapi')
    ? { 'x-rapidapi-key': key, 'x-rapidapi-host': host }
    : { 'x-apisports-key': key }
  return { host, headers }
}

async function apiFootballFetch<T>(path: string, params: Record<string, string | number> = {}): Promise<ApiFootballResponse<T>> {
  const { host, headers } = getConfig()
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])))
  const url = `https://${host}${path}${qs.size ? `?${qs}` : ''}`
  const res = await fetch(url, { headers, cache: 'no-store' })
  if (!res.ok) throw new Error(`API-Football ${path} → HTTP ${res.status}`)
  const body = (await res.json()) as ApiFootballResponse<T>
  // La API devuelve 200 con `errors` poblado cuando algo falla (cuota, plan…)
  const errs = body.errors
  if (errs && !Array.isArray(errs) && Object.keys(errs).length > 0) {
    throw new Error(`API-Football ${path}: ${Object.values(errs).join('; ')}`)
  }
  return body
}

// ─── Estado de cuenta (endpoint gratuito, no consume cuota) ──────────────────

export interface AccountStatus {
  plan: string
  requestsToday: number
  requestsLimitDay: number
  subscriptionActive: boolean
  subscriptionEnd: string
}

export async function getAccountStatus(): Promise<AccountStatus> {
  const { host, headers } = getConfig()
  const res = await fetch(`https://${host}/status`, { headers, cache: 'no-store' })
  if (!res.ok) throw new Error(`API-Football /status → HTTP ${res.status}`)
  const body = await res.json()
  const r = body?.response
  return {
    plan: r?.subscription?.plan ?? 'desconocido',
    requestsToday: r?.requests?.current ?? 0,
    requestsLimitDay: r?.requests?.limit_day ?? 0,
    subscriptionActive: r?.subscription?.active ?? false,
    subscriptionEnd: r?.subscription?.end ?? '',
  }
}

// ─── Fetchers crudos (los usa la validación y la ingesta) ────────────────────

interface TeamEntry {
  team: { id: number; name: string; code: string | null; logo: string; founded: number | null }
  venue: { name: string | null; city: string | null; capacity: number | null; image: string | null }
}
interface FixtureEntry {
  fixture: {
    id: number
    date: string
    status: { short: string }
    venue: { name: string | null; city: string | null }
  }
  league: { round: string }
  teams: { home: { id: number; name: string }; away: { id: number; name: string } }
  goals: { home: number | null; away: number | null }
}

export interface ApiFootballTeam {
  id: number; name: string; code: string | null; logo: string
  founded: number | null
  venueName: string | null; venueCity: string | null
  venueCapacity: number | null; venueImage: string | null
}
export interface ApiFootballFixture {
  id: number
  date: string
  statusShort: string
  round: string
  venueName: string | null
  venueCity: string | null
  homeId: number
  awayId: number
  homeGoals: number | null
  awayGoals: number | null
}

export async function fetchLeagueTeams(leagueId: number, season: number): Promise<ApiFootballTeam[]> {
  const res = await apiFootballFetch<TeamEntry>('/teams', { league: leagueId, season })
  return res.response.map((t) => ({
    id: t.team.id,
    name: t.team.name,
    code: t.team.code,
    logo: t.team.logo,
    // La fuente devuelve 0 (no null) cuando no conoce la fundación de un club.
    // Un año 0 no es un dato: se normaliza a ausencia, igual que un string vacío.
    founded: t.team.founded ? t.team.founded : null,
    venueName: t.venue?.name ?? null,
    venueCity: t.venue?.city ?? null,
    venueCapacity: t.venue?.capacity ?? null,
    venueImage: t.venue?.image ?? null,
  }))
}

export async function fetchLeagueFixtures(leagueId: number, season: number): Promise<ApiFootballFixture[]> {
  const res = await apiFootballFetch<FixtureEntry>('/fixtures', { league: leagueId, season })
  return res.response.map((f) => ({
    id: f.fixture.id,
    date: f.fixture.date,
    statusShort: f.fixture.status.short,
    round: f.league.round,
    venueName: f.fixture.venue?.name ?? null,
    venueCity: f.fixture.venue?.city ?? null,
    homeId: f.teams.home.id,
    awayId: f.teams.away.id,
    homeGoals: f.goals.home,
    awayGoals: f.goals.away,
  }))
}

// ─── Validación de una liga (equipos + calendario) ───────────────────────────

export interface LeagueValidation {
  key: string
  name: string
  apiFootballId: number
  season: number
  teams: { count: number; sample: string[] }
  fixtures: {
    count: number
    firstDate: string | null
    lastDate: string | null
    byStatus: Record<string, number>
  }
}

export async function validateLeague(
  league: (typeof TARGET_LEAGUES)[number],
  season: number,
): Promise<LeagueValidation> {
  const teamsRes = await apiFootballFetch<TeamEntry>('/teams', { league: league.apiFootballId, season })
  const fixturesRes = await apiFootballFetch<FixtureEntry>('/fixtures', { league: league.apiFootballId, season })

  const dates = fixturesRes.response.map((f) => f.fixture.date).sort()
  const byStatus: Record<string, number> = {}
  for (const f of fixturesRes.response) {
    byStatus[f.fixture.status.short] = (byStatus[f.fixture.status.short] ?? 0) + 1
  }

  return {
    key: league.key,
    name: league.name,
    apiFootballId: league.apiFootballId,
    season,
    teams: {
      count: teamsRes.results,
      sample: teamsRes.response.slice(0, 5).map((t) => t.team.name),
    },
    fixtures: {
      count: fixturesRes.results,
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
      byStatus,
    },
  }
}

/**
 * Sonda de cobertura para una liga ARBITRARIA (no necesariamente de
 * TARGET_LEAGUES). Sirve para responder, antes de escribir una línea de
 * integración, la única pregunta que importa: ¿la fuente y el plan
 * contratado cubren esta liga en esta temporada? Data First — si la
 * respuesta es no, no se integra.
 */
export async function probeLeague(
  apiFootballId: number, season: number,
): Promise<LeagueValidation & { available: boolean }> {
  const v = await validateLeague(
    { key: `probe_${apiFootballId}`, apiFootballId, name: `liga ${apiFootballId}`, country: '?' } as any,
    season,
  )
  return { ...v, available: v.teams.count > 0 && v.fixtures.count > 0 }
}

// ─── Validación completa (lo que expone /api/sync/leagues) ───────────────────

export interface LeaguesValidationReport {
  ok: boolean
  account: AccountStatus
  season: number
  seasonNote: string
  leagues: LeagueValidation[]
  requestsUsed: number // requests de cuota consumidos por esta corrida
}

export async function validateLeaguesSetup(seasonOverride?: number): Promise<LeaguesValidationReport> {
  const effectiveSeason =
    seasonOverride && Number.isFinite(seasonOverride) && seasonOverride > 2000
      ? seasonOverride
      : DEFAULT_SEASON

  const account = await getAccountStatus() // gratis, no consume cuota
  const leagues: LeagueValidation[] = []
  for (const league of TARGET_LEAGUES) {
    leagues.push(await validateLeague(league, effectiveSeason))
  }

  return {
    ok: leagues.every((l) => l.teams.count > 0 && l.fixtures.count > 0),
    account,
    season: effectiveSeason,
    seasonNote: account.plan.toLowerCase().includes('free')
      ? 'Plan Free: solo temporadas 2022-2024. Para la 2026-27 en vivo se necesita upgrade.'
      : 'Plan de pago: temporada actual disponible.',
    leagues,
    requestsUsed: TARGET_LEAGUES.length * 2, // /teams + /fixtures por liga
  }
}

// ─── Estadísticas de partido (boxscore) ──────────────────────────────────────

/** Una estadística cruda tal como la devuelve la API: tipo + valor. */
interface StatisticEntry {
  team: { id: number; name: string }
  statistics: Array<{ type: string; value: number | string | null }>
}

/** Boxscore de un equipo en un partido, ya normalizado a nuestras columnas. */
export interface FixtureTeamStats {
  apiTeamId: number
  possession: number | null
  shots: number | null
  shots_on_target: number | null
  corners: number | null
  fouls: number | null
  yellow_cards: number | null
  red_cards: number | null
  offsides: number | null
  passes: number | null
  pass_accuracy: number | null
  xg: number | null
  saves: number | null
}

/**
 * Nombres que usa API-Football → nuestras columnas. Lo que la fuente NO
 * entrega (big_chances, big_chances_missed) se queda en NULL: Data First,
 * no se estima.
 */
const STAT_MAP: Record<string, keyof Omit<FixtureTeamStats, 'apiTeamId'>> = {
  'Ball Possession':  'possession',
  'Total Shots':      'shots',
  'Shots on Goal':    'shots_on_target',
  'Corner Kicks':     'corners',
  'Fouls':            'fouls',
  'Yellow Cards':     'yellow_cards',
  'Red Cards':        'red_cards',
  'Offsides':         'offsides',
  'Total passes':     'passes',
  'Passes %':         'pass_accuracy',
  'expected_goals':   'xg',
  'Goalkeeper Saves': 'saves',
}

/**
 * "52%" → 52 · "1.85" → 1.85 · null/""/"—" → null. Nunca devuelve NaN.
 *
 * El texto vacío se descarta ANTES de convertir: `Number('')` es 0, y un 0
 * guardado donde no hubo dato no es un vacío, es una mentira que además
 * arrastra las medias de equipo hacia abajo.
 */
function parseStatValue(raw: number | string | null): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const texto = raw.replace('%', '').trim()
  if (texto === '') return null
  const n = Number(texto)
  return Number.isFinite(n) ? n : null
}

/**
 * Boxscore de un partido: una entrada por equipo. Cuesta UNA petición de
 * cuota por partido — quien la llame debe acotar cuántos partidos procesa.
 */
export async function fetchFixtureStatistics(fixtureId: number): Promise<FixtureTeamStats[]> {
  const res = await apiFootballFetch<StatisticEntry>('/fixtures/statistics', { fixture: fixtureId })
  return res.response.map((entry) => {
    const out: FixtureTeamStats = {
      apiTeamId: entry.team.id,
      possession: null, shots: null, shots_on_target: null, corners: null,
      fouls: null, yellow_cards: null, red_cards: null, offsides: null,
      passes: null, pass_accuracy: null, xg: null, saves: null,
    }
    for (const s of entry.statistics ?? []) {
      const col = STAT_MAP[s.type]
      if (col) out[col] = parseStatValue(s.value)
    }
    return out
  })
}
