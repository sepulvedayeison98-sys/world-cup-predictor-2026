/**
 * Test de la temporada NBA dinámica (currentNbaSeason). La NBA cruza el
 * cambio de año: de octubre en adelante es {año}-{año+1}; antes, la
 * anterior. Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { currentNbaSeason } from '../lib/nba/constants'

const at = (iso: string) => currentNbaSeason(new Date(iso))

test('octubre en adelante → temporada que arranca ese año', () => {
  assert.equal(at('2026-10-01T00:00:00Z'), '2026-2027')
  assert.equal(at('2026-12-25T00:00:00Z'), '2026-2027')
  assert.equal(at('2026-11-15T12:00:00Z'), '2026-2027')
})

test('enero a septiembre → temporada que empezó el año anterior', () => {
  assert.equal(at('2027-01-05T00:00:00Z'), '2026-2027') // misma temporada, ya en el año siguiente
  assert.equal(at('2027-04-15T00:00:00Z'), '2026-2027') // playoffs
  assert.equal(at('2026-06-20T00:00:00Z'), '2025-2026') // finales de la temporada previa
})

test('el hueco de verano apunta a la MÁS RECIENTE jugada, no a una vacía', () => {
  // Julio 2026: la 2025-26 ya terminó, la 2026-27 aún no publica calendario
  assert.equal(at('2026-07-19T00:00:00Z'), '2025-2026')
  assert.equal(at('2026-09-30T23:59:59Z'), '2025-2026')
})

test('borde exacto del 1 de octubre (UTC)', () => {
  assert.equal(at('2026-09-30T23:59:59Z'), '2025-2026')
  assert.equal(at('2026-10-01T00:00:00Z'), '2026-2027')
})
