/**
 * Tests del agrupado por jornada de la tabla de partidos.
 *
 * Lo delicado no es el formato, es la ZONA HORARIA: la plataforma publica
 * horarios de Colombia, y un partido que empieza a las 00:30 COL ocurre a
 * las 05:30 UTC del día siguiente. Agrupar por el día UTC partiría la
 * jornada en dos y colocaría la madrugada colombiana bajo la fecha
 * equivocada.
 *
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { claveDia, diaLargo } from '../components/matches/MatchesTable'

test('claveDia agrupa por el día de Bogotá, no por el de UTC', () => {
  // 05:30 UTC del 24 = 00:30 COL del 24. Mismo día en las dos zonas.
  assert.equal(claveDia('2026-08-24T05:30:00Z'), '2026-08-24')
  // 02:00 UTC del 24 = 21:00 COL del 23. En UTC sería día 24; aquí, 23.
  assert.equal(claveDia('2026-08-24T02:00:00Z'), '2026-08-23')
  // Justo al filo: 04:59 UTC sigue siendo el 23 en Colombia (UTC-5).
  assert.equal(claveDia('2026-08-24T04:59:00Z'), '2026-08-23')
  assert.equal(claveDia('2026-08-24T05:00:00Z'), '2026-08-24')
})

test('dos partidos de la misma jornada colombiana comparten clave', () => {
  // Tarde del 23 y madrugada del 23 → una sola cabecera de día.
  const tarde = claveDia('2026-08-23T22:00:00Z')   // 17:00 COL
  const noche = claveDia('2026-08-24T02:05:00Z')   // 21:05 COL, aún día 23
  assert.equal(tarde, noche)
})

test('partidos de días distintos NO comparten clave', () => {
  assert.notEqual(claveDia('2026-08-23T22:00:00Z'), claveDia('2026-08-24T22:00:00Z'))
})

test('diaLargo escribe la fecha como se escribe en español', () => {
  const t = diaLargo('2026-08-23T22:00:00Z')
  // Mayúscula solo en la primera letra: "Domingo 23 de agosto", nunca
  // "Domingo 23 De Agosto" (que es lo que haría `capitalize` en CSS).
  assert.match(t, /^[A-ZÁÉÍÓÚÑ]/)
  assert.ok(t.includes('23'), `debe llevar el día: "${t}"`)
  assert.ok(t.includes('agosto'), `debe llevar el mes en minúscula: "${t}"`)
  assert.ok(!/ De /.test(t), `el "de" va en minúscula: "${t}"`)
})

test('diaLargo usa la fecha de Bogotá, coherente con claveDia', () => {
  // 02:00 UTC del 24 es el 23 en Colombia: la cabecera debe decir 23.
  assert.ok(diaLargo('2026-08-24T02:00:00Z').includes('23'))
})
