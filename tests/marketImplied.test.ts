/**
 * Implícita del mercado 1X2 — pruebas del módulo puro (lib/marketImplied).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deviggedImplied, marketImpliedFromOdds } from '../lib/marketImplied'

test('devig normaliza a suma 1 y quita el overround', () => {
  // Cuotas con ~5% de margen: 1/2 + 1/3.5 + 1/4 = 0.5+0.2857+0.25 = 1.0357
  const r = deviggedImplied(2.0, 3.5, 4.0)!
  assert.ok(Math.abs(r.home + r.draw + r.away - 1) < 1e-9)
  assert.ok(r.home > r.away) // local más probable
  // La implícita cruda del local (0.5) baja al quitar el margen
  assert.ok(r.home < 0.5)
})

test('falta una cuota → null (no se inventa mercado)', () => {
  assert.equal(deviggedImplied(2.0, null, 4.0), null)
  assert.equal(deviggedImplied(2.0, 3.5, 1.0), null) // cuota inválida <=1
})

test('marketImpliedFromOdds arma 1X2 de Pinnacle', () => {
  const odds = [
    { bookmaker: 'Pinnacle', market: 'home_win', odds_value: 2.0 },
    { bookmaker: 'Pinnacle', market: 'draw', odds_value: 3.5 },
    { bookmaker: 'Pinnacle', market: 'away_win', odds_value: 4.0 },
    { bookmaker: 'Betplay', market: 'home_win', odds_value: 1.9 }, // otro book: se ignora
  ]
  const r = marketImpliedFromOdds(odds)!
  assert.ok(Math.abs(r.home + r.draw + r.away - 1) < 1e-9)
})

test('sin las tres de Pinnacle → null', () => {
  const odds = [{ bookmaker: 'Pinnacle', market: 'home_win', odds_value: 2.0 }]
  assert.equal(marketImpliedFromOdds(odds), null)
})
