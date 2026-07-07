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
 * 2022-2024 — suficiente para validar; la temporada 2026-27 en vivo
 * requerirá upgrade de plan (~agosto).
 *
 * NOTA: SPORTS_API_SEASON y SPORTS_API_LEAGUE existen en Vercel como
 * restos de una configuración anterior con valores desconocidos; se
 * ignoran a propósito (la season por defecto rechazada el 2026-07-07
 * vino de ahí).
 */

// IDs oficiales de liga en API-Football. Decisión aprobada: opción A.
export const TARGET_LEAGUES = [
  { key: 'premier_league', apiFootballId: 39, name: 'Premier League', country: 'England' },
  { key: 'la_liga', apiFootballId: 140, name: 'La Liga', country: 'Spain' },
] as const

// Plan Free de API-Football: última temporada accesible (2022-2024).
const DEFAULT_SEASON = 2024

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

// ─── Validación de una liga (equipos + calendario) ───────────────────────────

interface TeamEntry { team: { id: number; name: string; code: string | null; logo: string } }
interface FixtureEntry {
  fixture: { id: number; date: string; status: { short: string } }
  teams: { home: { name: string }; away: { name: string } }
}

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
