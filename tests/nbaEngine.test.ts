/**
 * Tests del motor de predicción NBA. Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  runNbaBacktest,
  computeNbaRecords,
  nbaExpectedHome,
  NBA_ELO_BASE,
  NBA_WARMUP_GAMES,
  type NbaEngineMatch,
} from '../lib/nba/engine'

let seq = 0
function G(home: string, away: string, hs: number | null, as: number | null, day: number): NbaEngineMatch {
  seq++
  return {
    id: `g${seq}`,
    home_team_id: home,
    away_team_id: away,
    home_score: hs,
    away_score: as,
    status: hs === null ? 'scheduled' : 'finished',
    kickoff_time: `2024-10-${String(day).padStart(2, '0')}T23:00:00Z`,
  }
}

/** Temporada sintética: 'elite' gana siempre por paliza; el resto se reparte. */
function season(): NbaEngineMatch[] {
  const others = ['b', 'c', 'd', 'e']
  const games: NbaEngineMatch[] = []
  let day = 1
  for (let round = 0; round < 6; round++) {
    for (const o of others) {
      const eliteHome = round % 2 === 0
      games.push(G(eliteHome ? 'elite' : o, eliteHome ? o : 'elite',
        eliteHome ? 120 : 100, eliteHome ? 100 : 120, day))
      day = (day % 28) + 1
    }
    games.push(G(others[0], others[1], 110, 108, day)); day = (day % 28) + 1
    games.push(G(others[2], others[3], 105, 111, day)); day = (day % 28) + 1
  }
  return games
}

test('nbaExpectedHome: el local parte con ventaja y escala con el ELO', () => {
  assert.ok(nbaExpectedHome(1500, 1500) > 0.5)
  assert.ok(nbaExpectedHome(1500, 1500) < 0.62) // ventaja de local moderada
  assert.ok(nbaExpectedHome(1700, 1400) > 0.8)
  assert.ok(nbaExpectedHome(1400, 1700) < 0.35)
})

test('backtest: el equipo dominante termina con más ELO y sin empates', () => {
  const r = runNbaBacktest(season())
  assert.ok(r.finalElo.get('elite')! > NBA_ELO_BASE + 60)
  for (const p of r.predictions) {
    assert.equal(p.draw_probability, 0)
    assert.ok(Math.abs(p.home_win_probability + p.away_win_probability - 1) < 0.005)
    assert.ok(p.pick === 'home' || p.pick === 'away')
    assert.ok(p.predicted_home_score >= 80 && p.predicted_home_score <= 160)
  }
})

test('backtest: respeta el calentamiento y acierta la liga predecible', () => {
  const r = runNbaBacktest(season())
  assert.ok(r.metrics.skipped > 0)
  assert.ok(r.metrics.evaluated > 0)
  assert.ok(r.metrics.accuracy >= 0.5)
  assert.ok(r.metrics.mae_margin >= 0)
})

test('upcoming: predice partidos programados con el estado final del modelo', () => {
  const s = season()
  s.push(G('elite', 'b', null, null, 28))
  const r = runNbaBacktest(s)
  assert.equal(r.upcoming.length, 1)
  const u = r.upcoming[0]
  assert.equal(u.draw_probability, 0)
  assert.equal(u.pick, 'home') // elite de local
  assert.ok(u.home_win_probability > 0.55)
})

test('computeNbaRecords: récord W-L y % de victorias correctos', () => {
  const recs = computeNbaRecords([
    G('x', 'y', 110, 100, 1),
    G('y', 'x', 120, 90, 2),
    G('x', 'y', 105, 104, 3),
  ])
  const x = recs.get('x')!
  assert.equal(x.won, 2)
  assert.equal(x.lost, 1)
  assert.equal(x.win_pct, 0.667)
  assert.equal(x.points_for, 110 + 90 + 105)
})

test('backtest: pocos partidos → nada evaluado, métricas en cero', () => {
  const r = runNbaBacktest([G('a', 'b', 100, 99, 1), G('b', 'a', 100, 99, 2)])
  assert.equal(r.metrics.evaluated, 0)
  assert.equal(r.metrics.accuracy, 0)
  assert.ok(NBA_WARMUP_GAMES > 1)
})
