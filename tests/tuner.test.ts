/**
 * Tuner de pesos (Learning Engine, modo "propone") — pruebas del módulo puro.
 * Verifica guardarraíles, determinismo y que nunca empeora el Brier.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tuneWeights, evaluateWeights, DEFAULT_TUNER_OPTIONS, type TrainingExample } from '../lib/prediction/tuner'
import { DEFAULT_WEIGHTS, type ModelInput } from '../lib/predictionEngine'

const makeInput = (homeElo: number, awayElo: number): ModelInput => ({
  homeElo, awayElo,
  homeForm: ['W', 'D', 'W', 'L', 'W'], awayForm: ['L', 'D', 'L', 'W', 'D'],
  homeXg: 1.4, awayXg: 1.2, homeXga: 1.1, awayXga: 1.3,
  homeInjuryImpact: 0, awayInjuryImpact: 0,
})

// Dataset determinista con señal de ELO (≥ minMass).
function dataset(n: number): TrainingExample[] {
  const out: TrainingExample[] = []
  for (let i = 0; i < n; i++) {
    const homeElo = 1500 + (i % 12) * 30
    const awayElo = 1500 + ((i * 7) % 12) * 30
    const outcome = homeElo > awayElo + 60 ? 'home'
      : awayElo > homeElo + 60 ? 'away'
      : (i % 3 === 0 ? 'draw' : homeElo >= awayElo ? 'home' : 'away')
    out.push({ input: makeInput(homeElo, awayElo), outcome })
  }
  return out
}

const KEYS = ['xg', 'elo', 'form', 'market', 'news'] as const

test('evaluateWeights: devuelve un Brier numérico sobre resueltos', () => {
  const b = evaluateWeights(dataset(20), DEFAULT_WEIGHTS)
  assert.equal(typeof b, 'number')
  assert.ok(b! >= 0)
})

test('tuner: masa insuficiente → no propone (devuelve los pesos actuales)', () => {
  const cand = tuneWeights(dataset(10), DEFAULT_WEIGHTS)
  assert.equal(cand.accepted, false)
  assert.equal(cand.reason, 'masa_insuficiente')
  assert.deepEqual(cand.weights, DEFAULT_WEIGHTS)
})

test('tuner: respeta los guardarraíles (Σ=1, rango y cota de paso)', () => {
  const cand = tuneWeights(dataset(120), DEFAULT_WEIGHTS)
  const sum = KEYS.reduce((s, k) => s + cand.weights[k], 0)
  assert.ok(Math.abs(sum - 1) < 1e-6, `Σ pesos = ${sum}`)
  for (const k of KEYS) {
    assert.ok(cand.weights[k] >= DEFAULT_TUNER_OPTIONS.bounds[0] - 1e-9, `${k} bajo cota`)
    assert.ok(cand.weights[k] <= DEFAULT_TUNER_OPTIONS.bounds[1] + 1e-9, `${k} sobre cota`)
    assert.ok(
      Math.abs(cand.weights[k] - DEFAULT_WEIGHTS[k]) <= DEFAULT_TUNER_OPTIONS.maxStepPerRun + 1e-9,
      `${k} movió más que la cota de paso`,
    )
  }
})

test('tuner: nunca empeora el Brier (mejora ≥ 0)', () => {
  const cand = tuneWeights(dataset(120), DEFAULT_WEIGHTS)
  assert.ok(cand.brierCandidate! <= cand.brierCurrent! + 1e-12)
  assert.ok(cand.improvement >= 0)
  assert.equal(typeof cand.accepted, 'boolean')
})

test('tuner: determinista — misma entrada, mismo candidato', () => {
  const data = dataset(120)
  const a = tuneWeights(data, DEFAULT_WEIGHTS)
  const b = tuneWeights(data, DEFAULT_WEIGHTS)
  assert.deepEqual(a, b)
})
