/**
 * DOMINIO TENNIS — pruebas del simulador Monte Carlo de mercados
 * (punto→juego→set→partido). Determinista por semilla.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computePointProfile, servePointProb, gameWinProb, simulateTiebreak,
  simulateSet, simulateTennisMarkets, MC_MIN_STAT_MATCHES,
  TOUR_AVG_RETURN_PTS_WON, type MCPointProfile,
} from '../lib/tennis/monteCarlo'

const prof = (spw: number, rpw: number): MCPointProfile =>
  ({ servePointsWonPct: spw, returnPointsWonPct: rpw, statMatches: 10 })

test('gameWinProb: 0.5 → 0.5, monotónica y conocida en extremos', () => {
  assert.ok(Math.abs(gameWinProb(0.5) - 0.5) < 1e-12)
  assert.ok(gameWinProb(0.6) < gameWinProb(0.65))
  assert.ok(gameWinProb(0.65) > 0.8)   // el saque domina el juego
  assert.ok(gameWinProb(0.72) > 0.9)
})

test('servePointProb: ajuste Barnett–Clarke y acotado', () => {
  // Rival con resto medio → p = spw propio exacto
  const p = servePointProb(prof(0.65, 0.36), prof(0.6, TOUR_AVG_RETURN_PTS_WON))
  assert.ok(Math.abs(p - 0.65) < 1e-12)
  // Rival con mejor resto que la media → baja; peor → sube
  assert.ok(servePointProb(prof(0.65, 0.36), prof(0.6, 0.45)) < 0.65)
  assert.ok(servePointProb(prof(0.65, 0.36), prof(0.6, 0.30)) > 0.65)
  // Tope declarado
  assert.ok(servePointProb(prof(0.99, 0.36), prof(0.6, 0.05)) <= 0.9)
})

test('computePointProfile: ratios exactas desde filas reales y mínimo de partidos', () => {
  const matches = Array.from({ length: MC_MIN_STAT_MATCHES }, (_, i) => (
    { id: `m${i}`, p1_id: 'A', p2_id: 'B', status: 'finished' }))
  const stats = matches.flatMap((m) => [
    { match_id: m.id, player_id: 'A', serve_points: 80, first_serve_won: 36, second_serve_won: 16 },
    { match_id: m.id, player_id: 'B', serve_points: 100, first_serve_won: 40, second_serve_won: 20 },
  ])
  const a = computePointProfile(matches, stats, 'A')!
  assert.ok(Math.abs(a.servePointsWonPct - 52 / 80) < 1e-12)
  assert.ok(Math.abs(a.returnPointsWonPct - 40 / 100) < 1e-12)
  assert.equal(a.statMatches, MC_MIN_STAT_MATCHES)
  // Con menos del mínimo → null (Data First)
  assert.equal(computePointProfile(matches.slice(1), stats, 'A'), null)
  // Walkover no cuenta
  const wo = matches.map((m) => ({ ...m, status: 'walkover' }))
  assert.equal(computePointProfile(wo, stats, 'A'), null)
})

test('simulateTiebreak/simulateSet: sesgo correcto con saques asimétricos', () => {
  let seed = 1
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  let tbWins = 0, setWins = 0
  const N = 4000
  for (let i = 0; i < N; i++) {
    if (simulateTiebreak(0.7, 0.6, rng)) tbWins++
    const s = simulateSet(gameWinProb(0.7), gameWinProb(0.6), 0.7, 0.6, i % 2 === 0, rng)
    assert.ok(Math.max(s.games1, s.games2) <= 7 && Math.min(s.games1, s.games2) <= 6)
    if (s.p1Won) setWins++
  }
  assert.ok(tbWins / N > 0.55, `tiebreak sesgado al mejor sacador: ${tbWins / N}`)
  assert.ok(setWins / N > 0.7, `set sesgado al mejor sacador: ${setWins / N}`)
})

test('mercados: jugadores idénticos → simetría ~50/50', () => {
  const a = prof(0.64, 0.36)
  const m = simulateTennisMarkets(a, a, { sims: 20000, seed: 7 })
  assert.ok(Math.abs(m.matchWinP1 - 0.5) < 0.02, `matchWinP1=${m.matchWinP1}`)
  assert.ok(Math.abs((m.setScores['2-0'] ?? 0) - (m.setScores['0-2'] ?? 0)) < 0.02)
  const sum = Object.values(m.setScores).reduce((x, y) => x + y, 0)
  assert.ok(Math.abs(sum - 1) < 1e-9)
})

test('mercados: favorito claro → gana más, 2-0 más probable que 2-1', () => {
  const m = simulateTennisMarkets(prof(0.68, 0.40), prof(0.60, 0.33), { sims: 20000, seed: 7 })
  assert.ok(m.matchWinP1 > 0.75, `matchWinP1=${m.matchWinP1}`)
  assert.ok((m.setScores['2-0'] ?? 0) > (m.setScores['2-1'] ?? 0))
  // Overs decrecen con la línea; hándicap crece con la línea a favor de p1
  for (let i = 1; i < m.totalGamesOver.length; i++) {
    assert.ok(m.totalGamesOver[i].over <= m.totalGamesOver[i - 1].over + 1e-9)
  }
  for (let i = 1; i < m.handicap.length; i++) {
    assert.ok(m.handicap[i].p1Covers >= m.handicap[i - 1].p1Covers - 1e-9)
  }
})

test('mercados: determinismo por semilla y best-of-5', () => {
  const a = prof(0.66, 0.38), b = prof(0.62, 0.35)
  const m1 = simulateTennisMarkets(a, b, { sims: 5000, seed: 42 })
  const m2 = simulateTennisMarkets(a, b, { sims: 5000, seed: 42 })
  assert.deepEqual(m1, m2)
  const m5 = simulateTennisMarkets(a, b, { sims: 5000, seed: 42, bestOf: 5 })
  assert.ok(m5.gamesAvg > m1.gamesAvg)
  assert.ok(('3-0' in m5.setScores) || ('3-1' in m5.setScores) || ('3-2' in m5.setScores))
})
