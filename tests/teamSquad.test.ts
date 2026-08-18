/**
 * Tests de la plantilla del perfil de equipo.
 *
 * Cubren los dos traductores que hacen legible un dato que llega sucio: el
 * puesto (que la fuente publica en cuatro formatos distintos) y el motivo de
 * la baja (que llega en inglés y con una cola larga de variantes).
 *
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { positionGroup, reasonLabel } from '../components/teams/TeamSquad'

// ─── Puestos ─────────────────────────────────────────────────────────────────

test('positionGroup absorbe los cuatro formatos que hay en la base', () => {
  // `/players/squads` da la palabra completa…
  assert.equal(positionGroup('Goalkeeper'), 'gk')
  assert.equal(positionGroup('Defender'), 'df')
  assert.equal(positionGroup('Midfielder'), 'mf')
  assert.equal(positionGroup('Attacker'), 'fw')
  // …las fichas creadas desde una alineación traen la inicial…
  assert.equal(positionGroup('G'), 'gk')
  assert.equal(positionGroup('D'), 'df')
  assert.equal(positionGroup('M'), 'mf')
  assert.equal(positionGroup('F'), 'fw')
  // …y hay un puñado de "Forward" sueltos.
  assert.equal(positionGroup('Forward'), 'fw')
})

test('positionGroup no distingue mayúsculas ni espacios sobrantes', () => {
  assert.equal(positionGroup('  goalkeeper '), 'gk')
  assert.equal(positionGroup('DEFENDER'), 'df')
})

test('sin puesto, el jugador va a su propio grupo y no se le asigna uno', () => {
  // 15 jugadores en base no traen puesto. Colarlos en "Defensas" porque sí
  // sería inventarles una posición.
  assert.equal(positionGroup(null), 'na')
  assert.equal(positionGroup(''), 'na')
  assert.equal(positionGroup('   '), 'na')
  assert.equal(positionGroup('Sweeper'), 'na')
})

// ─── Motivos de baja ─────────────────────────────────────────────────────────

test('reasonLabel traduce los motivos que no son lesión', () => {
  assert.equal(reasonLabel('Suspended'), 'Sancionado')
  assert.equal(reasonLabel('Red Card'), 'Expulsión')
  assert.equal(reasonLabel('Coach Decision'), 'Decisión técnica')
  assert.equal(reasonLabel('Illness'), 'Enfermedad')
})

test('reasonLabel resuelve el patrón «<parte> Injury» por la parte del cuerpo', () => {
  assert.equal(reasonLabel('Knee Injury'), 'Rodilla')
  assert.equal(reasonLabel('Ribs Injury'), 'Costillas')
  assert.equal(reasonLabel('Hamstring Injury'), 'Isquiotibiales')
  assert.equal(reasonLabel('Muscle Injury'), 'Muscular')
  assert.equal(reasonLabel('Achilles Injury'), 'Tendón de Aquiles')
  // También «Problem» y «Strain», que la fuente usa de vez en cuando.
  assert.equal(reasonLabel('Groin Strain'), 'Aductor')
  assert.equal(reasonLabel('Back Problem'), 'Espalda')
})

test('«Injury» a secas es una lesión sin detallar, no una parte del cuerpo', () => {
  assert.equal(reasonLabel('Injury'), 'Lesión')
})

test('un motivo desconocido se muestra TAL CUAL, no se generaliza', () => {
  // Es la regla que evita borrar información: si mañana la fuente publica
  // algo que no tenemos mapeado, el usuario lee lo que dice la fuente en
  // lugar de un "Lesión" que no distingue nada.
  assert.equal(reasonLabel('Quadriceps Tendinopathy'), 'Quadriceps Tendinopathy')
  assert.equal(reasonLabel('Loan Restriction'), 'Loan Restriction')
})

test('reasonLabel devuelve null cuando no hay motivo', () => {
  assert.equal(reasonLabel(null), null)
  assert.equal(reasonLabel(''), null)
  assert.equal(reasonLabel('   '), null)
})
