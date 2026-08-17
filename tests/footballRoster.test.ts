/**
 * Tests de la ingesta de plantillas, lesiones y alineaciones.
 *
 * Se prueban los traductores puros y el limitador de ritmo. Lo que toca red
 * o base de datos no se simula: se verifica corriéndolo de verdad contra la
 * fuente, que es donde aparecen los problemas que un mock nunca reproduce.
 *
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { toPositionEnum, toInjuryType, parseGrid } from '../services/sync/football-roster'
import {
  acquire, configureLimit, currentUsage, resetLimits, __setClock,
} from '../services/sports/core/rateLimit'

// ─── Posiciones ──────────────────────────────────────────────────────────────

test('toPositionEnum solo traduce la equivalencia EXACTA', () => {
  // API-Football distingue cuatro grupos; nuestro enum exige CB/LB/RB/CDM…
  // Convertir "Defender" en "CB" sería inventar precisión, así que queda null
  // y el texto original se guarda aparte en position_raw.
  assert.equal(toPositionEnum('Goalkeeper'), 'GK')
  assert.equal(toPositionEnum('goalkeeper'), 'GK')
  assert.equal(toPositionEnum('Defender'), null)
  assert.equal(toPositionEnum('Midfielder'), null)
  assert.equal(toPositionEnum('Attacker'), null)
  assert.equal(toPositionEnum(null), null)
})

// ─── Partes médicos ──────────────────────────────────────────────────────────

test('toInjuryType clasifica los partes reales de la fuente', () => {
  assert.equal(toInjuryType('Knee Injury'), 'other')       // "knee" a secas no dice el tejido
  assert.equal(toInjuryType('Cruciate Ligament Rupture'), 'ligament')
  assert.equal(toInjuryType('Hamstring Injury'), 'muscular')
  assert.equal(toInjuryType('Muscle Injury'), 'muscular')
  assert.equal(toInjuryType('Groin Strain'), 'muscular')
  assert.equal(toInjuryType('Broken Ankle'), 'fracture')
  assert.equal(toInjuryType('Illness'), 'illness')
  assert.equal(toInjuryType('Suspended'), 'suspension')
  assert.equal(toInjuryType('Red Card'), 'suspension')
})

test('toInjuryType nunca falla ante un parte vacío o desconocido', () => {
  assert.equal(toInjuryType(null), 'other')
  assert.equal(toInjuryType(''), 'other')
  assert.equal(toInjuryType('Algo que la fuente no había publicado antes'), 'other')
})

test('la suspensión gana a la lesión cuando el texto menciona ambas', () => {
  // Un jugador suspendido no está lesionado; el orden de las reglas importa.
  assert.equal(toInjuryType('Suspended after muscle injury dispute'), 'suspension')
})

// ─── Rejilla táctica ─────────────────────────────────────────────────────────

test('parseGrid lee la posición "fila:columna" de API-Football', () => {
  assert.deepEqual(parseGrid('1:1'), { x: 1, y: 1 })   // portero
  assert.deepEqual(parseGrid('4:2'), { x: 4, y: 2 })
  assert.deepEqual(parseGrid(' 3:5 '), { x: 3, y: 5 })
})

test('parseGrid devuelve null para los suplentes, que no tienen sitio en el campo', () => {
  assert.equal(parseGrid(null), null)
  assert.equal(parseGrid(''), null)
})

test('parseGrid rechaza lo que violaría los CHECK de la migración 057', () => {
  // Mejor guardar la ficha sin rejilla que tumbar la ingesta entera de un
  // partido por una coordenada imposible.
  assert.equal(parseGrid('9:1'), null)   // fila > 8
  assert.equal(parseGrid('1:12'), null)  // columna > 11
  assert.equal(parseGrid('0:3'), null)
  assert.equal(parseGrid('abc'), null)
  assert.equal(parseGrid('4-2'), null)
})

// ─── Limitador de ritmo ──────────────────────────────────────────────────────

test('el limitador deja pasar hasta el techo sin esperar', async () => {
  resetLimits()
  let clock = 1_000_000
  const restore = __setClock(() => clock)
  try {
    configureLimit('prueba', 3, 60_000)
    const t0 = Date.now()
    await acquire('prueba')
    await acquire('prueba')
    await acquire('prueba')
    assert.ok(Date.now() - t0 < 100, 'por debajo del techo no debe esperar')
    assert.deepEqual(currentUsage('prueba'), { used: 3, limit: 3 })
  } finally {
    restore(); resetLimits()
  }
})

test('la ventana se vacía al pasar el tiempo', async () => {
  resetLimits()
  let clock = 1_000_000
  const restore = __setClock(() => clock)
  try {
    configureLimit('prueba', 2, 60_000)
    await acquire('prueba')
    await acquire('prueba')
    assert.equal(currentUsage('prueba')?.used, 2)

    clock += 61_000 // pasa la ventana entera
    assert.equal(currentUsage('prueba')?.used, 0, 'las marcas viejas caducan')
    await acquire('prueba')
    assert.equal(currentUsage('prueba')?.used, 1)
  } finally {
    restore(); resetLimits()
  }
})

test('el limitador espera de verdad cuando la ventana está llena', async () => {
  resetLimits()
  // Reloj real y ventana corta: lo que se comprueba es que BLOQUEA, no que
  // lleve bien la cuenta (eso ya lo cubren los tests anteriores).
  configureLimit('lento', 2, 300)
  const t0 = Date.now()
  await acquire('lento')
  await acquire('lento')
  await acquire('lento') // la tercera tiene que esperar a que expire la primera
  const elapsed = Date.now() - t0
  assert.ok(elapsed >= 250, `debería haber esperado ~300 ms, esperó ${elapsed} ms`)
  resetLimits()
})

test('sin límite declarado el limitador no estorba', async () => {
  resetLimits()
  const t0 = Date.now()
  for (let i = 0; i < 50; i++) await acquire('sin-limite')
  assert.ok(Date.now() - t0 < 100)
  assert.equal(currentUsage('sin-limite'), null)
})

test('configureLimit es idempotente: no reinicia el contador', async () => {
  resetLimits()
  let clock = 1_000_000
  const restore = __setClock(() => clock)
  try {
    configureLimit('idem', 5, 60_000)
    await acquire('idem')
    await acquire('idem')
    // Un segundo módulo que importa el cliente no debe borrar lo ya contado.
    configureLimit('idem', 5, 60_000)
    assert.equal(currentUsage('idem')?.used, 2)
  } finally {
    restore(); resetLimits()
  }
})
