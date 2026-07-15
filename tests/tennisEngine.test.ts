/**
 * DOMINIO TENNIS — pruebas del motor tennis-1.0 (lib/tennis/engine).
 * ELO walk-forward, orden cronológico, extracción de factores y
 * combinación por pesos con renormalización honesta.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ELO_INITIAL, ELO_K, eloExpected, sortChronologically,
  createWalkState, advanceWalkState, extractFactors, predictTennisMatch,
  rankToSeedElo,
  type TEngineMatch, type TennisFactorInput,
} from '../lib/tennis/engine'
import { TENNIS_WEIGHTS } from '../lib/tennis/constants'

const m = (over: Partial<TEngineMatch>): TEngineMatch => ({
  id: 'x', p1_id: 'A', p2_id: 'B', winner_id: 'A', surface: 'hard',
  status: 'finished', scheduled_at: '2025-01-01', round: 'R32',
  external_id: '2025-100-1', ...over,
})

const factors = (over: Partial<TennisFactorInput>): TennisFactorInput => ({
  eloP1: null, eloP2: null, surfaceEloP1: null, surfaceEloP2: null,
  recentP1: null, recentP2: null, h2hP1Wins: 0, h2hTotal: 0,
  rankP1: null, rankP2: null, marketP1: null, ...over,
})

test('eloExpected: simétrico y monótono', () => {
  assert.equal(eloExpected(1500, 1500), 0.5)
  assert.ok(eloExpected(1600, 1500) > 0.5)
  assert.ok(Math.abs(eloExpected(1600, 1400) + eloExpected(1400, 1600) - 1) < 1e-12)
})

test('advanceWalkState: el ganador sube y el perdedor baja lo mismo (K=32)', () => {
  const st = createWalkState()
  advanceWalkState(st, m({ winner_id: 'A' }))
  const eA = st.elo.get('A')!, eB = st.elo.get('B')!
  assert.equal(eA, ELO_INITIAL + ELO_K * 0.5)
  assert.equal(eB, ELO_INITIAL - ELO_K * 0.5)
  // superficie también actualiza
  assert.ok(st.surfaceElo.get('A|hard')! > ELO_INITIAL)
  assert.equal(st.played.get('A'), 1)
  assert.deepEqual(st.recent.get('A'), ['W'])
  assert.deepEqual(st.recent.get('B'), ['L'])
})

test('walkover NO mueve ratings ni forma', () => {
  const st = createWalkState()
  advanceWalkState(st, m({ status: 'walkover' }))
  assert.equal(st.elo.size, 0)
  assert.equal(st.played.size, 0)
})

test('H2H se acumula por par ordenado sin importar posición p1/p2', () => {
  const st = createWalkState()
  advanceWalkState(st, m({ p1_id: 'A', p2_id: 'B', winner_id: 'A' }))
  advanceWalkState(st, m({ p1_id: 'B', p2_id: 'A', winner_id: 'A', external_id: '2025-100-2' }))
  const f = extractFactors(st, m({ p1_id: 'A', p2_id: 'B', winner_id: null }))!
  assert.equal(f.h2hP1Wins, 2)
  assert.equal(f.h2hTotal, 2)
  // y desde la perspectiva inversa
  const g = extractFactors(st, m({ p1_id: 'B', p2_id: 'A', winner_id: null }))!
  assert.equal(g.h2hP1Wins, 0)
  assert.equal(g.h2hTotal, 2)
})

test('sortChronologically: fecha → ronda → match_num', () => {
  const ms = [
    m({ id: 'f', scheduled_at: '2025-01-01', round: 'F', external_id: '2025-1-30' }),
    m({ id: 'r32b', scheduled_at: '2025-01-01', round: 'R32', external_id: '2025-1-10' }),
    m({ id: 'r32a', scheduled_at: '2025-01-01', round: 'R32', external_id: '2025-1-2' }),
    m({ id: 'prev', scheduled_at: '2024-12-20', round: 'F', external_id: '2024-9-1' }),
  ]
  assert.deepEqual(sortChronologically(ms).map((x) => x.id), ['prev', 'r32a', 'r32b', 'f'])
})

test('extractFactors: sin historial → factores null (no 1500 ficticio)', () => {
  const st = createWalkState()
  const f = extractFactors(st, m({ winner_id: null }))!
  assert.equal(f.eloP1, null)
  assert.equal(f.surfaceEloP1, null)
  assert.equal(f.recentP1, null)
  assert.equal(f.h2hTotal, 0)
})

test('predictTennisMatch: sin ningún factor → null (Data First)', () => {
  assert.equal(predictTennisMatch(factors({})), null)
})

test('predictTennisMatch: solo ELO → peso efectivo 1 en rankingElo', () => {
  const p = predictTennisMatch(factors({ eloP1: 1600, eloP2: 1400 }))!
  assert.ok(p.p1Probability > 0.5)
  assert.equal(p.favorite, 'p1')
  assert.ok(Math.abs(p.effectiveWeights.rankingElo - 1) < 1e-9)
  assert.equal(p.factors.form, null)
})

test('predictTennisMatch: ranking rank2/(rank1+rank2) favorece al mejor clasificado', () => {
  const p = predictTennisMatch(factors({ rankP1: 1, rankP2: 99 }))!
  assert.ok(Math.abs(p.p1Probability - 0.98) < 1e-9) // 0.99 recortado al tope 0.98
  assert.equal(p.confidence, 'alta')
})

test('predictTennisMatch: renormalización — pesos efectivos suman 1', () => {
  const p = predictTennisMatch(factors({
    eloP1: 1550, eloP2: 1450,
    recentP1: ['W', 'W', 'W', 'L'], recentP2: ['L', 'L', 'W', 'L'],
    h2hP1Wins: 2, h2hTotal: 3,
  }))!
  const sum = Object.values(p.effectiveWeights).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(sum - 1) < 1e-9)
  // sin superficie ni mercado: proporciones respetan TENNIS_WEIGHTS
  const base = TENNIS_WEIGHTS.rankingElo + TENNIS_WEIGHTS.form + TENNIS_WEIGHTS.headToHead
  assert.ok(Math.abs(p.effectiveWeights.rankingElo - TENNIS_WEIGHTS.rankingElo / base) < 1e-9)
})

test('forma: <3 partidos recientes no genera señal', () => {
  const p = predictTennisMatch(factors({
    eloP1: 1500, eloP2: 1500,
    recentP1: ['W', 'W'], recentP2: ['L', 'L'],
  }))!
  assert.equal(p.factors.form, null)
})

test('H2H con Laplace: 2-0 no da certeza absoluta', () => {
  const p = predictTennisMatch(factors({ h2hP1Wins: 2, h2hTotal: 2 }))!
  assert.ok(Math.abs((p.factors.headToHead ?? 0) - 3 / 4) < 1e-9)
})

test('confianza: bandas alta/media/baja', () => {
  assert.equal(predictTennisMatch(factors({ marketP1: 0.70 }))!.confidence, 'alta')
  assert.equal(predictTennisMatch(factors({ marketP1: 0.60 }))!.confidence, 'media')
  assert.equal(predictTennisMatch(factors({ marketP1: 0.52 }))!.confidence, 'baja')
})

// ── tennis-1.1: siembra de ELO por ranking (cold-start) ──────────────────

test('rankToSeedElo: mejor ranking → mayor ELO; rango de referencia → 1500', () => {
  assert.equal(rankToSeedElo(50), ELO_INITIAL) // refRank
  assert.ok(rankToSeedElo(1) > rankToSeedElo(50))
  assert.ok(rankToSeedElo(200) < ELO_INITIAL)
  assert.equal(rankToSeedElo(0), ELO_INITIAL)   // ranking inválido → neutro
})

test('advanceWalkState sin seed = comportamiento 1.0 (arranque en 1500)', () => {
  const st = createWalkState()
  advanceWalkState(st, m({ winner_id: 'A' })) // sin tercer argumento
  assert.equal(st.elo.get('A'), ELO_INITIAL + ELO_K * 0.5)
  assert.equal(st.elo.get('B'), ELO_INITIAL - ELO_K * 0.5)
})

test('tennis-1.1: el debutante arranca desde su ranking, no en 1500', () => {
  const st = createWalkState()
  // A es #1 (favorito), B es #200; A gana como se espera
  advanceWalkState(st, m({ winner_id: 'A' }), { seedRank1: 1, seedRank2: 200 })
  const seedA = rankToSeedElo(1), seedB = rankToSeedElo(200)
  const eA = eloExpected(seedA, seedB)
  assert.ok(Math.abs(st.elo.get('A')! - (seedA + ELO_K * (1 - eA))) < 1e-9)
  assert.ok(Math.abs(st.elo.get('B')! - (seedB + ELO_K * (0 - (1 - eA)))) < 1e-9)
  // Al ganar el favorito, el ajuste es pequeño: A se mantiene muy por encima
  assert.ok(st.elo.get('A')! > st.elo.get('B')! + 200)
})

test('tennis-1.1: la semilla NO re-arranca a un jugador ya conocido', () => {
  const st = createWalkState()
  advanceWalkState(st, m({ winner_id: 'A' }), { seedRank1: 100, seedRank2: 100 })
  const afterFirst = st.elo.get('A')!
  // Segundo partido de A: aunque pasemos un seedRank, A ya no es nuevo
  advanceWalkState(st, m({ p1_id: 'A', p2_id: 'C', winner_id: 'A', external_id: '2025-100-2' }),
    { seedRank1: 1, seedRank2: 300 })
  // El ELO de A partió de afterFirst (no se reinició por el seedRank1=1)
  assert.ok(st.elo.get('A')! > afterFirst) // subió por ganar, no por reseed
  assert.ok(st.elo.get('A')! < afterFirst + ELO_K) // ajuste acotado por K
})
