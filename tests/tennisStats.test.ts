/**
 * DOMINIO TENNIS — pruebas del módulo puro de estadísticas de jugador
 * (lib/tennis/stats). Fixture sintético mínimo; las métricas se verifican
 * a mano: Hold% = (juegos de saque − breaks sufridos) / juegos de saque,
 * Break% = breaks logrados / juegos de saque del rival.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTennisPlayerStats, type TStatsMatch, type TStatsRow } from '../lib/tennis/stats'

const m = (
  id: string, p1: string, p2: string, winner: string, surface: string,
  status = 'finished', at = '2025-01-01',
): TStatsMatch => ({
  id, p1_id: p1, p2_id: p2, winner_id: winner, surface, status,
  scheduled_at: at, external_id: id,
})

const s = (
  match: string, player: string,
  o: Partial<Omit<TStatsRow, 'match_id' | 'player_id'>> = {},
): TStatsRow => ({
  match_id: match, player_id: player,
  aces: null, double_faults: null, serve_points: null, first_serve_in: null,
  first_serve_won: null, second_serve_won: null, service_games: null,
  break_points_saved: null, break_points_faced: null, return_games_won: null,
  ...o,
})

test('winRate y desglose por superficie', () => {
  const matches = [
    m('m1', 'A', 'B', 'A', 'hard'),
    m('m2', 'A', 'C', 'C', 'hard'),
    m('m3', 'D', 'A', 'A', 'clay'),
    m('m4', 'X', 'Y', 'X', 'hard'), // ajeno: no cuenta
  ]
  const r = computeTennisPlayerStats(matches, [], 'A')
  assert.equal(r.played, 3)
  assert.equal(r.won, 2)
  assert.ok(Math.abs(r.winRate - 2 / 3) < 1e-9)
  assert.deepEqual(r.bySurface.hard, { played: 2, won: 1 })
  assert.deepEqual(r.bySurface.clay, { played: 1, won: 1 })
})

test('walkover NO cuenta como jugado; retired sí', () => {
  const matches = [
    m('m1', 'A', 'B', 'A', 'hard', 'walkover'),
    m('m2', 'A', 'B', 'A', 'hard', 'retired'),
  ]
  const r = computeTennisPlayerStats(matches, [], 'A')
  assert.equal(r.played, 1)
  assert.equal(r.won, 1)
})

test('last10 en orden cronológico, más reciente al final', () => {
  const matches = Array.from({ length: 12 }, (_, i) =>
    m(`m${String(i).padStart(2, '0')}`, 'A', 'B', i % 2 === 0 ? 'A' : 'B', 'hard',
      'finished', `2025-01-${String(i + 1).padStart(2, '0')}`))
  const r = computeTennisPlayerStats(matches, [], 'A')
  assert.equal(r.last10.length, 10)
  // i=11 (más reciente) la gana B → última posición 'L'
  assert.equal(r.last10[r.last10.length - 1], 'L')
  assert.equal(r.played, 12)
})

test('holdPct y breakPct desde filas de stats reales', () => {
  const matches = [m('m1', 'A', 'B', 'A', 'hard')]
  const stats = [
    // A: 10 juegos de saque, 4 BP en contra, 2 salvados → 2 breaks sufridos → hold 8/10
    s('m1', 'A', { service_games: 10, break_points_faced: 4, break_points_saved: 2, aces: 7, double_faults: 3 }),
    // B (rival): 12 juegos de saque, 5 BP en contra, 2 salvados → A logró 3 breaks → break 3/12
    s('m1', 'B', { service_games: 12, break_points_faced: 5, break_points_saved: 2 }),
  ]
  const r = computeTennisPlayerStats(matches, stats, 'A')
  assert.equal(r.statsMatches, 1)
  assert.ok(Math.abs((r.holdPct ?? 0) - 0.8) < 1e-9)
  assert.ok(Math.abs((r.breakPct ?? 0) - 0.25) < 1e-9)
  assert.equal(r.acesPerMatch, 7)
  assert.equal(r.dfPerMatch, 3)
})

test('sin stats → hold/break/aces quedan null (no se estima)', () => {
  const r = computeTennisPlayerStats([m('m1', 'A', 'B', 'A', 'hard')], [], 'A')
  assert.equal(r.holdPct, null)
  assert.equal(r.breakPct, null)
  assert.equal(r.acesPerMatch, null)
  assert.equal(r.statsMatches, 0)
})

test('jugador sin partidos → todo en cero/null', () => {
  const r = computeTennisPlayerStats([], [], 'Z')
  assert.equal(r.played, 0)
  assert.equal(r.winRate, 0)
  assert.deepEqual(r.last10, [])
})
