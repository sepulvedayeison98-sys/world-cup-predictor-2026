/**
 * Smart Bets Engine (value core) — pruebas del motor puro.
 * Verifica: consume el Prediction Engine (no genera probs), determinismo,
 * sin duplicados, consistencia, aislamiento por deporte, scoring reproducible.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateSmartBets, compareModelVsOdds, bestQuote, assessRisk, scoreRecommendation,
  validateInputs, marketsForSport, getMarket, SMART_BETS_ENGINE_VERSION,
  type ModelProbabilities, type MatchContext, type OddsQuote,
} from '../lib/smartBets'

const model: ModelProbabilities = { home: 0.55, draw: 0.25, away: 0.20, confidenceScore: 78, modelVersion: '1.2.0' }
const match: MatchContext = {
  matchId: 'm1', competitionId: 'c1', sport: 'futbol',
  homeName: 'A', awayName: 'B', kickoff: '2026-07-20T18:00:00Z',
}
// Cuotas: home a 2.10 (modelo 0.55 → EV alto), draw a 3.0, away a 4.0
const quotes: OddsQuote[] = [
  { marketId: 'home_win', bookmaker: 'Pinnacle', oddsValue: 2.10 },
  { marketId: 'home_win', bookmaker: 'Bet365', oddsValue: 2.05 },
  { marketId: 'draw', bookmaker: 'Pinnacle', oddsValue: 3.0 },
  { marketId: 'away_win', bookmaker: 'Pinnacle', oddsValue: 4.0 },
  { marketId: 'dc_1x', bookmaker: 'Pinnacle', oddsValue: 1.30 },
]
const opts = { now: '2026-07-19T00:00:00Z' }

test('EV y comparación: identidades correctas', () => {
  const c = compareModelVsOdds(0.55, { oddsValue: 2.10, bookmaker: 'X' })
  assert.ok(Math.abs(c.impliedProbability - 1 / 2.10) < 1e-12)
  assert.ok(Math.abs(c.expectedValue - (0.55 * 2.10 - 1)) < 1e-12)
  assert.ok(Math.abs(c.edge - (0.55 - 1 / 2.10)) < 1e-12)
})

test('bestQuote: elige la cuota más alta, desempata determinista por casa', () => {
  const q = bestQuote([
    { marketId: 'home_win', bookmaker: 'Zeta', oddsValue: 2.0 },
    { marketId: 'home_win', bookmaker: 'Alfa', oddsValue: 2.0 },
    { marketId: 'home_win', bookmaker: 'Beta', oddsValue: 1.9 },
  ])!
  assert.equal(q.oddsValue, 2.0)
  assert.equal(q.bookmaker, 'Alfa') // empate → nombre asc
})

test('no genera probabilidades: la del mercado sale por álgebra del modelo', () => {
  // dc_1x = home + draw
  const dc1x = getMarket('dc_1x')!
  assert.ok(Math.abs(dc1x.probabilityFrom!(model) - (model.home + model.draw)) < 1e-12)
  // dnb_home = home / (home + away)
  const dnb = getMarket('dnb_home')!
  assert.ok(Math.abs(dnb.probabilityFrom!(model) - model.home / (model.home + model.away)) < 1e-12)
})

test('determinismo: misma entrada → mismas recomendaciones', () => {
  const a = generateSmartBets({ match, model, quotes, options: opts })
  const b = generateSmartBets({ match, model, quotes, options: opts })
  assert.deepEqual(a, b)
})

test('sin duplicados: una recomendación por familia y ranks correlativos', () => {
  const recs = generateSmartBets({ match, model, quotes, options: opts })
  const families = recs.map((r) => getMarket(r.market)!.family)
  assert.equal(new Set(families).size, families.length, 'familias repetidas')
  const markets = recs.map((r) => r.market)
  assert.equal(new Set(markets).size, markets.length, 'mercados repetidos')
  recs.forEach((r, i) => assert.equal(r.rank, i + 1))
})

test('consistencia + trazabilidad: EV>0 y traza completa', () => {
  const recs = generateSmartBets({ match, model, quotes, options: opts })
  assert.ok(recs.length > 0)
  for (const r of recs) {
    assert.ok(r.expectedValue > 0, 'no debe recomendar EV<=0')
    assert.ok(r.score >= 40)
    assert.equal(r.trace.predictionEngineVersion, '1.2.0')
    assert.equal(r.trace.smartBetsEngineVersion, SMART_BETS_ENGINE_VERSION)
    assert.equal(r.trace.date, opts.now)
    assert.ok(r.trace.reason.length > 0)
    assert.ok(['bajo', 'medio', 'alto'].includes(r.riskTier))
  }
})

test('aislamiento por deporte: cuota de otro deporte se ignora', () => {
  const mixed = [...quotes, { marketId: 'nba_home', bookmaker: 'X', oddsValue: 1.5 }]
  const recs = generateSmartBets({ match, model, quotes: mixed, options: opts })
  assert.ok(recs.every((r) => r.sport === 'futbol'))
  assert.ok(recs.every((r) => r.market !== 'nba_home'))
})

test('validación: entrada incoherente → sin recomendaciones', () => {
  const bad: ModelProbabilities = { home: 0.9, draw: 0.9, away: 0.9, confidenceScore: 50, modelVersion: 'x' }
  assert.equal(validateInputs(bad, quotes).ok, false)
  assert.equal(generateSmartBets({ match, model: bad, quotes, options: opts }).length, 0)
  // cuota inválida
  assert.equal(generateSmartBets({ match, model, quotes: [{ marketId: 'home_win', bookmaker: 'X', oddsValue: 0.9 }], options: opts }).length, 0)
})

test('riesgo y scoring: deterministas y explicables', () => {
  const r1 = assessRisk({ oddsValue: 2.0, confidenceScore: 78, edge: 0.06 })
  const r2 = assessRisk({ oddsValue: 2.0, confidenceScore: 78, edge: 0.06 })
  assert.deepEqual(r1, r2)
  const s = scoreRecommendation({ expectedValue: 0.10, edge: 0.06, confidenceScore: 78, riskScore: r1.score })
  const sum = s.breakdown.ev + s.breakdown.edge + s.breakdown.confidence + s.breakdown.risk
  assert.ok(Math.abs(sum - s.score) < 0.05)
  assert.ok(s.score >= 0 && s.score <= 100)
})

test('registro de mercados: extensible y multi-deporte', () => {
  assert.ok(marketsForSport('futbol').length >= 8)
  assert.ok(marketsForSport('baloncesto').length >= 1)
  assert.ok(marketsForSport('tenis').length >= 1)
  // mercados inactivos registrados (punto de extensión, sin inventar prob)
  assert.equal(getMarket('over_2_5')!.active, false)
  assert.equal(getMarket('over_2_5')!.probabilityFrom, null)
})
