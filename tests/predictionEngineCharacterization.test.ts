/**
 * Test de CARACTERIZACIÓN del Prediction Engine (fútbol) — red de seguridad de
 * la Fase 5 (modularización sin cambiar resultados).
 *
 * Fija las salidas EXACTAS del motor para una matriz de entradas
 * representativas. Cualquier refactor que altere un resultado —aunque sea en el
 * cuarto decimal— rompe este test. Es el guardián de la regla "no se busca
 * cambiar los resultados": el motor debe ser determinista y repetible.
 *
 * Los valores dorados se capturaron del motor v1.2.0 (2026-07-19). Si un cambio
 * FUTURO justificado modifica el modelo, hay que (1) justificarlo en
 * docs/PREDICTION_ENGINE.md, (2) subir la versión y (3) actualizar estos valores
 * conscientemente en el mismo commit.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeModelPrediction, simulateMatch, computeKnockoutAdvance, devigMarket,
  type ModelInput,
} from '../lib/predictionEngine'

const base = (o: Partial<ModelInput> = {}): ModelInput => ({
  homeElo: 1700, awayElo: 1650, homeForm: ['W', 'D', 'W', 'L', 'W'], awayForm: ['L', 'D', 'L', 'W', 'D'],
  homeXg: 1.5, awayXg: 1.2, homeXga: 1.1, awayXga: 1.3,
  homeInjuryImpact: 0, awayInjuryImpact: 0, ...o,
})

const GOLDEN = {
  neutral: { home: 0.4561, draw: 0.2869, away: 0.257, predictedHome: 1, predictedAway: 1, confidenceScore: 71.05, top: { home: 1, away: 1, prob: 0.137 } },
  favLocal: { home: 0.6367, draw: 0.2328, away: 0.1305, predictedHome: 2, predictedAway: 0, confidenceScore: 87.3, top: { home: 2, away: 0, prob: 0.1253 } },
  knockout: { home: 0.4409, draw: 0.3058, away: 0.2533, predictedHome: 1, predictedAway: 1, confidenceScore: 69.68, top: { home: 1, away: 1, prob: 0.1432 } },
  conMercado: { home: 0.4847, draw: 0.2822, away: 0.233, predictedHome: 1, predictedAway: 1, confidenceScore: 73.62, top: { home: 1, away: 1, prob: 0.135 } },
  lesiones: { home: 0.3932, draw: 0.2936, away: 0.3132, predictedHome: 1, predictedAway: 1, confidenceScore: 40, top: { home: 1, away: 1, prob: 0.1403 } },
} as const

function check(name: keyof typeof GOLDEN, input: ModelInput) {
  const g = GOLDEN[name]
  const r = computeModelPrediction(input)
  assert.equal(r.home, g.home, `${name}.home`)
  assert.equal(r.draw, g.draw, `${name}.draw`)
  assert.equal(r.away, g.away, `${name}.away`)
  assert.equal(r.predictedHome, g.predictedHome, `${name}.predictedHome`)
  assert.equal(r.predictedAway, g.predictedAway, `${name}.predictedAway`)
  assert.equal(r.confidenceScore, g.confidenceScore, `${name}.confidenceScore`)
  assert.deepEqual(
    { home: r.exactScores[0].home, away: r.exactScores[0].away, prob: r.exactScores[0].prob },
    g.top, `${name}.topScore`,
  )
}

test('caracterización: computeModelPrediction reproduce las salidas v1.2.0', () => {
  check('neutral', base())
  check('favLocal', base({ homeElo: 1900, awayElo: 1500, homeXg: 2.2, awayXg: 0.8 }))
  check('knockout', base({ isKnockout: true }))
  check('conMercado', base({ marketProbabilities: { home: 0.5, draw: 0.28, away: 0.22 } }))
  check('lesiones', base({ homeInjuryImpact: 45, awayInjuryImpact: 10 }))
})

test('caracterización: simulateMatch y helpers reproducen las salidas v1.2.0', () => {
  assert.deepEqual(simulateMatch(1.4, 1.4).probabilities, { home: 0.3605, draw: 0.279, away: 0.3605 })
  assert.deepEqual(simulateMatch(2.1, 0.7).probabilities, { home: 0.689, draw: 0.2087, away: 0.1023 })
  assert.deepEqual(computeKnockoutAdvance({ home: 0.45, draw: 0.27, away: 0.28 }, 1850, 1650), { home: 0.606, away: 0.394 })
  assert.deepEqual(devigMarket(2.0, 3.4, 4.1), {
    home: 0.4816862474084312, draw: 0.2833448514167243, away: 0.2349689011748445,
  })
})

test('caracterización: determinismo — misma entrada, misma salida (10 corridas)', () => {
  const input = base({ homeElo: 1820, awayElo: 1600, marketProbabilities: { home: 0.55, draw: 0.25, away: 0.2 } })
  const first = JSON.stringify(computeModelPrediction(input))
  for (let i = 0; i < 10; i++) {
    assert.equal(JSON.stringify(computeModelPrediction(input)), first, `corrida ${i} difiere`)
  }
})
