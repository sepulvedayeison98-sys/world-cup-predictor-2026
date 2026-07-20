/**
 * Smart Bets · capa de presentación — pruebas del módulo puro.
 * Filtro/orden deterministas; formateo estable; sin crash con lista vacía.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  filterAndSort, formatPct, formatSignedPct, formatOdds, DEFAULT_FILTERS,
} from '../components/smart-bets/present'
import type { SmartBetRecommendation } from '../lib/smartBets'

const rec = (over: Partial<SmartBetRecommendation>): SmartBetRecommendation => ({
  matchId: 'm', market: 'home_win', marketLabel: 'L', sport: 'futbol', bookmaker: 'X',
  oddsValue: 2, modelProbability: 0.55, impliedProbability: 0.5, edge: 0.05, expectedValue: 0.1,
  kellyStakePct: 1, riskTier: 'bajo', riskScore: 20, score: 60, scoreBreakdown: {}, tier: 'fuerte',
  rank: 0, reason: '', trace: {} as any, ...over,
})

const data: SmartBetRecommendation[] = [
  rec({ market: 'a', score: 50, expectedValue: 0.20, oddsValue: 1.5, riskTier: 'alto' }),
  rec({ market: 'b', score: 80, expectedValue: 0.05, oddsValue: 3.0, riskTier: 'bajo' }),
  rec({ market: 'c', score: 65, expectedValue: 0.12, oddsValue: 2.2, riskTier: 'medio' }),
]

test('orden por score (def.): desc', () => {
  const r = filterAndSort(data, DEFAULT_FILTERS).map((x) => x.market)
  assert.deepEqual(r, ['b', 'c', 'a'])
})

test('orden por EV y por cuota', () => {
  assert.deepEqual(filterAndSort(data, { risk: 'todos', sort: 'ev' }).map((x) => x.market), ['a', 'c', 'b'])
  assert.deepEqual(filterAndSort(data, { risk: 'todos', sort: 'odds' }).map((x) => x.market), ['b', 'c', 'a'])
})

test('filtro por riesgo', () => {
  assert.deepEqual(filterAndSort(data, { risk: 'bajo', sort: 'score' }).map((x) => x.market), ['b'])
  assert.equal(filterAndSort(data, { risk: 'alto', sort: 'score' }).length, 1)
})

test('determinismo y desempate estable por mercado', () => {
  const tie = [rec({ market: 'z', score: 70 }), rec({ market: 'a', score: 70 })]
  const a = filterAndSort(tie).map((x) => x.market)
  assert.deepEqual(a, ['a', 'z'])
  assert.deepEqual(filterAndSort(tie).map((x) => x.market), a)
})

test('lista vacía no rompe', () => {
  assert.deepEqual(filterAndSort([], DEFAULT_FILTERS), [])
})

test('formateo', () => {
  assert.equal(formatPct(0.123), '12.3%')
  assert.equal(formatSignedPct(0.05), '+5.0%')
  assert.equal(formatSignedPct(-0.05), '-5.0%')
  assert.equal(formatOdds(2.1), '2.10')
})
