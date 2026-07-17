/**
 * DOMINIO TENNIS — pruebas del proxy de fatiga (tennis-2.0). Todo desde el
 * calendario y el marcador reales; sin minutos ni viajes (no están en la
 * fuente), declarado como proxy.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeFatigue, setCount, type FatigueMatch } from '../lib/tennis/fatigue'

const fm = (at: string, score: string, p1 = 'A'): FatigueMatch => ({
  p1_id: p1, p2_id: 'X', scheduled_at: at, score, status: 'finished',
})

test('setCount lee el número de sets del marcador', () => {
  assert.equal(setCount('6-4 3-6 7-6(5)'), 3)
  assert.equal(setCount('6-2 6-3'), 2)
  assert.equal(setCount('7-6(5) 6-7(4) 7-5'), 3)
  assert.equal(setCount(null), 0)
})

test('jugador cargado: 3 partidos en 7 días con 2 a tres sets y descanso de 1 día', () => {
  const matches = [
    fm('2025-01-19', '6-4 3-6 7-5'),   // 1 día antes, 3 sets
    fm('2025-01-17', '6-2 6-3'),        // 3 días, 2 sets
    fm('2025-01-15', '7-6 6-7 6-4'),    // 5 días, 3 sets
    fm('2025-01-01', '6-1 6-2'),        // 19 días, fuera de ventana
  ]
  const f = computeFatigue(matches, 'A', '2025-01-20')
  assert.equal(f.matchesLast7d, 3)
  assert.equal(f.matchesLast14d, 3)
  assert.equal(f.threeSetLast14d, 2)
  assert.equal(f.daysRest, 1)
  // load = 3*14 + 2*8 = 58 ; *1.3 (back-to-back) = 75.4 ; frescura ≈ 25
  assert.ok(f.freshnessIndex >= 23 && f.freshnessIndex <= 27, `freshness=${f.freshnessIndex}`)
})

test('jugador descansado: 1 partido hace 8 días → frescura 100', () => {
  const f = computeFatigue([fm('2025-01-12', '6-2 6-3')], 'A', '2025-01-20')
  assert.equal(f.matchesLast7d, 0)
  assert.equal(f.daysRest, 8)
  assert.equal(f.freshnessIndex, 100)
})

test('sin partidos previos → frescura 100, descanso null', () => {
  const f = computeFatigue([], 'A', '2025-01-20')
  assert.equal(f.freshnessIndex, 100)
  assert.equal(f.daysRest, null)
})

test('walk-forward: ignora partidos en o después de la fecha de referencia', () => {
  const matches = [fm('2025-01-20', '6-0 6-0'), fm('2025-01-25', '6-1 6-1')]
  const f = computeFatigue(matches, 'A', '2025-01-20')
  assert.equal(f.matchesLast7d, 0) // el del 20 no cuenta (no es < ref)
  assert.equal(f.daysRest, null)
})
