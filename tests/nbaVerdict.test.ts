/**
 * Tests del veredicto de baloncesto (capa determinista). npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { buildNbaVerdict, type NbaVerdictInput } from '../lib/nbaVerdict'

function base(o: Partial<NbaVerdictInput> = {}): NbaVerdictInput {
  return {
    homeName: 'Denver Nuggets',
    awayName: 'Boston Celtics',
    homeScore: 112,
    awayScore: 104,
    competitionName: 'NBA',
    periodScores: { home: [28, 26, 30, 28], away: [25, 27, 26, 26] },
    prediction: { home: 0.62, away: 0.38, predictedHome: 113, predictedAway: 108 },
    ...o,
  }
}

test('veredicto NBA: victoria con pick acertado, lenguaje de puntos', () => {
  const v = buildNbaVerdict(base())
  assert.ok(v.summary.includes('Denver Nuggets'))
  assert.ok(v.summary.includes('112-104'))
  assert.ok(v.prediction_review.includes('acertó'))
  assert.ok(v.factors.length >= 1 && v.factors.length <= 4)
})

test('veredicto NBA: paliza detectada', () => {
  const v = buildNbaVerdict(base({ homeScore: 130, awayScore: 98, periodScores: null }))
  assert.ok(v.summary.toLowerCase().includes('paliza'))
  assert.ok(v.factors.some((f) => f.title === 'Control'))
})

test('veredicto NBA: partido cerrado (≤3)', () => {
  const v = buildNbaVerdict(base({ homeScore: 101, awayScore: 100, periodScores: null }))
  assert.ok(v.summary.toLowerCase().includes('infarto') || v.factors.some((f) => f.title === 'Partido cerrado'))
})

test('veredicto NBA: remontada desde el descanso', () => {
  const v = buildNbaVerdict(base({
    homeScore: 110, awayScore: 105,
    periodScores: { home: [20, 22, 34, 34], away: [30, 28, 24, 23] }, // iba perdiendo 42-58 al descanso
  }))
  assert.ok(v.factors.some((f) => f.title === 'Remontada'))
})

test('veredicto NBA: pick fallido se reporta honesto', () => {
  const v = buildNbaVerdict(base({
    homeScore: 100, awayScore: 115, periodScores: null,
    prediction: { home: 0.7, away: 0.3, predictedHome: 112, predictedAway: 105 },
  }))
  assert.ok(v.prediction_review.includes('falló'))
  assert.ok(v.summary.includes('Boston Celtics')) // ganó el visitante
})

test('veredicto NBA: sin predicción, sin inventar', () => {
  const v = buildNbaVerdict(base({ prediction: null }))
  assert.ok(v.prediction_review.includes('no tuvo predicción'))
})
