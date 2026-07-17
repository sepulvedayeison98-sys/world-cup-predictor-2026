/**
 * DOMINIO TENNIS — pruebas del perfil de saque/devolución (tennis-2.0).
 * Métricas verificadas a mano contra el fixture; los índices 0-100 son un
 * escalado transparente entre anclas fijas documentadas.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeServeReturnProfile } from '../lib/tennis/serveReturn'
import type { TStatsMatch, TStatsRow } from '../lib/tennis/stats'

const m = (id: string, p1: string, p2: string, status = 'finished'): TStatsMatch => ({
  id, p1_id: p1, p2_id: p2, winner_id: p1, surface: 'hard', status, scheduled_at: '2025-01-01', external_id: id,
})
const row = (match: string, player: string, o: Partial<TStatsRow>): TStatsRow => ({
  match_id: match, player_id: player, aces: null, double_faults: null, serve_points: null,
  first_serve_in: null, first_serve_won: null, second_serve_won: null, service_games: null,
  break_points_saved: null, break_points_faced: null, return_games_won: null, ...o,
})
const near = (a: number | null, b: number, t = 1e-3) => assert.ok(a != null && Math.abs(a - b) < t, `${a} ≈ ${b}`)

test('perfil de saque/devolución desde stats reales (fixture a mano)', () => {
  const matches = [m('m1', 'A', 'B')]
  const stats = [
    row('m1', 'A', { serve_points: 80, first_serve_in: 48, first_serve_won: 40, second_serve_won: 18, service_games: 12, break_points_faced: 4, break_points_saved: 3, aces: 10, double_faults: 2 }),
    row('m1', 'B', { serve_points: 76, first_serve_won: 30, second_serve_won: 16, service_games: 11, break_points_faced: 5, break_points_saved: 2 }),
  ]
  const p = computeServeReturnProfile(matches, stats, 'A')
  assert.equal(p.matchesWithStats, 1)
  // saque
  near(p.serve.firstServePct, 48 / 80)
  near(p.serve.firstServeWonPct, 40 / 48)
  near(p.serve.secondServeWonPct, 18 / 32)
  near(p.serve.holdPct, 11 / 12)        // (12 juegos - 1 break) / 12
  near(p.serve.bpSavedPct, 3 / 4)
  assert.equal(p.serve.acesPerMatch, 10)
  assert.equal(p.serve.dfPerMatch, 2)
  // devolución (desde filas de B)
  near(p.return.breakPct, 3 / 11)       // 3 breaks / 11 juegos al saque de B
  near(p.return.returnPtsWonPct, 30 / 76) // 76 - (30+16) puntos ganados al resto
  near(p.return.bpConvertedPct, 3 / 5)
  // índices 0-100 (escalado documentado)
  assert.ok(p.serveIndex! >= 87 && p.serveIndex! <= 89, `serveIndex=${p.serveIndex}`)
  assert.ok(p.returnIndex! >= 71 && p.returnIndex! <= 73, `returnIndex=${p.returnIndex}`)
})

test('sin stats → todo null, sin índices', () => {
  const p = computeServeReturnProfile([m('m1', 'A', 'B')], [], 'A')
  assert.equal(p.matchesWithStats, 0)
  assert.equal(p.serve.holdPct, null)
  assert.equal(p.serveIndex, null)
  assert.equal(p.returnIndex, null)
})

test('walkover no aporta stats', () => {
  const matches = [m('m1', 'A', 'B', 'walkover')]
  const stats = [row('m1', 'A', { serve_points: 80, first_serve_in: 48, service_games: 12, break_points_faced: 0, break_points_saved: 0 })]
  const p = computeServeReturnProfile(matches, stats, 'A')
  assert.equal(p.matchesWithStats, 0)
  assert.equal(p.serveIndex, null)
})
