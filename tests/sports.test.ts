/**
 * Tests del registro multi-deporte: la lista blanca por deporte es la
 * barrera que impide que procesos transversales (Smart Bets, syncs)
 * crucen partidos entre deportes. Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { competitionIdsOfSport, sportOfCompetition, ACTIVE_COMPETITIONS } from '../lib/sports'
import { COMPETITION_ID, LEAGUE_SLUGS } from '../lib/constants'
import { NBA_COMPETITION_ID } from '../lib/nba'

test('aislamiento: la lista de fútbol incluye Mundial y las 5 ligas, nunca la NBA', () => {
  const futbol = competitionIdsOfSport('futbol')
  assert.ok(futbol.includes(COMPETITION_ID), 'debe incluir el Mundial')
  for (const id of Object.values(LEAGUE_SLUGS)) {
    assert.ok(futbol.includes(id), `debe incluir la liga ${id}`)
  }
  assert.ok(!futbol.includes(NBA_COMPETITION_ID), 'JAMÁS debe incluir la NBA')
  assert.equal(futbol.length, 6, 'Mundial + 5 grandes ligas')
})

test('aislamiento: la lista de baloncesto es exactamente la NBA', () => {
  assert.deepEqual(competitionIdsOfSport('baloncesto'), [NBA_COMPETITION_ID])
})

test('aislamiento: tenis aún no tiene competiciones activas (solo roadmap)', () => {
  assert.deepEqual(competitionIdsOfSport('tenis'), [])
})

test('sportOfCompetition clasifica NBA como baloncesto y Mundial como fútbol', () => {
  assert.equal(sportOfCompetition(NBA_COMPETITION_ID), 'baloncesto')
  assert.equal(sportOfCompetition(COMPETITION_ID), 'futbol')
})

test('las listas por deporte particionan las competiciones activas sin solaparse', () => {
  const futbol = new Set(competitionIdsOfSport('futbol'))
  const basket = new Set(competitionIdsOfSport('baloncesto'))
  for (const id of basket) assert.ok(!futbol.has(id), 'sin solape fútbol/baloncesto')
  const total = futbol.size + basket.size + competitionIdsOfSport('tenis').length
  assert.equal(total, ACTIVE_COMPETITIONS.filter((c) => c.id).length)
})
