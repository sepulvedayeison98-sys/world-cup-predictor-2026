/**
 * Tests del motor de calificación de Smart Bets (historial de aciertos).
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { gradeSmartBetPick } from '../lib/smartBetGrading'

test('resultado 1X2: home_win/draw/away_win se califican contra el marcador', () => {
  assert.equal(gradeSmartBetPick({ marketId: 'home_win', homeScore: 2, awayScore: 1 }).correct, true)
  assert.equal(gradeSmartBetPick({ marketId: 'home_win', homeScore: 1, awayScore: 1 }).correct, false)
  assert.equal(gradeSmartBetPick({ marketId: 'draw', homeScore: 1, awayScore: 1 }).correct, true)
  assert.equal(gradeSmartBetPick({ marketId: 'away_win', homeScore: 0, awayScore: 2 }).correct, true)
})

test('doble oportunidad: 1X y X2', () => {
  assert.equal(gradeSmartBetPick({ marketId: 'dc_1x', homeScore: 1, awayScore: 1 }).correct, true)
  assert.equal(gradeSmartBetPick({ marketId: 'dc_1x', homeScore: 0, awayScore: 1 }).correct, false)
  assert.equal(gradeSmartBetPick({ marketId: 'dc_x2', homeScore: 1, awayScore: 1 }).correct, true)
  assert.equal(gradeSmartBetPick({ marketId: 'dc_x2', homeScore: 2, awayScore: 0 }).correct, false)
})

test('over/under de goles: umbral estricto', () => {
  assert.equal(gradeSmartBetPick({ marketId: 'over_1_5', homeScore: 1, awayScore: 1 }).correct, true) // 2 > 1.5
  assert.equal(gradeSmartBetPick({ marketId: 'over_2_5', homeScore: 1, awayScore: 1 }).correct, false) // 2 no > 2.5
  assert.equal(gradeSmartBetPick({ marketId: 'over_3_5', homeScore: 1, awayScore: 1 }).correct, false) // 2 no > 3.5
  assert.equal(gradeSmartBetPick({ marketId: 'over_3_5', homeScore: 3, awayScore: 1 }).correct, true)
})

test('BTTS y portería a cero', () => {
  assert.equal(gradeSmartBetPick({ marketId: 'btts_yes', homeScore: 1, awayScore: 1 }).correct, true)
  assert.equal(gradeSmartBetPick({ marketId: 'btts_yes', homeScore: 1, awayScore: 0 }).correct, false)
  assert.equal(gradeSmartBetPick({ marketId: 'btts_no', homeScore: 1, awayScore: 0 }).correct, true)
  assert.equal(gradeSmartBetPick({ marketId: 'cs_home', homeScore: 2, awayScore: 0 }).correct, true)
  assert.equal(gradeSmartBetPick({ marketId: 'cs_away', homeScore: 0, awayScore: 0 }).correct, true)
  assert.equal(gradeSmartBetPick({ marketId: 'cs_home', homeScore: 2, awayScore: 1 }).correct, false)
})

test('córners/tarjetas sin estadísticas oficiales quedan como no evaluables', () => {
  const corners = gradeSmartBetPick({ marketId: 'corners_9_5', homeScore: 1, awayScore: 0 })
  assert.equal(corners.gradable, false)
  assert.equal(corners.correct, null)

  const cards = gradeSmartBetPick({ marketId: 'cards_3_5', homeScore: 1, awayScore: 0 })
  assert.equal(cards.gradable, false)
  assert.equal(cards.correct, null)
})

test('córners/tarjetas con estadísticas oficiales sí se califican', () => {
  const corners = gradeSmartBetPick({ marketId: 'corners_9_5', homeScore: 1, awayScore: 0, totalCorners: 11 })
  assert.equal(corners.gradable, true)
  assert.equal(corners.correct, true)

  const cards = gradeSmartBetPick({ marketId: 'cards_4_5', homeScore: 1, awayScore: 0, totalYellowCards: 3 })
  assert.equal(cards.gradable, true)
  assert.equal(cards.correct, false)
})

test('mercado desconocido no revienta: se marca como no evaluable', () => {
  const r = gradeSmartBetPick({ marketId: 'algo_raro', homeScore: 1, awayScore: 1 })
  assert.equal(r.gradable, false)
  assert.equal(r.correct, null)
})
