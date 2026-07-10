/**
 * Head-to-head — pruebas del módulo puro (lib/h2h).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeH2H, type H2HMatch } from '../lib/h2h'

const A = 'team-a', B = 'team-b', C = 'team-c'

const MATCHES: H2HMatch[] = [
  // A local gana a B 2-1
  { id: 'm1', home_team_id: A, away_team_id: B, home_score: 2, away_score: 1, kickoff_time: '2025-01-10T00:00:00Z', status: 'finished' },
  // B local empata con A 0-0
  { id: 'm2', home_team_id: B, away_team_id: A, home_score: 0, away_score: 0, kickoff_time: '2025-03-10T00:00:00Z', status: 'finished' },
  // B local gana a A 3-1
  { id: 'm3', home_team_id: B, away_team_id: A, home_score: 3, away_score: 1, kickoff_time: '2025-05-10T00:00:00Z', status: 'finished' },
  // Ruido: A vs C (no cuenta) y un A vs B sin jugar
  { id: 'm4', home_team_id: A, away_team_id: C, home_score: 1, away_score: 0, kickoff_time: '2025-06-10T00:00:00Z', status: 'finished' },
  { id: 'm5', home_team_id: A, away_team_id: B, home_score: null, away_score: null, kickoff_time: '2025-07-10T00:00:00Z', status: 'scheduled' },
]

test('resume el H2H normalizado a la óptica de A', () => {
  const r = computeH2H(MATCHES, A, B)
  assert.equal(r.total, 3)          // solo A-B finalizados
  assert.equal(r.aWins, 1)          // 2-1
  assert.equal(r.draws, 1)          // 0-0
  assert.equal(r.bWins, 1)          // perdió 1-3
  assert.equal(r.aGoals, 2 + 0 + 1) // 3
  assert.equal(r.bGoals, 1 + 0 + 3) // 4
})

test('recent viene del más reciente al más antiguo, con marcador desde A', () => {
  const r = computeH2H(MATCHES, A, B)
  assert.equal(r.recent[0].id, 'm3')   // mayo, el más reciente jugado
  assert.equal(r.recent[0].aScore, 1)  // A perdió 1-3 (óptica A)
  assert.equal(r.recent[0].bScore, 3)
  assert.equal(r.recent[0].outcome, 'B')
})

test('sin enfrentamientos previos → total 0, sin inventar', () => {
  const r = computeH2H(MATCHES, A, 'team-x')
  assert.equal(r.total, 0)
  assert.equal(r.recent.length, 0)
})
