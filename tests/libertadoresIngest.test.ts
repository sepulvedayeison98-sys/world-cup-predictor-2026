/**
 * Tests del mapeo de rondas de Copa Libertadores → fase interna.
 * Es lo que decide qué se ingesta (grupos en adelante) y qué se ignora
 * (clasificación) — la parte con más riesgo de la ingesta, no la red.
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { mapRound } from '../services/sync/libertadores-ingest'

test('clasificación queda fuera de alcance', () => {
  assert.equal(mapRound('Qualification Round 1'), null)
  assert.equal(mapRound('Qualification Round 3'), null)
})

test('fase de grupos captura la jornada', () => {
  assert.deepEqual(mapRound('Group Stage - 1'), { phase: 'group', matchday: 1 })
  assert.deepEqual(mapRound('Group Stage - 6'), { phase: 'group', matchday: 6 })
})

test('eliminatorias no tienen jornada de tabla', () => {
  assert.deepEqual(mapRound('Round of 16'), { phase: 'round_of_16', matchday: null })
  assert.deepEqual(mapRound('Quarter-finals'), { phase: 'quarter_final', matchday: null })
  assert.deepEqual(mapRound('Semi-finals'), { phase: 'semi_final', matchday: null })
  assert.deepEqual(mapRound('Final'), { phase: 'final', matchday: null })
})

test('una fase desconocida no se inventa — se ignora', () => {
  assert.equal(mapRound('Some Other Stage'), null)
})
