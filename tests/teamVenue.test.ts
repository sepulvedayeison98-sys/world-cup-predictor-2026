/**
 * Tests de la captura de estadio y fundación (Fase 1: el equipo como
 * entidad independiente). Los datos vienen GRATIS dentro de la misma
 * respuesta de /teams que la ingesta de ligas ya pedía — el riesgo es el
 * parseo, no la red.
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { fetchLeagueTeams } from '../services/sync/api-football'

function stubFetch(payload: any) {
  const original = globalThis.fetch
  globalThis.fetch = (async () => ({ ok: true, json: async () => payload })) as any
  return () => { globalThis.fetch = original }
}

const ENV = { SPORTS_API_KEY: 'test-key', SPORTS_API_HOST: 'v3.football.api-sports.io' }
function withEnv<T>(fn: () => T): T {
  const prev = { ...process.env }
  Object.assign(process.env, ENV)
  try { return fn() } finally { process.env = prev as any }
}

test('captura estadio, ciudad, aforo, imagen y fundación', async () => {
  const restore = stubFetch({
    response: [{
      team: { id: 33, name: 'Manchester United', code: 'MUN', logo: 'x.png', founded: 1878 },
      venue: { name: 'Old Trafford', city: 'Manchester', capacity: 74879, image: 'v.png' },
    }],
  })
  try {
    const [t] = await withEnv(() => fetchLeagueTeams(39, 2026))
    assert.equal(t.founded, 1878)
    assert.equal(t.venueName, 'Old Trafford')
    assert.equal(t.venueCity, 'Manchester')
    assert.equal(t.venueCapacity, 74879)
    assert.equal(t.venueImage, 'v.png')
  } finally { restore() }
})

test('fundación 0 (la fuente no la conoce) se normaliza a null, no a un año falso', async () => {
  const restore = stubFetch({
    response: [{
      team: { id: 1, name: 'Recién Ascendido', code: null, logo: 'x.png', founded: 0 },
      venue: { name: null, city: null, capacity: null, image: null },
    }],
  })
  try {
    const [t] = await withEnv(() => fetchLeagueTeams(39, 2026))
    assert.equal(t.founded, null)
    assert.notEqual(t.founded, 0)
  } finally { restore() }
})

test('sin objeto venue en la respuesta no revienta, todo queda en null', async () => {
  const restore = stubFetch({
    response: [{ team: { id: 2, name: 'Equipo Sin Venue', code: null, logo: 'x.png', founded: 1950 } }],
  })
  try {
    const [t] = await withEnv(() => fetchLeagueTeams(39, 2026))
    assert.equal(t.founded, 1950)
    assert.equal(t.venueName, null)
    assert.equal(t.venueCapacity, null)
  } finally { restore() }
})
