/**
 * Tests del criterio de arranque en frío.
 * Es lo que decide si la UI presenta un número como predicción o lo declara
 * como prior — o sea, la regla #1 del proyecto puesta en código.
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  predictionWarmup,
  coldStartNote,
  coldStartBadge,
  PREDICTION_WARMUP,
} from '../lib/predictionQuality'
import { LEAGUE_WARMUP_MATCHES } from '../lib/leagueEngine'

test('el umbral de la UI es el MISMO que el del backtest', () => {
  // Si se separan, la pantalla y la medición dejarían de hablar de lo mismo
  assert.equal(PREDICTION_WARMUP, LEAGUE_WARMUP_MATCHES)
})

test('temporada recién empezada: cero partidos es arranque en frío', () => {
  const w = predictionWarmup(0, 0)
  assert.equal(w.warmedUp, false)
  assert.equal(w.matchesPlayed, 0)
  assert.match(coldStartNote(w)!, /Sin partidos jugados/)
  assert.equal(coldStartBadge(w), 'Prior de arranque')
})

test('basta con que UNO de los dos no haya calentado', () => {
  // Criterio idéntico al de runLeagueBacktest, que no evalúa el partido
  // si cualquiera de los dos está por debajo del calentamiento
  const w = predictionWarmup(30, 2)
  assert.equal(w.warmedUp, false)
  assert.equal(w.matchesPlayed, 2) // manda el que menos tiene
  assert.match(coldStartNote(w)!, /Solo 2 partidos jugados/)
})

test('con los dos calentados la predicción no se declara como prior', () => {
  const w = predictionWarmup(PREDICTION_WARMUP, PREDICTION_WARMUP)
  assert.equal(w.warmedUp, true)
  assert.equal(coldStartNote(w), null)
  assert.equal(coldStartBadge(w), null)
})

test('justo por debajo del umbral todavía es frío', () => {
  assert.equal(predictionWarmup(PREDICTION_WARMUP - 1, 40).warmedUp, false)
  assert.equal(predictionWarmup(40, PREDICTION_WARMUP - 1).warmedUp, false)
})

test('sin fila en team_statistics se cuenta como cero, no como ilimitado', () => {
  // Es justo lo que pasa al empezar temporada: la fila aún no existe
  assert.equal(predictionWarmup(null, null).warmedUp, false)
  assert.equal(predictionWarmup(undefined, 40).matchesPlayed, 0)
  assert.equal(predictionWarmup(40, null).warmedUp, false)
})

test('un solo partido se dice en singular', () => {
  assert.match(coldStartNote(predictionWarmup(1, 9))!, /Solo 1 partido jugado /)
})
