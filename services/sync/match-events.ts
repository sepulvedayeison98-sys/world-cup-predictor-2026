/**
 * Eventos de partido bajo demanda (línea de tiempo).
 *
 * Estrategia de cuota: los eventos de un partido se piden a API-Football
 * UNA sola vez (la primera visita al detalle) y quedan cacheados para
 * siempre en match_events. Throttle diario para proteger el plan Free
 * (100 requests/día compartidos con la ingesta de calendario).
 *
 * Partidos sin api_football_id (Mundial, amistosos): devuelve lo que
 * haya en BD (hoy vacío — la fuente ESPN llegará en otra iteración).
 */
import { createAdminClient } from '@/lib/supabase/admin'

const DAILY_EVENT_FETCH_LIMIT = 50 // margen: deja 50 req/día para el resto

interface ApiFootballEvent {
  time: { elapsed: number; extra: number | null }
  team: { id: number }
  player: { name: string | null }
  assist: { name: string | null }
  type: string   // 'Goal' | 'Card' | 'subst' | 'Var'
  detail: string // 'Normal Goal' | 'Own Goal' | 'Penalty' | 'Yellow Card' | ...
}

/** Mapea (type, detail) de API-Football → nuestro enum de eventos. */
function mapEventType(type: string, detail: string): string | null {
  const d = detail.toLowerCase()
  if (type === 'Goal') {
    if (d.includes('own')) return 'own_goal'
    if (d.includes('penalty')) return d.includes('missed') ? 'missed_penalty' : 'penalty_goal'
    return 'goal'
  }
  if (type === 'Card') {
    if (d.includes('yellow') && !d.includes('second')) return 'yellow_card'
    return 'red_card' // roja directa o segunda amarilla
  }
  if (type === 'subst') return 'substitution'
  if (type === 'Var') return 'var'
  return null
}

export interface MatchEventRow {
  id: string
  team_id: string | null
  minute: number | null
  minute_extra: number | null
  type: string
  player_name: string | null
  assist_name: string | null
  detail: string | null
}

export async function ensureMatchEvents(matchId: string): Promise<{
  events: MatchEventRow[]
  source: 'cache' | 'api_football' | 'none'
}> {
  const supabase = createAdminClient()

  // 1. Caché permanente en BD
  const { data: cached } = await supabase
    .from('match_events')
    .select('id, team_id, minute, minute_extra, type, player_name, assist_name, detail')
    .eq('match_id', matchId)
    .order('minute', { ascending: true })
    .order('minute_extra', { ascending: true })
  if (cached?.length) return { events: cached as MatchEventRow[], source: 'cache' }

  // 2. ¿El partido tiene fuente y estado ingestable?
  const { data: match } = await supabase
    .from('matches')
    .select('id, api_football_id, status, competition_id')
    .eq('id', matchId)
    .maybeSingle()
  const m = match as any
  if (!m?.api_football_id || !['finished', 'live'].includes(m.status)) {
    return { events: [], source: 'none' }
  }

  // 3. Throttle diario (protege la cuota del plan Free)
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { count: fetchesToday } = await supabase
    .from('sync_logs')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'api_football')
    .eq('entity_type', 'match_events')
    .gte('created_at', dayAgo)
  if ((fetchesToday ?? 0) >= DAILY_EVENT_FETCH_LIMIT) {
    return { events: [], source: 'none' }
  }

  // 4. Ingesta única desde API-Football
  const key = process.env.SPORTS_API_KEY
  if (!key) return { events: [], source: 'none' }
  const host = process.env.SPORTS_API_HOST || 'v3.football.api-sports.io'
  const res = await fetch(`https://${host}/fixtures/events?fixture=${m.api_football_id}`, {
    headers: host.includes('rapidapi')
      ? { 'x-rapidapi-key': key, 'x-rapidapi-host': host }
      : { 'x-apisports-key': key },
    cache: 'no-store',
  })
  if (!res.ok) return { events: [], source: 'none' }
  const body = await res.json()
  const raw = (body?.response ?? []) as ApiFootballEvent[]

  // Mapa api_football_id → uuid de nuestros equipos (misma competición)
  const { data: teams } = await supabase
    .from('teams')
    .select('id, api_football_id')
    .eq('competition_id', m.competition_id)
  const teamUuid = new Map((teams ?? []).map((t: any) => [t.api_football_id, t.id]))

  const rows = raw
    .map((e) => {
      const type = mapEventType(e.type, e.detail ?? '')
      if (!type) return null
      return {
        match_id: matchId,
        team_id: teamUuid.get(e.team?.id) ?? null,
        minute: e.time?.elapsed ?? null,
        minute_extra: e.time?.extra ?? null,
        type,
        player_name: e.player?.name ?? null,
        assist_name: e.assist?.name ?? null,
        detail: e.detail ?? null,
        source: 'api_football',
      }
    })
    .filter(Boolean)

  if (rows.length > 0) {
    const { error } = await (supabase.from('match_events') as any).insert(rows)
    if (error) console.error('[match-events] insert:', error.message)
  }

  // Registro de la corrida (alimenta el throttle)
  await (supabase.from('sync_logs') as any).insert({
    source: 'api_football',
    entity_type: 'match_events',
    status: 'success',
    records_processed: rows.length,
    records_failed: 0,
    metadata: { match_id: matchId, fixture: m.api_football_id },
  })

  const { data: fresh } = await supabase
    .from('match_events')
    .select('id, team_id, minute, minute_extra, type, player_name, assist_name, detail')
    .eq('match_id', matchId)
    .order('minute', { ascending: true })
    .order('minute_extra', { ascending: true })
  return { events: (fresh ?? []) as MatchEventRow[], source: 'api_football' }
}
