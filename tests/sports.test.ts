/**
 * Tests del registro multi-deporte: la lista blanca por deporte es la
 * barrera que impide que procesos transversales (Smart Bets, syncs)
 * crucen partidos entre deportes. Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { competitionIdsOfSport, sportOfCompetition, COMPETITIONS_NAV } from '../lib/sports'
import { COMPETITION_ID, LEAGUE_SLUGS, ALL_LEAGUE_COMPETITION_IDS, LIBERTADORES_COMPETITION_ID } from '../lib/constants'
import { NBA_COMPETITION_ID } from '../lib/nba/constants'
import { ATP_COMPETITION_ID, WTA_COMPETITION_ID } from '../lib/tennis/constants'

test('aislamiento: la lista de fútbol incluye las ligas y la Libertadores, nunca NBA ni tenis', () => {
  const futbol = competitionIdsOfSport('futbol')
  for (const id of Object.values(LEAGUE_SLUGS)) {
    assert.ok(futbol.includes(id), `debe incluir la liga ${id}`)
  }
  assert.ok(!futbol.includes(NBA_COMPETITION_ID), 'JAMÁS debe incluir la NBA')
  assert.ok(!futbol.includes(ATP_COMPETITION_ID), 'JAMÁS debe incluir el tenis')
  // El Mundial NO está: se archivó, y archivar es salir de los procesos
  // transversales además de salir del sitio (ver archivedCompetitions.test.ts).
  assert.ok(!futbol.includes(COMPETITION_ID),
    'el Mundial está archivado: no debe procesarse')
  // Copa Libertadores + TODAS las competiciones de liga (una por liga y
  // temporada): la lista blanca debe cubrir también las campañas históricas,
  // o los procesos transversales dejarían de ver esos partidos al cambiar de
  // temporada. Se deriva del registro: añadir una liga o temporada no rompe
  // el test.
  assert.ok(futbol.includes(LIBERTADORES_COMPETITION_ID), 'debe incluir Copa Libertadores')
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
  // ...y que juntas cubran TODO lo que se procesa: competiciones activas o
  // históricas del registro más las temporadas anteriores de cada liga. Fuera
  // quedan las 'proximamente' (aún no existen) y las 'archivada' (existen
  // pero ya no se tocan).
  const total = futbol.size + basket.size + tenis.size
  const procesables = COMPETITIONS_NAV.filter(
    (c) => c.id && c.status !== 'proximamente' && c.status !== 'archivada').length
  const temporadasHistoricasDeLiga = ALL_LEAGUE_COMPETITION_IDS.length - Object.keys(LEAGUE_SLUGS).length
  assert.equal(total, procesables + temporadasHistoricasDeLiga)
})

// ─── Escudos de competición ──────────────────────────────────────────────────

test('todo escudo declarado en el registro existe en public/', () => {
  // Una ruta declarada sin archivo detrás no rompe el build ni el
  // type-check: se manifiesta como un hueco en la navegación que solo se ve
  // mirando la página. Este test lo convierte en un fallo de `npm test`.
  const { existsSync } = require('node:fs') as typeof import('node:fs')
  const { join } = require('node:path') as typeof import('node:path')

  const conEscudo = COMPETITIONS_NAV.filter((c) => c.logo)
  assert.ok(conEscudo.length >= 8, 'deberían tener escudo las 7 de fútbol y la NBA')

  for (const c of conEscudo) {
    assert.ok(c.logo!.startsWith('/competiciones/'),
      `${c.slug}: el escudo debe servirse desde /competiciones/`)
    const file = join(__dirname, '..', 'public', c.logo!)
    assert.ok(existsSync(file), `${c.slug}: falta el archivo ${c.logo}`)
  }
})

test('las competiciones sin fuente de escudo lo declaran ausente, no roto', () => {
  // ATP y WTA: ninguna de nuestras fuentes publica un escudo del circuito que
  // podamos servir, así que van sin `logo` y caen a su icono. Si algún día
  // aparece uno, este test es el recordatorio de dónde ponerlo.
  for (const slug of ['atp', 'wta']) {
    const c = COMPETITIONS_NAV.find((x) => x.slug === slug)
    assert.ok(c, `falta ${slug} en el registro`)
    assert.equal(c!.logo, undefined, `${slug}: sin fuente de escudo, debe ir sin logo`)
  }
})
