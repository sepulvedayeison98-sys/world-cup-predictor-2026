/**
 * Stats de equipo de fútbol — pruebas del módulo puro (lib/footballTeamStats).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeFootballTeamStats, type FbMatch } from '../lib/footballTeamStats'

const T = 'team', X = 'x', Y = 'y', Z = 'z'

const MATCHES: FbMatch[] = [
  // T local gana 2-0
  { id: '1', home_team_id: T, away_team_id: X, home_score: 2, away_score: 0, status: 'finished', kickoff_time: '2025-01-01' },
  // T visitante empata 1-1
  { id: '2', home_team_id: Y, away_team_id: T, home_score: 1, away_score: 1, status: 'finished', kickoff_time: '2025-01-08' },
  // T visitante pierde 3-1
  { id: '3', home_team_id: Z, away_team_id: T, home_score: 3, away_score: 1, status: 'finished', kickoff_time: '2025-01-15' },
  // T local pierde 0-1 (racha de 2 derrotas al final)
  { id: '4', home_team_id: T, away_team_id: X, home_score: 0, away_score: 1, status: 'finished', kickoff_time: '2025-01-22' },
  // Ruido: no jugado y ajeno
  { id: '5', home_team_id: T, away_team_id: Y, home_score: null, away_score: null, status: 'scheduled', kickoff_time: '2025-02-01' },
  { id: '6', home_team_id: X, away_team_id: Y, home_score: 2, away_score: 2, status: 'finished', kickoff_time: '2025-01-05' },
]

test('récord, puntos y goles solo de partidos jugados del equipo', () => {
  const s = computeFootballTeamStats(MATCHES, T)
  assert.equal(s.played, 4)
  assert.equal(s.won, 1)
  assert.equal(s.drawn, 1)
  assert.equal(s.lost, 2)
  assert.equal(s.points, 4)              // 3 + 1
  assert.equal(s.goals_for, 2 + 1 + 1 + 0) // 4
  assert.equal(s.goals_against, 0 + 1 + 3 + 1) // 5
  assert.equal(s.goal_diff, -1)
})

test('splits local/visitante', () => {
  const s = computeFootballTeamStats(MATCHES, T)
  assert.equal(s.homeW, 1); assert.equal(s.homeL, 1) // gana 2-0, pierde 0-1
  assert.equal(s.awayD, 1); assert.equal(s.awayL, 1) // empata 1-1, pierde 1-3
})

test('forma y racha (empate no cuenta como racha)', () => {
  const s = computeFootballTeamStats(MATCHES, T)
  assert.deepEqual(s.last5, ['W', 'D', 'L', 'L'])
  assert.equal(s.streak, -2) // dos derrotas al final
})

test('equipo sin partidos → todo en cero, sin inventar', () => {
  const s = computeFootballTeamStats(MATCHES, 'nadie')
  assert.equal(s.played, 0)
  assert.equal(s.ppg, 0)
  assert.equal(s.streak, 0)
})
