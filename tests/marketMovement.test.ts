/**
 * Movimiento del mercado — pruebas del módulo puro (lib/marketMovement).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMovements } from '../lib/marketMovement'

test('cuota que baja → shift positivo (probabilidad sube)', () => {
  const old = new Map([['home_win', 2.10]])
  const nw = new Map([['home_win', 1.85]])
  const rows = computeMovements('m1', 'Pinnacle', old, nw)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].odds_before, 2.10)
  assert.equal(rows[0].odds_after, 1.85)
  assert.ok(rows[0].prob_shift_pct > 0) // 1/1.85 - 1/2.10 > 0
})

test('marca significativo cuando |shift| > 5%', () => {
  // 5.00 → 3.00: 1/3 - 1/5 = 0.333 - 0.2 = 0.133 (>5%)
  const rows = computeMovements('m1', 'Pinnacle', new Map([['x', 5]]), new Map([['x', 3]]))
  assert.equal(rows[0].is_significant, true)
})

test('cambios de redondeo (<1pp) se ignoran', () => {
  // 2.00 → 2.01: 1/2.01 - 1/2 ≈ -0.0025 (<1pp)
  const rows = computeMovements('m1', 'Pinnacle', new Map([['x', 2.0]]), new Map([['x', 2.01]]))
  assert.equal(rows.length, 0)
})

test('sin cuota previa → no hay movimiento (no se inventa)', () => {
  const rows = computeMovements('m1', 'Pinnacle', new Map(), new Map([['home_win', 1.9]]))
  assert.equal(rows.length, 0)
})
