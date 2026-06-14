import { createAdminClient } from '@/lib/supabase/admin'
import { resolveTeamCode } from '@/lib/teamMapping'
import { buildValueBet, isStrongValueBet, type OddsMarket } from '@/lib/valueBets'

const COMPETITION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

/**
 * Sync de cuotas desde The Odds API.
 * Jala cuotas (1X2, totales, BTTS), las inserta en `odds` y genera/actualiza
 * `value_bets` comparando contra la probabilidad del modelo. Registra en sync_logs.
 *
 * Env: ODDS_API_KEY (obligatoria), ODDS_API_SPORT (opcional, def soccer_fifa_world_cup)
 */

interface OddsApiOutcome { name: string; price: number; point?: number }
interface OddsApiMarket { key: string; outcomes: OddsApiOutcome[] }
interface OddsApiBookmaker { key: string; title: string; markets: OddsApiMarket[] }
interface OddsApiEvent {
  id: string; commence_time: string
  home_team: string; away_team: string
  bookmakers: OddsApiBookmaker[]
}

/** Mapea un outcome de The Odds API -> nuestro enum odds_market (o null si se ignora). */
function mapOutcomeToMarket(
  marketKey: string, outcome: OddsApiOutcome,
  homeTeam: string, awayTeam: string,
): OddsMarket | null {
  if (marketKey === 'h2h') {
    if (outcome.name === homeTeam) return 'home_win'
    if (outcome.name === awayTeam) return 'away_win'
    if (/draw/i.test(outcome.name)) return 'draw'
    return null
  }
  if (marketKey === 'totals' && /over/i.test(outcome.name)) {
    if (outcome.point === 0.5) return 'over_0_5'
    if (outcome.point === 1.5) return 'over_1_5'
    if (outcome.point === 2.5) return 'over_2_5'
    if (outcome.point === 3.5) return 'over_3_5'
    return null
  }
  if (marketKey === 'btts') {
    if (/yes/i.test(outcome.name)) return 'btts_yes'
    if (/no/i.test(outcome.name)) return 'btts_no'
  }
  return null
}

export async function syncOdds(): Promise<{
  ok: boolean; events: number; oddsRecorded: number; valueBets: number; unmatched: string[]
}> {
  const started = Date.now()
  const supabase = createAdminClient()
  const apiKey = process.env.ODDS_API_KEY
  const sport = process.env.ODDS_API_SPORT || 'soccer_fifa_world_cup'
  if (!apiKey) throw new Error('Falta ODDS_API_KEY en el entorno.')

  // Index de partidos por par de codigos -> { matchId, prediction }
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('id, home_team:teams!matches_home_team_id_fkey(code), away_team:teams!matches_away_team_id_fkey(code), predictions(id, home_win_probability, draw_probability, away_win_probability, predicted_home_score, predicted_away_score)')
    .eq('competition_id', COMPETITION_ID)
  if (mErr) throw mErr

  const byPair = new Map<string, { matchId: string; prediction: any }>()
  for (const m of (matches ?? []) as any[]) {
    const hc = m.home_team?.code, ac = m.away_team?.code
    if (hc && ac) byPair.set(`${hc}|${ac}`, {
      matchId: m.id,
      prediction: Array.isArray(m.predictions) ? m.predictions[0] : m.predictions,
    })
  }

  // Fetch The Odds API
  // The Odds API solo soporta h2h y totals en este endpoint (btts no es valido).
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=eu&markets=h2h,totals&oddsFormat=decimal`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`The Odds API ${res.status}: ${await res.text()}`)
  const events = (await res.json()) as OddsApiEvent[]

  const now = new Date().toISOString()
  const oddsRows: any[] = []
  const valueBetRows: any[] = []
  const unmatched: string[] = []

  for (const ev of events) {
    const homeCode = resolveTeamCode(ev.home_team)
    const awayCode = resolveTeamCode(ev.away_team)
    const match = homeCode && awayCode ? byPair.get(`${homeCode}|${awayCode}`) : undefined
    if (!match) { unmatched.push(`${ev.home_team} vs ${ev.away_team}`); continue }
    if (!match.prediction) continue

    // mejor cuota por (bookmaker, mercado): usamos cada bookmaker tal cual
    for (const bk of ev.bookmakers ?? []) {
      for (const mk of bk.markets ?? []) {
        for (const out of mk.outcomes ?? []) {
          const market = mapOutcomeToMarket(mk.key, out, ev.home_team, ev.away_team)
          if (!market || !out.price || out.price <= 1) continue

          oddsRows.push({
            match_id: match.matchId, bookmaker: bk.title, market,
            odds_value: out.price, implied_probability: 1 / out.price, recorded_at: now,
          })

          const vb = buildValueBet(market, out.price, match.prediction)
          if (isStrongValueBet(vb)) {
            valueBetRows.push({
              match_id: match.matchId, prediction_id: match.prediction.id,
              bookmaker: bk.title, ...vb, is_active: true, result: 'pending',
            })
          }
        }
      }
    }
  }

  if (oddsRows.length) {
    const { error } = await supabase.from('odds').insert(oddsRows)
    if (error) throw error
  }

  // Regeneracion limpia: borra los value bets previos de estos partidos para
  // no acumular ruido viejo, luego inserta solo los que pasan el filtro.
  const matchIds = Array.from(byPair.values()).map((v) => v.matchId)
  if (matchIds.length) {
    const { error } = await supabase.from('value_bets').delete().in('match_id', matchIds)
    if (error) throw error
  }
  if (valueBetRows.length) {
    const { error } = await supabase
      .from('value_bets')
      .upsert(valueBetRows, { onConflict: 'match_id,market,bookmaker', ignoreDuplicates: false })
    if (error) throw error
  }

  await supabase.from('sync_logs').insert({
    source: 'the_odds_api', entity_type: 'odds', status: 'success',
    records_processed: oddsRows.length, records_failed: 0,
    metadata: { events: events.length, value_bets: valueBetRows.length, unmatched },
    duration_ms: Date.now() - started,
  })

  return { ok: true, events: events.length, oddsRecorded: oddsRows.length, valueBets: valueBetRows.length, unmatched }
}
