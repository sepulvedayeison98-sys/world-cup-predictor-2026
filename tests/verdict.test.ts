/**
 * Tests del motor de veredicto post-partido (capa determinista).
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDeterministicVerdict, type VerdictInput } from '../lib/verdictEngine'

function base(overrides: Partial<VerdictInput> = {}): VerdictInput {
  return {
    homeName: 'Liverpool',
    awayName: 'Everton',
    homeScore: 2,
    awayScore: 0,
    htHome: 1,
    htAway: 0,
    competitionName: 'Premier League',
    prediction: { home: 0.62, draw: 0.22, away: 0.16, predictedHome: 2, predictedAway: 0 },
    homeXg: 2.1,
    awayXg: 0.5,
    events: [
      { type: 'goal', minute: 23, side: 'home', player: 'Salah' },
      { type: 'goal', minute: 71, side: 'home', player: 'Gakpo' },
    ],
    ...overrides,
  }
}

test('veredicto: acierto con señal fuerte y marcador exacto', () => {
  const v = buildDeterministicVerdict(base())
  assert.ok(v.summary.includes('Liverpool'))
  assert.ok(v.prediction_review.includes('acertó'))
  assert.ok(v.prediction_review.includes('marcador exacto'))
  assert.ok(v.model_lesson.toLowerCase().includes('señal fuerte'))
  assert.ok(v.factors.length >= 1 && v.factors.length <= 4)
})

test('veredicto: fallo de baja probabilidad se reporta con honestidad', () => {
  const v = buildDeterministicVerdict(base({
    homeScore: 0, awayScore: 1, htHome: 0, htAway: 0,
    homeXg: null, awayXg: null,
    events: [{ type: 'goal', minute: 88, side: 'away', player: 'Calvert-Lewin' }],
  }))
  assert.ok(v.prediction_review.includes('falló'))
  assert.ok(v.prediction_review.includes('16%'))
  assert.ok(v.model_lesson.includes('baja probabilidad'))
  // Gol sobre el final aparece en el resumen
  assert.ok(v.summary.includes('88'))
})

test('veredicto: la expulsión aparece como factor', () => {
  const v = buildDeterministicVerdict(base({
    events: [
      { type: 'red_card', minute: 30, side: 'away', player: 'Tarkowski' },
      { type: 'goal', minute: 55, side: 'home', player: 'Salah' },
    ],
  }))
  assert.ok(v.factors.some((f) => f.title === 'Expulsión' && f.text.includes('Everton')))
})

test('veredicto: ineficacia frente al xG detectada', () => {
  const v = buildDeterministicVerdict(base({
    homeScore: 0, awayScore: 0, htHome: 0, htAway: 0,
    prediction: { home: 0.5, draw: 0.27, away: 0.23, predictedHome: 2, predictedAway: 1 },
    homeXg: 2.4, awayXg: 0.3, events: [],
  }))
  assert.ok(v.factors.some((f) => f.title.includes('puntería') && f.text.includes('2.4')))
})

test('veredicto: remontada respecto al medio tiempo', () => {
  const v = buildDeterministicVerdict(base({
    homeScore: 1, awayScore: 2, htHome: 1, htAway: 0,
    homeXg: null, awayXg: null,
    events: [],
  }))
  assert.ok(v.factors.some((f) => f.title === 'Remontada' && f.text.includes('Everton')))
})

test('veredicto: sin predicción publicada — textos honestos, sin inventos', () => {
  const v = buildDeterministicVerdict(base({ prediction: null }))
  assert.ok(v.prediction_review.includes('no tuvo predicción'))
  assert.ok(v.model_lesson.length > 20)
})

test('veredicto: 0-0 cerrado describe el partido defensivo', () => {
  const v = buildDeterministicVerdict(base({
    homeScore: 0, awayScore: 0, htHome: 0, htAway: 0,
    homeXg: 0.4, awayXg: 0.5, events: [],
  }))
  assert.ok(v.summary.includes('defensas') || v.summary.includes('cerrado'))
})
