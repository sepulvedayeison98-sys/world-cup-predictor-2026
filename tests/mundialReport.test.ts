/**
 * Balance/Informe del Mundial — pruebas del módulo puro (lib/mundialReport).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMundialReport, type ReportPrediction } from '../lib/mundialReport'

function pred(over: Partial<ReportPrediction>): ReportPrediction {
  return {
    match_id: Math.random().toString(),
    was_correct: true,
    home_win_probability: 0.6,
    draw_probability: 0.25,
    away_win_probability: 0.15,
    confidence_score: 70,
    phase: 'group',
    home_name: 'A', away_name: 'B',
    home_score: 2, away_score: 0,
    kickoff_time: '2026-06-15T00:00:00Z',
    ...over,
  }
}

test('precisión y línea base sobre resueltos', () => {
  const preds = [
    pred({ was_correct: true }),
    pred({ was_correct: true }),
    pred({ was_correct: false }),
    pred({ was_correct: null }), // no resuelto: se ignora
  ]
  const r = computeMundialReport(preds)
  assert.equal(r.total, 3)
  assert.equal(r.correct, 2)
  assert.ok(Math.abs((r.accuracy ?? 0) - 2 / 3) < 1e-9)
  assert.ok(Math.abs(r.chanceBaseline - 1 / 3) < 1e-9)
})

test('sin resueltos → accuracy null, sin inventar', () => {
  const r = computeMundialReport([pred({ was_correct: null })])
  assert.equal(r.total, 0)
  assert.equal(r.accuracy, null)
})

test('mejores aciertos y peores fallos ordenados por convicción', () => {
  const preds = [
    pred({ home_win_probability: 0.85, was_correct: true, home_name: 'Seguro-OK' }),
    pred({ home_win_probability: 0.55, was_correct: true, home_name: 'Ajustado-OK' }),
    pred({ home_win_probability: 0.80, was_correct: false, home_name: 'Seguro-Falló' }),
  ]
  const r = computeMundialReport(preds)
  assert.equal(r.bestCalls[0].home_name, 'Seguro-OK')     // 0.85 primero
  assert.equal(r.worstMisses[0].home_name, 'Seguro-Falló') // el fallo de más convicción
})

test('calibración agrupa por probabilidad del favorito', () => {
  const preds = [
    pred({ home_win_probability: 0.9, was_correct: true }),  // bucket 80%+
    pred({ home_win_probability: 0.9, was_correct: false }), // bucket 80%+
  ]
  const r = computeMundialReport(preds)
  const top = r.calibration.find((b) => b.label === '80%+')!
  assert.equal(top.total, 2)
  assert.equal(top.correct, 1)
  assert.equal(top.hitRate, 0.5)
})

test('precisión por fase', () => {
  const preds = [
    pred({ phase: 'group', was_correct: true }),
    pred({ phase: 'group', was_correct: false }),
    pred({ phase: 'quarter_final', was_correct: true }),
  ]
  const r = computeMundialReport(preds)
  const group = r.byPhase.find((p) => p.phase === 'group')!
  assert.equal(group.total, 2)
  assert.equal(group.correct, 1)
  const qf = r.byPhase.find((p) => p.phase === 'quarter_final')!
  assert.equal(qf.accuracy, 1)
})
