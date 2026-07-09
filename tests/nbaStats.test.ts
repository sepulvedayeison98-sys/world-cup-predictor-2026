/**
 * Tests del módulo de estadísticas de temporada NBA (datos reales,
 * sin métricas fabricadas). Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computeNbaSeasonStats,
  computeNbaLeagueStats,
  computeNbaCalibration,
  type NbaStatsMatch,
} from '../lib/nba/stats'

const A = 'team-a', B = 'team-b', C = 'team-c'

function game(
  id: string, day: number, home: string, away: string,
  hs: number, as: number,
  ps?: { home: number[]; away: number[] } | null,
): NbaStatsMatch {
  return {
    id, home_team_id: home, away_team_id: away,
    home_score: hs, away_score: as, status: 'finished',
    kickoff_time: `2024-11-${String(day).padStart(2, '0')}T00:00:00Z`,
    period_scores: ps ?? null,
  }
}

const SEASON: NbaStatsMatch[] = [
  // A gana en casa 110-100 (cuartos 30/25/30/25 vs 25/25/25/25)
  game('g1', 1, A, B, 110, 100, { home: [30, 25, 30, 25], away: [25, 25, 25, 25] }),
  // A pierde fuera 98-101 — partido cerrado (≤5)
  game('g2', 2, B, A, 101, 98),
  // A gana en casa con prórroga 120-115 (5 periodos)
  game('g3', 3, A, C, 120, 115, { home: [25, 25, 25, 30, 15], away: [25, 25, 30, 25, 10] }),
  // A gana fuera 105-90
  game('g4', 4, C, A, 90, 105),
  // Partido programado: NO cuenta
  { id: 'g5', home_team_id: A, away_team_id: B, home_score: null, away_score: null, status: 'scheduled', kickoff_time: '2024-11-05T00:00:00Z' },
]

test('récord, splits local/visitante y racha desde partidos reales', () => {
  const stats = computeNbaSeasonStats(SEASON)
  const a = stats.get(A)!
  assert.equal(a.played, 4)
  assert.equal(a.won, 3)
  assert.equal(a.lost, 1)
  assert.equal(a.home_won, 2)
  assert.equal(a.home_lost, 0)
  assert.equal(a.away_won, 1)
  assert.equal(a.away_lost, 1)
  assert.equal(a.streak, 2, 'dos victorias seguidas al cierre')
  assert.deepEqual(a.last5, ['W', 'L', 'W', 'W'])
})

test('anotación: PPG, permitidos y diferencial', () => {
  const a = computeNbaSeasonStats(SEASON).get(A)!
  assert.equal(a.points_for, 110 + 98 + 120 + 105)
  assert.equal(a.points_against, 100 + 101 + 115 + 90)
  assert.equal(a.ppg, 108.3)   // 433/4
  assert.equal(a.papg, 101.5)  // 406/4
  assert.equal(a.margin, 6.8)
})

test('prórroga y partidos cerrados con récord propio', () => {
  const a = computeNbaSeasonStats(SEASON).get(A)!
  assert.equal(a.otPlayed, 1)
  assert.equal(a.otWon, 1)
  assert.equal(a.closePlayed, 2, 'el 101-98 y el 120-115 son ≤5')
  assert.equal(a.closeWon, 1)
})

test('perfil por cuarto: solo partidos con dato, prórroga excluida del perfil', () => {
  const a = computeNbaSeasonStats(SEASON).get(A)!
  // Dos partidos con period_scores: g1 (30/25/30/25) y g3 (25/25/25/30)
  assert.deepEqual(a.quarterAvgFor, [27.5, 25, 27.5, 27.5])
  assert.deepEqual(a.quarterAvgAgainst, [25, 25, 27.5, 25])
})

test('agregados de liga: promedio total, % local, prórrogas y máximo anotador', () => {
  const lg = computeNbaLeagueStats(SEASON)
  assert.equal(lg.games, 4)
  assert.equal(lg.avgTotalPoints, 209.8) // (210+199+235+195)/4
  assert.equal(lg.homeWinPct, 0.75)      // g1, g2, g3 ganó el local
  assert.equal(lg.otGames, 1)
  assert.equal(lg.highestScoring?.total, 235)
})

test('calibración: agrupa por probabilidad del favorito y mide acierto real', () => {
  const preds = [
    { home_win_probability: 0.55, away_win_probability: 0.45, was_correct: true },
    { home_win_probability: 0.42, away_win_probability: 0.58, was_correct: false },
    { home_win_probability: 0.75, away_win_probability: 0.25, was_correct: true },
    { home_win_probability: 0.78, away_win_probability: 0.22, was_correct: true },
    { home_win_probability: 0.91, away_win_probability: 0.09, was_correct: true },
    { home_win_probability: 0.65, away_win_probability: 0.35, was_correct: null }, // sin resolver: fuera
  ]
  const buckets = computeNbaCalibration(preds)
  assert.equal(buckets.length, 4)
  const b5060 = buckets[0]
  assert.equal(b5060.total, 2)
  assert.equal(b5060.correct, 1)
  assert.equal(b5060.hitRate, 0.5)
  const b7080 = buckets[2]
  assert.equal(b7080.total, 2)
  assert.equal(b7080.hitRate, 1)
  const b80 = buckets[3]
  assert.equal(b80.total, 1)
})
