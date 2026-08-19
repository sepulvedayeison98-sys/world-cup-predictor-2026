import { createAdminClient } from '@/lib/supabase/admin'
import { calibrateLibertadores } from './league-calibrate'
import { LIBERTADORES_COMPETITION_ID } from '@/lib/constants'
import {
  fetchScoreboard, buildDates, mapStatus, parseScore,
  type ESPNEvent, type MatchStatus,
} from './espn-results'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/conmebol.libertadores'

/**
 * ESPN abreviatura → api_football_id, verificado a mano el 2026-08-19
 * cruzando GET .../conmebol.libertadores/teams (43 clubes, incluye los ya
 * eliminados en fases de clasificación) contra los 32 equipos reales de
 * nuestra BD (libertadores-ingest.ts). Necesario porque la abreviatura de
 * ESPN para clubes NO es el código FIFA de 3 letras que usa espn-results.ts
 * para selecciones — ejemplos reales: "CDUC" (4 letras, Universidad
 * Católica) y "CAR" repetido entre dos clubes distintos (Always Ready y
 * Carabobo; Carabobo no juega esta Libertadores, así que no colisiona aquí).
 */
const ESPN_ABBR_TO_API_FOOTBALL_ID: Record<string, number> = {
  CAR: 3700,   // Always Ready
  BAR: 1152,   // Barcelona SC
  CABJ: 451,   // Boca Juniors
  BOL: 3702,   // Bolívar
  CPT: 1176,   // Cerro Porteño
  COQ: 2330,   // Coquimbo Unido
  COR: 131,    // Corinthians
  CRU: 135,    // Cruzeiro
  CFC: 10013,  // Cusco FC
  TOL: 1142,   // Deportes Tolima
  LGA: 2813,   // Deportivo La Guaira
  EST: 450,    // Estudiantes de La Plata
  FLA: 127,    // Flamengo
  FLU: 124,    // Fluminense
  DIM: 1128,   // Independiente Medellín
  RIV: 473,    // Independiente Rivadavia
  SFE: 1139,   // Independiente Santa Fe
  IDV: 1153,   // Independiente del Valle
  LAN: 446,    // Lanús
  LDU: 1158,   // Liga de Quito
  LIB: 1179,   // Libertad
  MIR: 7848,   // Mirassol
  NAC: 2356,   // Nacional
  PAL: 121,    // Palmeiras
  PEN: 2348,   // Peñarol
  PLA: 1064,   // Platense
  ROS: 437,    // Rosario Central
  SCR: 2546,   // Sporting Cristal
  CDUC: 2994,  // Universidad Católica
  UCV: 2840,   // UCV FC
  UNI: 2540,   // Universitario
  JUN: 1135,   // Atlético Junior
}

/**
 * Sincroniza resultados y estado de partidos de Copa Libertadores desde
 * ESPN (gratuita, sin cuota) — mismo patrón que syncESPNResults() para el
 * Mundial, pero el matching es por api_football_id (vía la tabla de arriba)
 * en vez de código FIFA de 3 letras, porque las abreviaturas de ESPN para
 * clubes no siguen ese formato.
 *
 * Al terminar un partido: recalcula la tabla del grupo si aplica y dispara
 * calibrateLibertadores() (ELO + estadísticas + predicciones) — la misma
 * cadena que corre en el cron diario, pero ahora también en cuanto ESPN
 * confirma el resultado, no solo una vez al día.
 */
export async function syncESPNResultsLibertadores(): Promise<{
  ok: boolean; source: string; events: number; updated: number; unmatched: string[]
  calibrated: boolean
}> {
  const started = Date.now()
  const supabase = createAdminClient()

  const dates = buildDates()
  const allEvents: ESPNEvent[] = (await Promise.all(dates.map((d) => fetchScoreboard(ESPN_BASE, d)))).flat()

  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select(`
      id, status, home_score, away_score, group_id, kickoff_time,
      home_team:teams!matches_home_team_id_fkey(api_football_id),
      away_team:teams!matches_away_team_id_fkey(api_football_id)
    `)
    .eq('competition_id', LIBERTADORES_COMPETITION_ID)
  if (mErr) throw mErr

  const byPair = new Map<string, any>()
  for (const m of (matches ?? [])) {
    const hid = m.home_team?.api_football_id
    const aid = m.away_team?.api_football_id
    if (hid && aid) byPair.set(`${hid}|${aid}`, m)
  }

  let updated = 0
  const unmatched: string[] = []
  const finishedGroupIds = new Set<string>()
  let anyFinishedTransition = false

  for (const event of allEvents) {
    const comp = event.competitions?.[0]
    if (!comp) continue

    const homeComp = comp.competitors.find((c) => c.homeAway === 'home')
    const awayComp = comp.competitors.find((c) => c.homeAway === 'away')
    if (!homeComp || !awayComp) continue

    const homeId = ESPN_ABBR_TO_API_FOOTBALL_ID[(homeComp.team.abbreviation ?? '').toUpperCase()]
    const awayId = ESPN_ABBR_TO_API_FOOTBALL_ID[(awayComp.team.abbreviation ?? '').toUpperCase()]
    const match = homeId && awayId ? byPair.get(`${homeId}|${awayId}`) : null
    if (!match) {
      unmatched.push(`${homeComp.team.displayName} vs ${awayComp.team.displayName}`)
      continue
    }

    const statusType = comp.status?.type
    if (!statusType) continue

    const status: MatchStatus = mapStatus(statusType)
    const homeScore = parseScore(homeComp.score, status)
    const awayScore = parseScore(awayComp.score, status)

    // Penales: decisivos en octavos/cuartos/semis a doble partido.
    const enriched: Record<string, any> = {}
    const homePens = parseScore(String(homeComp.shootoutScore ?? ''), status)
    const awayPens = parseScore(String(awayComp.shootoutScore ?? ''), status)
    if (homePens != null && awayPens != null && homePens !== awayPens) {
      enriched.home_penalties = homePens
      enriched.away_penalties = awayPens
    }

    const scoreChanged = match.status !== status || match.home_score !== homeScore || match.away_score !== awayScore
    if (scoreChanged || Object.keys(enriched).length > 0) {
      const { error } = await supabase
        .from('matches')
        .update({ status, home_score: homeScore, away_score: awayScore, ...enriched })
        .eq('id', match.id)
      if (error) throw error
      updated++
    }

    if (status === 'finished' && match.status !== 'finished') {
      anyFinishedTransition = true
      if (match.group_id) finishedGroupIds.add(match.group_id)
    }
  }

  for (const groupId of finishedGroupIds) {
    await supabase.rpc('recalculate_group_standings', { p_group_id: groupId })
  }

  let calibrated = false
  if (anyFinishedTransition) {
    try {
      await calibrateLibertadores()
      calibrated = true
    } catch (err) {
      console.error('[syncESPNResultsLibertadores] calibración falló:', err)
    }
  }

  await supabase.from('sync_logs').insert({
    source: 'espn_api',
    entity_type: 'libertadores_matches',
    status: 'success',
    records_processed: updated,
    records_failed: 0,
    metadata: JSON.parse(JSON.stringify({ events: allEvents.length, dates, unmatched, calibrated })),
    duration_ms: Date.now() - started,
  })

  return { ok: true, source: 'espn', events: allEvents.length, updated, unmatched, calibrated }
}
