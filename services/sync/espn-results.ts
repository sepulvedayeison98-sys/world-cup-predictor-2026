import { createAdminClient } from '@/lib/supabase/admin'
import { resolveTeamCode } from '@/lib/teamMapping'
import { syncESPNMatchStats } from './espn-stats'
import { COMPETITION_ID } from '@/lib/constants'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world'

type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'

// Algunas abreviaturas de ESPN difieren del código FIFA de 3 letras
const ESPN_ABBR_OVERRIDES: Record<string, string> = {
  'IRI': 'IRN',   // Iran: ESPN usa IRI, FIFA usa IRN
  'DRC': 'COD',   // RD Congo: ESPN usa DRC, FIFA usa COD
  'BOS': 'BIH',   // Bosnia: ESPN usa BOS, FIFA usa BIH
  'CRC': 'CRC',   // Costa Rica (igual, pero por si acaso)
  'RSA': 'RSA',   // Sudáfrica
  'CPV': 'CPV',   // Cabo Verde
}

interface ESPNTeam {
  abbreviation: string
  displayName: string
  shortDisplayName?: string
}

interface ESPNCompetitor {
  homeAway: 'home' | 'away'
  team: ESPNTeam
  score?: string
}

interface ESPNStatusType {
  name: string      // STATUS_FINAL, STATUS_IN_PROGRESS, STATUS_SCHEDULED, STATUS_POSTPONED
  state: string     // pre | in | post
  completed: boolean
  description: string
  detail?: string
}

interface ESPNCompetition {
  id: string
  date: string
  attendance?: number
  venue?: {
    fullName: string
    address: { city: string; state?: string; country?: string }
  }
  competitors: ESPNCompetitor[]
  status: { type: ESPNStatusType; displayClock?: string; period?: number }
  officials?: Array<{ displayName: string; position?: { name: string } }>
}

interface ESPNEvent {
  id: string
  date: string
  name: string
  competitions: ESPNCompetition[]
}

function resolveCode(team: ESPNTeam): string | null {
  const abbr = (team.abbreviation ?? '').toUpperCase()
  if (ESPN_ABBR_OVERRIDES[abbr]) return ESPN_ABBR_OVERRIDES[abbr]
  // Si la abreviatura tiene 3 letras, usarla directamente (suele coincidir con FIFA)
  if (abbr.length === 3) return abbr
  // Fallback por nombre en inglés
  return resolveTeamCode(team.displayName) ?? resolveTeamCode(team.shortDisplayName ?? '')
}

function mapStatus(type: ESPNStatusType): MatchStatus {
  if (type.completed || type.state === 'post') return 'finished'
  if (type.state === 'in') return 'live'
  if (type.name.includes('POSTPONED') || type.name.includes('SUSPENDED')) return 'postponed'
  if (type.name.includes('CANCELLED') || type.name.includes('ABANDONED')) return 'cancelled'
  return 'scheduled'
}

function parseScore(s: string | undefined, status: MatchStatus): number | null {
  if (status === 'scheduled') return null
  const v = parseInt(s ?? '', 10)
  return Number.isNaN(v) ? null : v
}

/** Genera un array de fechas YYYYMMDD para ESPN: ayer, hoy, mañana */
function buildDates(): string[] {
  const now = new Date()
  return [-1, 0, 1].map(offset => {
    const d = new Date(now)
    d.setDate(d.getDate() + offset)
    return d.toISOString().slice(0, 10).replace(/-/g, '')
  })
}

async function fetchScoreboard(dateStr: string): Promise<ESPNEvent[]> {
  const url = `${ESPN_BASE}/scoreboard?dates=${dateStr}&limit=50`
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'WorldCupPredictor/1.0 (+https://github.com/sepulvedayeison98-sys/world-cup-predictor-2026)' },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.events ?? []) as ESPNEvent[]
  } catch {
    return []
  }
}

/**
 * Sincroniza resultados y estado de partidos desde la ESPN API (gratuita).
 * Actualiza: status, home_score, away_score, venue, city, attendance, referee.
 * El trigger match_standings_update recalcula standings cuando pasa a 'finished'.
 */
export async function syncESPNResults(): Promise<{
  ok: boolean; source: string; events: number; updated: number; unmatched: string[]
}> {
  const started = Date.now()
  const supabase = createAdminClient()

  // Traer partidos de ayer, hoy y mañana en paralelo
  const dates = buildDates()
  const allEvents = (await Promise.all(dates.map(fetchScoreboard))).flat()

  // Índice de partidos de la BD por par de códigos
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select(`
      id, status, home_score, away_score, venue, city, attendance, referee,
      home_team_id, away_team_id,
      home_team:teams!matches_home_team_id_fkey(code),
      away_team:teams!matches_away_team_id_fkey(code)
    `)
    .eq('competition_id', COMPETITION_ID)
  if (mErr) throw mErr

  const byPair = new Map<string, any>()
  for (const m of (matches ?? [])) {
    const hc = m.home_team?.code
    const ac = m.away_team?.code
    if (hc && ac) byPair.set(`${hc}|${ac}`, m)
  }

  let updated = 0
  const unmatched: string[] = []
  const statsPromises: Promise<void>[] = []

  for (const event of allEvents) {
    const comp = event.competitions?.[0]
    if (!comp) continue

    const homeComp = comp.competitors.find(c => c.homeAway === 'home')
    const awayComp = comp.competitors.find(c => c.homeAway === 'away')
    if (!homeComp || !awayComp) continue

    const homeCode = resolveCode(homeComp.team)
    const awayCode = resolveCode(awayComp.team)
    const match = homeCode && awayCode ? byPair.get(`${homeCode}|${awayCode}`) : null
    if (!match) {
      unmatched.push(`${homeComp.team.displayName} vs ${awayComp.team.displayName}`)
      continue
    }

    const statusType = comp.status?.type
    if (!statusType) continue

    const status = mapStatus(statusType)
    const homeScore = parseScore(homeComp.score, status)
    const awayScore = parseScore(awayComp.score, status)

    // Datos enriquecidos que ESPN provee y The Odds API no
    const enriched: Record<string, any> = {}
    if (comp.venue?.fullName && !match.venue) {
      enriched.venue = comp.venue.fullName
    }
    if (comp.venue?.address?.city && !match.city) {
      enriched.city = comp.venue.address.city
    }
    if (comp.attendance && !match.attendance) {
      enriched.attendance = comp.attendance
    }
    const referee = comp.officials?.find(o =>
      o.position?.name?.toLowerCase().includes('referee') ||
      !o.position?.name
    )?.displayName
    if (referee && !match.referee) {
      enriched.referee = referee
    }

    // Solo escribir si algo cambió
    const scoreChanged = match.status !== status || match.home_score !== homeScore || match.away_score !== awayScore
    if (scoreChanged || Object.keys(enriched).length > 0) {
      const { error } = await supabase
        .from('matches')
        .update({ status, home_score: homeScore, away_score: awayScore, ...enriched })
        .eq('id', match.id)
      if (error) throw error
      updated++
    }

    // Para partidos terminados, sincronizar estadísticas desde el summary endpoint
    if (status === 'finished') {
      statsPromises.push(
        syncESPNMatchStats(event.id, match.id, match.home_team_id, match.away_team_id)
          .then(() => undefined)
          .catch(() => undefined)
      )
    }
  }

  // Esperar estadísticas en paralelo (no bloquea si fallan)
  await Promise.allSettled(statsPromises)

  await supabase.from('sync_logs').insert({
    source: 'espn_api',
    entity_type: 'matches',
    status: 'success',
    records_processed: updated,
    records_failed: 0,
    metadata: { events: allEvents.length, dates, unmatched },
    duration_ms: Date.now() - started,
  })

  return { ok: true, source: 'espn', events: allEvents.length, updated, unmatched }
}
