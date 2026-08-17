/**
 * Tests del registro multi-deporte: la lista blanca por deporte es la
 * barrera que impide que procesos transversales (Smart Bets, syncs)
 * crucen partidos entre deportes. Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { competitionIdsOfSport, sportOfCompetition, ACTIVE_COMPETITIONS } from '../lib/sports'
import { COMPETITION_ID, LEAGUE_SLUGS, ALL_LEAGUE_COMPETITION_IDS } from '../lib/constants'
import { NBA_COMPETITION_ID } from '../lib/nba/constants'
import { ATP_COMPETITION_ID, WTA_COMPETITION_ID } from '../lib/tennis/constants'

test('aislamiento: la lista de fútbol incluye Mundial y todas las ligas, nunca NBA ni tenis', () => {
  const futbol = competitionIdsOfSport('futbol')
  assert.ok(futbol.includes(COMPETITION_ID), 'debe incluir el Mundial')
  for (const id of Object.values(LEAGUE_SLUGS)) {
    assert.ok(futbol.includes(id), `debe incluir la liga ${id}`)
  }
  assert.ok(!futbol.includes(NBA_COMPETITION_ID), 'JAMÁS debe incluir la NBA')
  assert.ok(!futbol.includes(ATP_COMPETITION_ID), 'JAMÁS debe incluir el tenis')
  // Mundial + TODAS las competiciones de liga (una por liga y temporada): la
  // lista blanca debe cubrir también las campañas históricas, o los procesos
  // transversales dejarían de ver esos partidos al cambiar de temporada.
  // Se deriva del registro: añadir una liga o temporada no rompe el test.
  assert.equal(futbol.length, 1 + ALL_LEAGUE_COMPETITION_IDS.length)
  for (const id of ALL_LEAGUE_COMPETITION_IDS) {
    assert.ok(futbol.includes(id), `debe incluir la competición de liga ${id}`)
  }
})

test('aislamiento: la lista de baloncesto es exactamente la NBA', () => {
  assert.deepEqual(competitionIdsOfSport('baloncesto'), [NBA_COMPETITION_ID])
})

test('aislamiento: tenis activa exactamente ATP (WTA sigue pendiente de fuente)', () => {
  assert.deepEqual(competitionIdsOfSport('tenis'), [ATP_COMPETITION_ID])
  assert.ok(!competitionIdsOfSport('tenis').includes(WTA_COMPETITION_ID), 'WTA no activa aún')
  // y jamás cruza con los otros deportes
  assert.ok(!competitionIdsOfSport('futbol').includes(ATP_COMPETITION_ID))
  assert.ok(!competitionIdsOfSport('baloncesto').includes(ATP_COMPETITION_ID))
})

test('sportOfCompetition clasifica NBA como baloncesto y Mundial como fútbol', () => {
  assert.equal(sportOfCompetition(NBA_COMPETITION_ID), 'baloncesto')
  assert.equal(sportOfCompetition(COMPETITION_ID), 'futbol')
})

test('las listas por deporte particionan las competiciones sin solaparse', () => {
  const futbol = new Set(competitionIdsOfSport('futbol'))
  const basket = new Set(competitionIdsOfSport('baloncesto'))
  const tenis = new Set(competitionIdsOfSport('tenis'))
  // Lo que importa del aislamiento es que NO se crucen deportes...
  for (const id of basket) assert.ok(!futbol.has(id), 'sin solape fútbol/baloncesto')
  for (const id of tenis) assert.ok(!futbol.has(id), 'sin solape fútbol/tenis')
  for (const id of tenis) assert.ok(!basket.has(id), 'sin solape baloncesto/tenis')
  // ...y que juntas cubran lo activo más el histórico de ligas por temporada.
  const total = futbol.size + basket.size + tenis.size
  const activasConId = ACTIVE_COMPETITIONS.filter((c) => c.id).length
  const historicasDeLiga = ALL_LEAGUE_COMPETITION_IDS.length - Object.keys(LEAGUE_SLUGS).length
  assert.equal(total, activasConId + historicasDeLiga)
})
