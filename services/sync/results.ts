import { createAdminClient } from '@/lib/supabase/admin'
import { resolveTeamCode } from '@/lib/teamMapping'
import { COMPETITION_ID } from '@/lib/constants'


/**
 * Sync de resultados/estado desde The Odds API (endpoint /scores).
 *
 * Se usa The Odds API en vez de API-Football porque el plan gratuito de
 * API-Football no da acceso a la temporada 2026. /scores cubre el Mundial,
 * trae marcadores en vivo y juegos completados de los ultimos `daysFrom` dias.
 *
 * Actualiza home_score, away_score y status. El trigger `match_standings_update`
 * recalcula los standings al pasar un partido a 'finished'.
 *
 * Env: ODDS_API_KEY (obligatoria), ODDS_API_SPORT (def soccer_fifa_world_cup)
 */

type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'

interface ScoresEntry { name: string; score: string }
interface ScoresEvent {
  id: string; commence_time: string; completed: boolean
  home_team: string; away_team: string
  scores: ScoresEntry[] | null
}

export async function syncResults(): Promise<{
  ok: boolean; events: number; updated: number; unmatched: string[]
}> {
  const started = Date.now()
  const supabase = createAdminClient()
  const apiKey = process.env.ODDS_API_KEY
  const sport = process.env.ODDS_API_SPORT || 'soccer_fifa_world_cup'
  if (!apiKey) throw new Error('Falta ODDS_API_KEY en el entorno.')

  // Index de partidos por par de codigos -> fila actual (para detectar cambios)
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('id, status, home_score, away_score, home_team:teams!matches_home_team_id_fkey(code), away_team:teams!matches_away_team_id_fkey(code)')
    .eq('competition_id', COMPETITION_ID)
  if (mErr) throw mErr

  const byPair = new Map<string, any>()
  for (const m of (matches ?? []) as any[]) {
    const hc = m.home_team?.code, ac = m.away_team?.code
    if (hc && ac) byPair.set(`${hc}|${ac}`, m)
  }

  // Fetch The Odds API /scores (incluye completados de los ultimos 3 dias)
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${apiKey}&daysFrom=3`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`The Odds API /scores ${res.status}: ${await res.text()}`)
  const events = (await res.json()) as ScoresEvent[]

  let updated = 0
  const unmatched: string[] = []

  for (const ev of events) {
    const homeCode = resolveTeamCode(ev.home_team)
    const awayCode = resolveTeamCode(ev.away_team)
    const match = homeCode && awayCode ? byPair.get(`${homeCode}|${awayCode}`) : undefined
    if (!match) { unmatched.push(`${ev.home_team} vs ${ev.away_team}`); continue }

    // Estado: completado -> finished; con marcadores y sin completar -> live; resto -> scheduled
    const status: MatchStatus = ev.completed ? 'finished' : (ev.scores ? 'live' : 'scheduled')

    let hs: number | null = null
    let as: number | null = null
    if (ev.scores) {
      for (const s of ev.scores) {
        const v = parseInt(s.score, 10)
        if (s.name === ev.home_team) hs = Number.isNaN(v) ? null : v
        else if (s.name === ev.away_team) as = Number.isNaN(v) ? null : v
      }
    }

    // Solo actualizar si algo cambio (evita writes y disparos de trigger inutiles)
    if (match.status === status && match.home_score === hs && match.away_score === as) continue

    const { error } = await supabase
      .from('matches')
      .update({ status, home_score: hs, away_score: as })
      .eq('id', match.id)
    if (error) throw error
    updated++
  }

  await supabase.from('sync_logs').insert({
    source: 'the_odds_api', entity_type: 'matches', status: 'success',
    records_processed: updated, records_failed: 0,
    metadata: { events: events.length, unmatched },
    duration_ms: Date.now() - started,
  })

  return { ok: true, events: events.length, updated, unmatched }
}
