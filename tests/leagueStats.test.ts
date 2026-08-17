/**
 * Tests del normalizado de boxscores de API-Football.
 * El riesgo real aquí no es la red, es el parseo: la fuente mezcla números,
 * porcentajes como texto y nulos, y un NaN colado en la BD contamina medias.
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { fetchFixtureStatistics } from '../services/sync/api-football'

/** Sustituye fetch por una respuesta fija de la API. Devuelve el restaurador. */
function stubFetch(payload: any) {
  const original = globalThis.fetch
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => payload,
  })) as any
  return () => { globalThis.fetch = original }
}

const ENV = { SPORTS_API_KEY: 'test-key', SPORTS_API_HOST: 'v3.football.api-sports.io' }
function withEnv<T>(fn: () => T): T {
  const prev = { ...process.env }
  Object.assign(process.env, ENV)
  try { return fn() } finally { process.env = prev as any }
}

test('mapea los nombres de la fuente a nuestras columnas', async () => {
  const restore = stubFetch({
    response: [{
      team: { id: 33, name: 'Manchester United' },
      statistics: [
        { type: 'Ball Possession', value: '52%' },
        { type: 'Total Shots', value: 14 },
        { type: 'Shots on Goal', value: 6 },
        { type: 'Corner Kicks', value: 7 },
        { type: 'Fouls', value: 11 },
        { type: 'Yellow Cards', value: 2 },
        { type: 'Red Cards', value: null },
        { type: 'Passes %', value: '84%' },
        { type: 'expected_goals', value: '1.85' },
        { type: 'Goalkeeper Saves', value: 3 },
      ],
    }],
  })
  try {
    const [s] = await withEnv(() => fetchFixtureStatistics(12345))
    assert.equal(s.apiTeamId, 33)
    assert.equal(s.possession, 52)      // "52%" → 52
    assert.equal(s.shots, 14)
    assert.equal(s.shots_on_target, 6)
    assert.equal(s.corners, 7)
    assert.equal(s.fouls, 11)
    assert.equal(s.yellow_cards, 2)
    assert.equal(s.pass_accuracy, 84)
    assert.equal(s.xg, 1.85)            // texto decimal → número
    assert.equal(s.saves, 3)
  } finally { restore() }
})

test('un valor nulo o vacío se queda en null, nunca en NaN ni en cero', async () => {
  const restore = stubFetch({
    response: [{
      team: { id: 40, name: 'Liverpool' },
      statistics: [
        { type: 'Red Cards', value: null },
        { type: 'Ball Possession', value: '' },
        { type: 'Total Shots', value: '—' },
        { type: 'expected_goals', value: null },
      ],
    }],
  })
  try {
    const [s] = await withEnv(() => fetchFixtureStatistics(1))
    // Cero y null NO son lo mismo: cero es un dato, null es su ausencia
    assert.equal(s.red_cards, null)
    assert.equal(s.possession, null)
    assert.equal(s.shots, null)
    assert.equal(s.xg, null)
    assert.ok(!Number.isNaN(s.shots as any))
  } finally { restore() }
})

test('lo que la fuente no entrega no se inventa', async () => {
  const restore = stubFetch({
    response: [{
      team: { id: 50, name: 'Man City' },
      statistics: [{ type: 'Corner Kicks', value: 9 }],
    }],
  })
  try {
    const [s] = await withEnv(() => fetchFixtureStatistics(2))
    assert.equal(s.corners, 9)
    // API-Football no da ocasiones claras: quedan ausentes, no en 0
    assert.equal((s as any).big_chances, undefined)
    assert.equal(s.shots, null)
    assert.equal(s.offsides, null)
  } finally { restore() }
})

test('una estadística desconocida se ignora sin romper el resto', async () => {
  const restore = stubFetch({
    response: [{
      team: { id: 60, name: 'Arsenal' },
      statistics: [
        { type: 'Inventada Por La Fuente', value: 999 },
        { type: 'Corner Kicks', value: 4 },
      ],
    }],
  })
  try {
    const [s] = await withEnv(() => fetchFixtureStatistics(3))
    assert.equal(s.corners, 4)
    assert.equal(Object.values(s).includes(999 as any), false)
  } finally { restore() }
})

test('un partido sin estadísticas devuelve lista vacía, no filas en blanco', async () => {
  const restore = stubFetch({ response: [] })
  try {
    assert.deepEqual(await withEnv(() => fetchFixtureStatistics(4)), [])
  } finally { restore() }
})
