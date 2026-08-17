/**
 * Tests de la capa de proveedores deportivos (services/sports).
 *
 * Todo lo de aquí es OFFLINE y determinista: se prueban los traductores y la
 * política de la cadena de proveedores, no las APIs. Que las fuentes sigan
 * respondiendo lo comprueba `npm run verify:providers`, que sí sale a la red.
 *
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ProviderError, kindFromStatus, userMessage, redactUrl, isProviderError,
} from '../services/sports/core/errors'
import { memo, invalidate, clearMemo, memoSize, cacheKey, TTL, __setClock } from '../services/sports/core/cache'
import { runChain } from '../services/sports/core/resolve'
import { supports } from '../services/sports/core/ports'
import type { SportsProvider } from '../services/sports/core/ports'
import type { Capability, Sourced } from '../services/sports/core/types'
import { mapMarket } from '../services/sports/providers/the-odds-api/odds.provider'
import { countryFromFlag } from '../services/sports/providers/espn/tennis.provider'
import { parseRecord, toStanding, toFixtureStatus, statMap } from '../services/sports/providers/espn/normalize'
import { resolveScope, NEWS_SCOPES } from '../services/sports/providers/espn/news.provider'

// ─── Taxonomía de errores ────────────────────────────────────────────────────

test('kindFromStatus clasifica los códigos HTTP que importan', () => {
  assert.equal(kindFromStatus(401), 'auth')
  assert.equal(kindFromStatus(403), 'auth')
  assert.equal(kindFromStatus(404), 'not_found')
  assert.equal(kindFromStatus(429), 'rate_limit')
  assert.equal(kindFromStatus(500), 'unavailable')
  assert.equal(kindFromStatus(503), 'unavailable')
  assert.equal(kindFromStatus(418), 'upstream')
})

test('solo son reintentables los fallos que pueden resolverse esperando', () => {
  const mk = (kind: any) => new ProviderError({ kind, provider: 'espn', endpoint: '/x' })
  for (const k of ['rate_limit', 'timeout', 'unavailable']) {
    assert.equal(mk(k).retryable, true, `${k} debería reintentarse`)
  }
  // Reintentar estos sería quemar cuota sin ninguna posibilidad de éxito.
  for (const k of ['auth', 'config', 'not_found', 'parse', 'upstream']) {
    assert.equal(mk(k).retryable, false, `${k} NO debería reintentarse`)
  }
})

test('los mensajes al usuario no filtran detalle técnico', () => {
  const kinds = ['config', 'auth', 'rate_limit', 'not_found', 'timeout', 'unavailable', 'parse', 'upstream'] as const
  for (const kind of kinds) {
    const msg = userMessage(new ProviderError({ kind, provider: 'api-football', endpoint: '/teams', status: 429 }))
    assert.ok(msg.length > 0, 'debe haber mensaje')
    // Ni códigos HTTP, ni nombres de proveedor, ni rutas de la API.
    assert.ok(!/HTTP|\d{3}|api-football|espn|the-odds-api|\/teams|undefined/.test(msg),
      `mensaje con detalle técnico para ${kind}: "${msg}"`)
  }
  // Un error cualquiera tampoco debe reventar ni escupir su stack.
  assert.equal(typeof userMessage(new Error('boom')), 'string')
  assert.equal(typeof userMessage('cadena suelta'), 'string')
})

test('redactUrl borra la clave de The Odds API, que viaja en el query string', () => {
  const url = 'https://api.the-odds-api.com/v4/sports/soccer_epl/odds?apiKey=SECRETO123&regions=eu'
  const safe = redactUrl(url)
  assert.ok(!safe.includes('SECRETO123'), 'la clave no puede sobrevivir a la redacción')
  assert.ok(safe.includes('regions=eu'), 'el resto de parámetros se conserva')
  // Una URL rota no debe lanzar: se devuelve tal cual.
  assert.equal(redactUrl('no-es-una-url'), 'no-es-una-url')
})

test('isProviderError distingue nuestros errores de los ajenos', () => {
  assert.equal(isProviderError(new ProviderError({ kind: 'timeout', provider: 'espn', endpoint: '/x' })), true)
  assert.equal(isProviderError(new Error('otro')), false)
  assert.equal(isProviderError(null), false)
})

// ─── Caché ───────────────────────────────────────────────────────────────────

test('memo sirve el valor cacheado hasta que expira el TTL', async () => {
  clearMemo()
  let clock = 1_000_000
  const restore = __setClock(() => clock)
  try {
    let calls = 0
    const fetcher = async () => { calls++; return calls }

    assert.equal(await memo('k', 10, fetcher), 1)
    assert.equal(await memo('k', 10, fetcher), 1, 'dentro del TTL no se vuelve a pedir')
    assert.equal(calls, 1)

    clock += 11_000 // pasan 11 s, el TTL era 10
    assert.equal(await memo('k', 10, fetcher), 2, 'expirado el TTL se pide de nuevo')
    assert.equal(calls, 2)
  } finally {
    restore()
    clearMemo()
  }
})

test('memo comparte una sola petición entre llamadas concurrentes', async () => {
  clearMemo()
  let calls = 0
  const slow = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return 'v' }
  const [a, b, c] = await Promise.all([memo('c', 60, slow), memo('c', 60, slow), memo('c', 60, slow)])
  assert.deepEqual([a, b, c], ['v', 'v', 'v'])
  assert.equal(calls, 1, 'tres llamadas simultáneas → una sola petición de red')
  clearMemo()
})

test('un fallo no se cachea: la siguiente llamada puede reintentar', async () => {
  clearMemo()
  let calls = 0
  const flaky = async () => {
    calls++
    if (calls === 1) throw new Error('fallo transitorio')
    return 'ok'
  }
  await assert.rejects(() => memo('f', 60, flaky))
  assert.equal(await memo('f', 60, flaky), 'ok', 'el error no debe quedar cacheado')
  assert.equal(calls, 2)
  clearMemo()
})

test('invalidate borra por prefijo sin tocar familias vecinas', async () => {
  clearMemo()
  await memo('futbol:standings:39', 60, async () => 1)
  await memo('futbol:standings:140', 60, async () => 2)
  await memo('nba:standings', 60, async () => 3)
  assert.equal(memoSize(), 3)
  assert.equal(invalidate('futbol:standings'), 2)
  assert.equal(memoSize(), 1, 'la clave de NBA sobrevive')
  clearMemo()
})

test('cacheKey ignora huecos para que no se dupliquen entradas equivalentes', () => {
  assert.equal(cacheKey(['futbol', 'teams', 39, undefined]), 'futbol:teams:39')
  assert.equal(cacheKey(['futbol', 'teams', 39, null, '']), 'futbol:teams:39')
})

test('los TTL respetan la jerarquía de volatilidad del dato', () => {
  // Es la invariante que justifica tener política por clase en vez de un número.
  assert.ok(TTL.live < TTL.odds, 'un marcador caduca antes que una cuota')
  assert.ok(TTL.odds < TTL.standings)
  assert.ok(TTL.standings < TTL.schedule)
  assert.ok(TTL.schedule < TTL.roster)
  assert.ok(TTL.roster < TTL.catalog)
  assert.ok(TTL.catalog < TTL.static)
  assert.ok(TTL.static <= TTL.historical, 'lo ya jugado es inmutable')
})

// ─── Cadena de proveedores ───────────────────────────────────────────────────

function fakeProvider(id: any, caps: Capability[]): SportsProvider {
  return { id, capabilities: new Set(caps), quotaCostPerCall: 1 }
}

const sourced = <T>(data: T): Sourced<T> => ({
  data,
  provenance: { provider: 'espn', endpoint: '/fake', fetchedAt: '2026-08-17T00:00:00.000Z' },
})

test('sin ningún proveedor capaz, el resultado es «unsupported», no una lista vacía', async () => {
  const r = await runChain({
    chain: [fakeProvider('espn', ['teams'])],
    capability: 'injuries',
    run: () => Promise.resolve(sourced([])),
    unsupportedReason: 'ESPN no publica lesiones.',
  })
  assert.equal(r.status, 'unsupported')
  if (r.status === 'unsupported') assert.match(r.reason, /no publica lesiones/)
})

test('un fallo reintentable cae al siguiente proveedor de la cadena', async () => {
  const primary = fakeProvider('api-football', ['teams'])
  const backup = fakeProvider('espn', ['teams'])
  let usedBackup = false

  const r = await runChain({
    chain: [primary, backup],
    capability: 'teams',
    run: (p) => {
      if (p.id === 'api-football') {
        return Promise.reject(new ProviderError({ kind: 'rate_limit', provider: 'api-football', endpoint: '/teams' }))
      }
      usedBackup = true
      return Promise.resolve(sourced(['Arsenal']))
    },
  })

  assert.equal(usedBackup, true, 'el respaldo debe entrar cuando el primario agota cuota')
  assert.equal(r.status, 'ok')
  if (r.status === 'ok') assert.deepEqual(r.data, ['Arsenal'])
})

test('un «not_found» NO cae al respaldo: el recurso no existe en ninguna fuente', async () => {
  let backupCalls = 0
  const r = await runChain({
    chain: [fakeProvider('api-football', ['team']), fakeProvider('espn', ['team'])],
    capability: 'team',
    run: (p) => {
      if (p.id === 'api-football') {
        return Promise.reject(new ProviderError({ kind: 'not_found', provider: 'api-football', endpoint: '/teams' }))
      }
      backupCalls++
      return Promise.resolve(sourced('no debería llegar aquí'))
    },
  })
  assert.equal(backupCalls, 0, 'preguntar a otra fuente por algo inexistente es gastar cuota')
  assert.equal(r.status, 'error')
})

test('si todos fallan se devuelve el error del primario, que es el que explica mejor', async () => {
  const r = await runChain({
    chain: [fakeProvider('api-football', ['teams']), fakeProvider('espn', ['teams'])],
    capability: 'teams',
    run: (p) => Promise.reject(new ProviderError({
      kind: p.id === 'api-football' ? 'rate_limit' : 'unavailable',
      provider: p.id, endpoint: '/teams',
    })),
  })
  assert.equal(r.status, 'error')
  if (r.status === 'error') {
    assert.equal(r.provider, 'api-football')
    assert.equal(r.retryable, true)
  }
})

test('runChain nunca lanza: convierte cualquier excepción en un resultado', async () => {
  const r = await runChain({
    chain: [fakeProvider('espn', ['news'])],
    capability: 'news',
    run: () => Promise.reject(new TypeError('algo raro del runtime')),
  })
  assert.equal(r.status, 'error')
  if (r.status === 'error') assert.equal(r.retryable, false)
})

test('supports lee las capacidades declaradas', () => {
  const p = fakeProvider('espn', ['teams', 'standings'])
  assert.equal(supports(p, 'teams'), true)
  assert.equal(supports(p, 'injuries'), false)
})

// ─── Traductores: The Odds API ───────────────────────────────────────────────

test('mapMarket resuelve el 1X2 comparando con los nombres reales de los equipos', () => {
  const home = 'Manchester United'
  const away = 'Liverpool'
  assert.equal(mapMarket('h2h', { name: home, price: 2.1 }, home, away), 'home_win')
  assert.equal(mapMarket('h2h', { name: away, price: 3.2 }, home, away), 'away_win')
  assert.equal(mapMarket('h2h', { name: 'Draw', price: 3.4 }, home, away), 'draw')
  // Un equipo que no es ninguno de los dos no se fuerza a un mercado.
  assert.equal(mapMarket('h2h', { name: 'Everton', price: 5 }, home, away), null)
})

test('mapMarket solo acepta las líneas de goles que el modelo conoce', () => {
  const m = (name: string, point: number) => mapMarket('totals', { name, price: 1.9, point }, 'A', 'B')
  assert.equal(m('Over', 2.5), 'over_2_5')
  assert.equal(m('Under', 2.5), 'under_2_5')
  assert.equal(m('Over', 1.5), 'over_1_5')
  // 3.5 existe en el mercado pero no en nuestro enum: se descarta, no se
  // redondea a 2.5, que sería inventar una línea distinta.
  assert.equal(m('Over', 3.5), null)
})

// ─── Traductores: ESPN ───────────────────────────────────────────────────────

test('countryFromFlag acepta las DOS formas que usa ESPN', () => {
  // Ranking: string suelto. Marcador: objeto. Cubrir solo una dejaba el país
  // en null la mitad de las veces (lo detectó la verificación en vivo).
  assert.equal(countryFromFlag('https://a.espncdn.com/i/teamlogos/countries/500/ita.png'), 'ITA')
  assert.equal(countryFromFlag({ href: 'https://a.espncdn.com/i/teamlogos/countries/500/esp.png' }), 'ESP')
  assert.equal(countryFromFlag(undefined), null)
  assert.equal(countryFromFlag('https://a.espncdn.com/otra/cosa.png'), null)
})

test('statMap descarta lo que no es número finito', () => {
  const m = statMap([
    { name: 'wins', value: 12 },
    { name: 'roto', value: undefined },
    { name: 'nan', value: Number.NaN },
    { name: undefined, value: 5 },
  ])
  assert.deepEqual(m, { wins: 12 })
  assert.equal('roto' in m, false, 'ausente ≠ cero')
})

test('parseRecord distingue deportes con empate de los que no lo tienen', () => {
  const soccer = parseRecord('12-5-3', true)
  assert.deepEqual({ played: soccer?.played, won: soccer?.won, drawn: soccer?.drawn, lost: soccer?.lost },
    { played: 20, won: 12, drawn: 5, lost: 3 })

  const nba = parseRecord('60-22', false)
  assert.equal(nba?.won, 60)
  assert.equal(nba?.lost, 22)
  assert.equal(nba?.drawn, null, 'en la NBA no hay empates: null, nunca 0')

  assert.equal(parseRecord(null, true), null)
  assert.equal(parseRecord('sin-formato', true), null)
})

test('toStanding no inventa puntos ni empates en la NBA', () => {
  const entry = {
    team: { id: '13', displayName: 'Los Angeles Lakers' },
    stats: [
      { name: 'wins', value: 50 }, { name: 'losses', value: 32 },
      { name: 'winPercent', value: 0.6097 }, { name: 'gamesPlayed', value: 82 },
    ],
  }
  const s = toStanding(entry, 0, false, 'Western Conference', '/standings')
  assert.equal(s.won, 50)
  assert.equal(s.lost, 32)
  assert.equal(s.drawn, null, 'sin empates en baloncesto')
  assert.equal(s.points, null, 'la NBA no ordena por puntos, sino por porcentaje')
  assert.ok(s.winPct !== null)
  assert.equal(s.group, 'Western Conference')
  assert.equal(s.rank, 1, 'sin campo rank, cae al índice + 1')
})

test('toStanding conserva puntos y empates en fútbol', () => {
  const s = toStanding({
    team: { id: '359', displayName: 'Arsenal' },
    note: { description: 'Champions League', rank: 1 },
    stats: [
      { name: 'rank', value: 1 }, { name: 'points', value: 85 },
      { name: 'wins', value: 26 }, { name: 'ties', value: 7 }, { name: 'losses', value: 5 },
      { name: 'gamesPlayed', value: 38 }, { name: 'pointsFor', value: 71 },
    ],
  }, 0, true, null, '/standings')
  assert.equal(s.points, 85)
  assert.equal(s.drawn, 7)
  assert.equal(s.goalsFor, 71)
  assert.equal(s.description, 'Champions League')
})

test('toFixtureStatus cae al `state` cuando el nombre del estado es desconocido', () => {
  assert.equal(toFixtureStatus({ type: { name: 'STATUS_FINAL' } }), 'finished')
  assert.equal(toFixtureStatus({ type: { name: 'STATUS_IN_PROGRESS' } }), 'live')
  assert.equal(toFixtureStatus({ type: { name: 'STATUS_POSTPONED' } }), 'postponed')
  assert.equal(toFixtureStatus({ type: { name: 'ESTADO_NUEVO_DE_ESPN', state: 'in' } }), 'live')
  assert.equal(toFixtureStatus({ type: { name: 'OTRO', state: 'post', completed: true } }), 'finished')
  assert.equal(toFixtureStatus(undefined), 'scheduled')
})

// ─── Noticias: la lista blanca de ámbitos ────────────────────────────────────

test('resolveScope rechaza cualquier ámbito fuera de la lista blanca', () => {
  // `scope` acaba dentro de una URL: si aceptara texto libre sería un hueco
  // para pedir rutas arbitrarias del host de origen.
  assert.equal(resolveScope('futbol', 'soccer/esp.1'), 'soccer/esp.1')
  assert.equal(resolveScope('futbol', '../../admin'), 'soccer/eng.1', 'lo inválido cae al default')
  assert.equal(resolveScope('tenis', 'basketball/nba'), 'tennis/atp', 'no se cruzan deportes')
  assert.equal(resolveScope('baloncesto', undefined), 'basketball/nba')
})

test('todo ámbito por defecto pertenece a su propia lista blanca', () => {
  for (const sport of ['futbol', 'baloncesto', 'tenis'] as const) {
    const def = resolveScope(sport, undefined)
    assert.ok(NEWS_SCOPES[sport].includes(def), `${sport}: el default debe estar en su lista`)
  }
})
