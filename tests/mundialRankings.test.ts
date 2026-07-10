/**
 * Ranking ELO del Mundial — pruebas del módulo puro (lib/mundialRankings).
 * Fixture sintético de 4 equipos con fases mixtas.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTournamentRecords, fifaPositions, phaseRank, type RankingMatch } from '../lib/mundialRankings'

const A = 'team-a', B = 'team-b', C = 'team-c', D = 'team-d'

const MATCHES: RankingMatch[] = [
  // Grupos: A gana a B 2-0 · C empata con D 1-1
  { home_team_id: A, away_team_id: B, home_score: 2, away_score: 0, status: 'finished', phase: 'group' },
  { home_team_id: C, away_team_id: D, home_score: 1, away_score: 1, status: 'finished', phase: 'group' },
  // Octavos: A gana a C 1-0
  { home_team_id: A, away_team_id: C, home_score: 1, away_score: 0, status: 'finished', phase: 'round_of_16' },
  // Cuartos programado (sin marcador): A vs D — no suma al récord pero sí a la fase
  { home_team_id: A, away_team_id: D, home_score: null, away_score: null, status: 'scheduled', phase: 'quarter_final' },
]

test('récord del torneo: solo partidos finalizados suman PJ/G/E/P y goles', () => {
  const r = computeTournamentRecords(MATCHES)
  const a = r.get(A)!
  assert.equal(a.played, 2)
  assert.equal(a.won, 2)
  assert.equal(a.drawn, 0)
  assert.equal(a.lost, 0)
  assert.equal(a.goals_for, 3)
  assert.equal(a.goals_against, 0)

  const d = r.get(D)!
  assert.equal(d.played, 1)
  assert.equal(d.drawn, 1)
})

test('fase alcanzada cuenta partidos programados (estar en cuartos es real)', () => {
  const r = computeTournamentRecords(MATCHES)
  assert.equal(r.get(A)!.maxPhase, 'quarter_final')
  assert.equal(r.get(D)!.maxPhase, 'quarter_final')
  assert.equal(r.get(C)!.maxPhase, 'round_of_16')
  assert.equal(r.get(B)!.maxPhase, 'group')
})

test('orden de fases es el del torneo real', () => {
  assert.ok(phaseRank('final') > phaseRank('semi_final'))
  assert.ok(phaseRank('semi_final') > phaseRank('quarter_final'))
  assert.ok(phaseRank('round_of_32') > phaseRank('group'))
  assert.equal(phaseRank(null), 0)
})

test('posiciones FIFA: ordinal dentro del torneo, sin ranking → fuera del mapa', () => {
  const pos = fifaPositions([
    { id: A, fifa_ranking: 3 },
    { id: B, fifa_ranking: 15 },
    { id: C, fifa_ranking: 1 },
    { id: D, fifa_ranking: null },
  ])
  assert.equal(pos.get(C), 1)
  assert.equal(pos.get(A), 2)
  assert.equal(pos.get(B), 3)
  assert.equal(pos.has(D), false)
})
