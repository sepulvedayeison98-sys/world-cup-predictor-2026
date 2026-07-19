/**
 * Métricas de calibración — pruebas del módulo puro (lib/calibration).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  brierScore, BRIER_CHANCE_1X2, logLoss, accuracy, calibrationBuckets,
  expectedCalibrationError, calibrationReport,
  type CalibPrediction,
} from '../lib/calibration'

const p = (home: number, draw: number, away: number, outcome: any): CalibPrediction =>
  ({ home, draw, away, outcome })

test('Brier: predicción perfecta = 0', () => {
  const preds = [p(1, 0, 0, 'home'), p(0, 0, 1, 'away')]
  assert.equal(brierScore(preds), 0)
})

test('Brier del azar 1X2 = 0.667 (referencia)', () => {
  const preds = [p(1 / 3, 1 / 3, 1 / 3, 'home'), p(1 / 3, 1 / 3, 1 / 3, 'away')]
  assert.ok(Math.abs((brierScore(preds) ?? 0) - BRIER_CHANCE_1X2) < 1e-9)
})

test('Brier ignora no resueltos; null si no hay ninguno', () => {
  assert.equal(brierScore([p(0.6, 0.3, 0.1, null)]), null)
  const r = brierScore([p(1, 0, 0, 'home'), p(0.5, 0.3, 0.2, null)])
  assert.equal(r, 0) // solo cuenta el resuelto perfecto
})

test('accuracy: acierta si el favorito fue el real', () => {
  const preds = [
    p(0.6, 0.25, 0.15, 'home'), // acierta
    p(0.2, 0.3, 0.5, 'draw'),   // falla (favorito away, salió draw)
  ]
  const a = accuracy(preds)
  assert.equal(a.correct, 1)
  assert.equal(a.total, 2)
  assert.equal(a.pct, 0.5)
})

test('logLoss penaliza la sobreconfianza equivocada', () => {
  const seguro = logLoss([p(0.95, 0.03, 0.02, 'away')])!  // muy seguro y falló
  const humilde = logLoss([p(0.5, 0.3, 0.2, 'away')])!    // menos seguro y falló
  assert.ok(seguro > humilde)
})

test('calibración: agrupa por probabilidad del favorito y mide observado', () => {
  // 2 picks en el tramo 55–65% (favorito 0.6): uno acierta, otro falla
  const preds = [
    p(0.6, 0.25, 0.15, 'home'),
    p(0.6, 0.25, 0.15, 'draw'),
  ]
  const buckets = calibrationBuckets(preds)
  const b = buckets.find((x) => x.from === 0.55)!
  assert.equal(b.total, 2)
  assert.equal(b.correct, 1)
  assert.equal(b.observed, 0.5)
})

test('ECE: null sin resueltos; 0 cuando lo observado = lo prometido', () => {
  assert.equal(expectedCalibrationError([p(0.6, 0.25, 0.15, null)]), null)
  // Tramo 55–65% (midpoint 0.6): 5 picks, 3 aciertos → observado 0.6 = prometido
  const preds = [
    p(0.6, 0.25, 0.15, 'home'), p(0.6, 0.25, 0.15, 'home'), p(0.6, 0.25, 0.15, 'home'),
    p(0.6, 0.25, 0.15, 'draw'), p(0.6, 0.25, 0.15, 'away'),
  ]
  assert.ok(Math.abs(expectedCalibrationError(preds)!) < 1e-9)
})

test('ECE: mide la brecha cuando el modelo está sobreconfiado', () => {
  // Promete 60% pero nunca acierta → brecha 0.6
  const preds = [p(0.6, 0.25, 0.15, 'draw'), p(0.6, 0.25, 0.15, 'away')]
  assert.ok(Math.abs(expectedCalibrationError(preds)! - 0.6) < 1e-9)
})

test('calibrationReport: agrega todas las métricas; null-safe sin resueltos', () => {
  const empty = calibrationReport([p(0.6, 0.25, 0.15, null)])
  assert.deepEqual(empty, { n: 0, brier: null, logLoss: null, accuracyPct: null, ece: null })
  const r = calibrationReport([p(1, 0, 0, 'home'), p(0, 0, 1, 'away')])
  assert.equal(r.n, 2)
  assert.equal(r.brier, 0)
  assert.equal(r.accuracyPct, 1)
})
