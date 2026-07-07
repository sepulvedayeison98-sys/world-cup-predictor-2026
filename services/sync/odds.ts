import { createAdminClient } from '@/lib/supabase/admin'
import { resolveTeamCode } from '@/lib/teamMapping'
import { buildValueBet, isStrongValueBet, type OddsMarket } from '@/lib/valueBets'
import { COMPETITION_ID } from '@/lib/constants'


/**
 * Overround típico de Pinnacle por tipo de mercado.
 * Pinnacle opera con ~2-3% de margen, el más bajo del mercado.
 * Dividir la prob. implícita por este valor da la prob. justa real.
 */
const PINNACLE_OR: Record<'3way' | '2way', number> = {
  '3way': 1.026,  // 1x2: ~2.6%
  '2way': 1.030,  // Over/Under, BTTS: ~3%
}

/**
 * Márgenes de cada casa colombiana sobre la prob. justa (sin overround).
 * Basados en análisis de precios reales de cada operador.
 */
const CO_MARGINS: Record<string, Record<'3way' | '2way', number>> = {
  Betplay: { '3way': 0.075, '2way': 0.090 },
  Wplay:   { '3way': 0.065, '2way': 0.080 },
  Betson:  { '3way': 0.085, '2way': 0.095 },
}

const CO_BOOKMAKERS = Object.keys(CO_MARGINS)

function marketType(m: OddsMarket): '3way' | '2way' {
  return ['home_win', 'draw', 'away_win'].includes(m) ? '3way' : '2way'
}

// ─── Tipos de The Odds API ────────────────────────────────────────────────────

interface OddsApiOutcome  { name: string; price: number; point?: number }
interface OddsApiMarket   { key: string; outcomes: OddsApiOutcome[] }
interface OddsApiBookmaker{ key: string; title: string; markets: OddsApiMarket[] }
interface OddsApiEvent {
  id: string; commence_time: string
  home_team: string; away_team: string
  bookmakers: OddsApiBookmaker[]
}

/** Mapea outcome de The Odds API → nuestro enum odds_market. */
function mapToMarket(
  marketKey: string,
  outcome: OddsApiOutcome,
  homeTeam: string,
  awayTeam: string,
): OddsMarket | null {
  if (marketKey === 'h2h') {
    if (outcome.name === homeTeam) return 'home_win'
    if (outcome.name === awayTeam) return 'away_win'
    if (/draw/i.test(outcome.name)) return 'draw'
    return null
  }
  if (marketKey === 'totals' && /over/i.test(outcome.name)) {
    const p = outcome.point
    if (p === 0.5) return 'over_0_5'
    if (p === 1.5) return 'over_1_5'
    if (p === 2.5) return 'over_2_5'
    if (p === 3.5) return 'over_3_5'
    return null
  }
  if (marketKey === 'btts') {
    if (/yes/i.test(outcome.name)) return 'btts_yes'
    if (/no/i.test(outcome.name))  return 'btts_no'
  }
  return null
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function syncOdds(): Promise<{
  ok: boolean; events: number; oddsRecorded: number; valueBets: number; unmatched: string[]
}> {
  const started  = Date.now()
  const supabase = createAdminClient()
  const apiKey   = process.env.ODDS_API_KEY
  const sport    = process.env.ODDS_API_SPORT || 'soccer_fifa_world_cup'
  if (!apiKey) throw new Error('Falta ODDS_API_KEY en el entorno.')

  // ── Cargar partidos de la BD ─────────────────────────────────────────────────
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select(`
      id,
      home_team:teams!matches_home_team_id_fkey(code),
      away_team:teams!matches_away_team_id_fkey(code),
      predictions(id, home_win_probability, draw_probability, away_win_probability,
                  predicted_home_score, predicted_away_score)
    `)
    .eq('competition_id', COMPETITION_ID)
  if (mErr) throw mErr

  const byPair = new Map<string, { matchId: string; prediction: any }>()
  for (const m of (matches ?? [])) {
    const hc = m.home_team?.code, ac = m.away_team?.code
    if (hc && ac) byPair.set(`${hc}|${ac}`, {
      matchId: m.id,
      prediction: Array.isArray(m.predictions) ? m.predictions[0] : m.predictions,
    })
  }

  // ── Fetch Pinnacle desde The Odds API ────────────────────────────────────────
  // bookmakers=pinnacle: solo pide Pinnacle para conservar créditos de la API.
  const url = [
    `https://api.the-odds-api.com/v4/sports/${sport}/odds`,
    `?apiKey=${apiKey}`,
    `&regions=eu`,
    // btts no está soportado en el endpoint masivo /odds de The Odds API
    // (solo por evento individual) — pedirlo devuelve 422 INVALID_MARKET.
    `&markets=h2h,totals`,
    `&bookmakers=pinnacle`,
    `&oddsFormat=decimal`,
  ].join('')

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`The Odds API ${res.status}: ${await res.text()}`)
  const events = (await res.json()) as OddsApiEvent[]

  const now          = new Date().toISOString()
  const oddsRows:     any[] = []
  const valueBetRows: any[] = []
  const unmatched:    string[] = []
  const affectedMatchIds = new Set<string>()

  for (const ev of events) {
    const homeCode = resolveTeamCode(ev.home_team)
    const awayCode = resolveTeamCode(ev.away_team)
    const match    = homeCode && awayCode ? byPair.get(`${homeCode}|${awayCode}`) : undefined
    if (!match) { unmatched.push(`${ev.home_team} vs ${ev.away_team}`); continue }

    const pinnacle = ev.bookmakers.find(bk => bk.key === 'pinnacle')
    if (!pinnacle) continue

    // Recopilar cuotas de Pinnacle como {market → impliedProb}
    const pinnacleMap = new Map<OddsMarket, number>()
    for (const mk of pinnacle.markets) {
      for (const out of mk.outcomes) {
        const market = mapToMarket(mk.key, out, ev.home_team, ev.away_team)
        if (!market || !out.price || out.price <= 1) continue
        pinnacleMap.set(market, 1 / out.price)
      }
    }
    if (pinnacleMap.size === 0) continue
    affectedMatchIds.add(match.matchId)

    for (const [market, impliedProb] of pinnacleMap) {
      const mType    = marketType(market)
      const pOR      = PINNACLE_OR[mType]
      const fairProb = impliedProb / pOR  // quitar margen de Pinnacle → prob. justa

      // 1. Guardar cuota real de Pinnacle
      oddsRows.push({
        match_id: match.matchId,
        source: 'the_odds_api',
        bookmaker: 'Pinnacle',
        market,
        odds_value:          Math.round((1 / impliedProb) * 100) / 100,
        implied_probability: Math.round(impliedProb  * 10000) / 10000,
        margin:              Math.round((pOR - 1)    * 10000) / 10000,
        recorded_at: now,
      })

      // 2. Derivar cuotas colombianas a partir de la prob. justa de Pinnacle
      for (const [bk, margins] of Object.entries(CO_MARGINS)) {
        const coMargin   = margins[mType]
        const coImplied  = fairProb * (1 + coMargin)
        if (coImplied >= 1) continue
        const coOdd = Math.round((1 / coImplied) * 100) / 100
        if (coOdd <= 1.05) continue

        oddsRows.push({
          match_id: match.matchId,
          source: 'derived_pinnacle',
          bookmaker: bk,
          market,
          odds_value:          coOdd,
          implied_probability: Math.round(coImplied * 10000) / 10000,
          margin:              Math.round(coMargin  * 10000) / 10000,
          recorded_at: now,
        })
      }

      // 3. Value bets: comparar prob. justa de Pinnacle vs modelo
      if (match.prediction) {
        const pinnacleOdd = Math.round((1 / impliedProb) * 100) / 100
        const vb = buildValueBet(market, pinnacleOdd, match.prediction)
        if (isStrongValueBet(vb)) {
          valueBetRows.push({
            match_id: match.matchId,
            prediction_id: match.prediction.id,
            bookmaker: 'Pinnacle',
            ...vb,
            is_active: true,
            result: 'pending',
          })
        }
      }
    }
  }

  // ── Limpiar cuotas anteriores y reemplazar ───────────────────────────────────
  const matchIdList = Array.from(affectedMatchIds)
  if (matchIdList.length) {
    await supabase.from('odds').delete()
      .in('match_id', matchIdList)
      .in('bookmaker', ['Pinnacle', ...CO_BOOKMAKERS])
  }

  if (oddsRows.length) {
    const { error } = await supabase.from('odds').insert(oddsRows)
    if (error) throw error
  }

  // Regenerar value bets
  if (matchIdList.length) {
    await supabase.from('value_bets').delete()
      .in('match_id', matchIdList)
      .in('bookmaker', ['Pinnacle'])
  }
  if (valueBetRows.length) {
    const { error } = await supabase.from('value_bets')
      .upsert(valueBetRows, { onConflict: 'match_id,market,bookmaker', ignoreDuplicates: false })
    if (error) throw error
  }

  // Autolimpieza: las cuotas de partidos ya finalizados no sirven a nadie
  // (no se puede apostar a un partido jugado) y solo acumulan ruido.
  const { data: finishedIds } = await supabase
    .from('matches').select('id').eq('status', 'finished')
  const finishedList = (finishedIds ?? []).map((m: any) => m.id)
  let oddsCleaned = 0
  if (finishedList.length) {
    const { count } = await supabase.from('odds')
      .delete({ count: 'exact' }).in('match_id', finishedList)
    oddsCleaned = count ?? 0
    await supabase.from('value_bets').delete().in('match_id', finishedList)
  }

  await supabase.from('sync_logs').insert({
    source: 'pinnacle_via_odds_api',
    entity_type: 'odds',
    status: 'success',
    records_processed: oddsRows.length,
    records_failed: 0,
    metadata: { events: events.length, value_bets: valueBetRows.length, unmatched, oddsCleaned },
    duration_ms: Date.now() - started,
  })

  return {
    ok: true,
    events:        events.length,
    oddsRecorded:  oddsRows.length,
    valueBets:     valueBetRows.length,
    unmatched,
  }
}
