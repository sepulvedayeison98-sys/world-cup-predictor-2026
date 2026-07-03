/**
 * Tests unitarios de los motores de predicción y Smart Bets.
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computeModelPrediction,
  computeKnockoutAdvance,
  devigMarket,
  simulateMatch,
  formToScore,
  normalizeELO,
  computeConfidenceLevel,
  type ModelInput,
} from '../lib/predictionEngine'
import { computeSmartBets, type MatchFormEntry } from '../lib/smartBetsEngine'
import { FEEDERS, KNOCKOUT_SCHEDULE, tieWinner, tieLoser } from '../lib/bracket'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function baseInput(overrides: Partial<ModelInput> = {}): ModelInput {
  return {
    homeElo: 1700, awayElo: 1700,
    homeForm: [], awayForm: [],
    homeXg: 1.3, awayXg: 1.3,
    homeXga: 1.1, awayXga: 1.1,
    homeInjuryImpact: 0, awayInjuryImpact: 0,
    ...overrides,
  }
}

function formEntry(overrides: Partial<MatchFormEntry> = {}): MatchFormEntry {
  return {
    kickoff_time: '2026-06-20T18:00:00Z',
    result: 'W',
    goals_scored: 2, goals_conceded: 1,
    is_clean_sheet: false, btts: true,
    over_2_5: true, over_1_5: true,
    opponent_name: 'Rival',
    xg: 1.8, xga: 1.0, shots: 14, shots_on_target: 5,
    corners: 6, yellow_cards: 2, red_cards: 0,
    fouls: 12, possession: 55, big_chances: 3,
    ...overrides,
  }
}

// ─── predictionEngine ────────────────────────────────────────────────────────

test('las probabilidades 1X2 siempre suman ~1', () => {
  const cases: Partial<ModelInput>[] = [
    {},
    { homeElo: 1900, awayElo: 1500 },
    { homeXg: 2.5, awayXg: 0.6, homeXga: 0.7, awayXga: 1.9 },
    { homeInjuryImpact: 40, awayInjuryImpact: 5 },
    { homeForm: ['W', 'W', 'W'], awayForm: ['L', 'L', 'L'] },
  ]
  for (const c of cases) {
    const r = computeModelPrediction(baseInput(c))
    const sum = r.home + r.draw + r.away
    assert.ok(Math.abs(sum - 1) < 0.005, `suma ${sum} para ${JSON.stringify(c)}`)
    assert.ok(r.home > 0 && r.draw > 0 && r.away > 0, 'ninguna probabilidad es 0')
  }
})

test('entrada simétrica produce salida simétrica (sin sesgo de local)', () => {
  const r = computeModelPrediction(baseInput())
  assert.ok(Math.abs(r.home - r.away) < 0.02, `home ${r.home} vs away ${r.away}`)
  assert.equal(r.predictedHome, r.predictedAway)
})

test('el favorito por ELO tiene más probabilidad de ganar', () => {
  const r = computeModelPrediction(baseInput({ homeElo: 1900, awayElo: 1550 }))
  assert.ok(r.home > r.away, `favorito ${r.home} debe superar ${r.away}`)
})

test('el marcador estimado coincide con el marcador exacto más probable', () => {
  const r = computeModelPrediction(baseInput({ homeXg: 2.2, awayXg: 0.8 }))
  assert.equal(r.predictedHome, r.exactScores[0].home)
  assert.equal(r.predictedAway, r.exactScores[0].away)
})

test('computeKnockoutAdvance: simétrico da 50/50 y siempre suma 1', () => {
  const eq = computeKnockoutAdvance({ home: 0.37, draw: 0.26, away: 0.37 }, 1700, 1700)
  assert.equal(eq.home, 0.5)
  assert.equal(eq.away, 0.5)

  const fav = computeKnockoutAdvance({ home: 0.45, draw: 0.27, away: 0.28 }, 1850, 1650)
  assert.ok(fav.home > 0.5, 'el favorito clasifica con >50%')
  assert.ok(Math.abs(fav.home + fav.away - 1) < 0.001)
})

test('devigMarket: quita el margen y suma 1; rechaza cuotas inválidas', () => {
  const fair = devigMarket(2.0, 3.4, 4.1)
  assert.ok(fair)
  assert.ok(Math.abs(fair!.home + fair!.draw + fair!.away - 1) < 1e-9)
  assert.ok(fair!.home > fair!.draw && fair!.draw > fair!.away)

  assert.equal(devigMarket(1.0, 3.4, 4.1), null)
  assert.equal(devigMarket(0, 3.4, 4.1), null)
})

test('simulateMatch: lambdas iguales dan probabilidades iguales', () => {
  const { probabilities } = simulateMatch(1.4, 1.4)
  assert.ok(Math.abs(probabilities.home - probabilities.away) < 0.001)
})

test('formToScore: extremos y caso vacío', () => {
  assert.equal(formToScore(['W', 'W', 'W']), 1)
  assert.equal(formToScore(['L', 'L']), 0)
  assert.equal(formToScore([]), 0.5)
  assert.equal(formToScore(['D']), 0.5)
})

test('normalizeELO y computeConfidenceLevel: rangos válidos', () => {
  assert.equal(normalizeELO(1700, 1700), 0.5)
  assert.ok(normalizeELO(2000, 1400) > 0.9)
  assert.equal(computeConfidenceLevel(90), 5)
  assert.equal(computeConfidenceLevel(50), 1)
})

test('Dixon-Coles: infla los empates frente al Poisson independiente', () => {
  const withDC    = simulateMatch(1.25, 1.15)          // rho por defecto (-0.11)
  const withoutDC = simulateMatch(1.25, 1.15, 0)       // Poisson puro
  assert.ok(withDC.probabilities.draw > withoutDC.probabilities.draw,
    `empate con DC ${withDC.probabilities.draw} debe superar ${withoutDC.probabilities.draw}`)
  const sum = withDC.probabilities.home + withDC.probabilities.draw + withDC.probabilities.away
  assert.ok(Math.abs(sum - 1) < 0.005, 'sigue sumando 1 tras la corrección')
})

test('eliminatorias: menos goles esperados y más probabilidad de empate en 90 min', () => {
  const group    = computeModelPrediction(baseInput())
  const knockout = computeModelPrediction(baseInput({ isKnockout: true }))
  assert.ok(knockout.draw >= group.draw,
    `empate eliminatoria ${knockout.draw} >= grupos ${group.draw}`)
  const kSum = knockout.home + knockout.draw + knockout.away
  assert.ok(Math.abs(kSum - 1) < 0.005)
})

test('mezcla de mercado: acerca las probabilidades a las cuotas devigueadas', () => {
  const solo = computeModelPrediction(baseInput())
  const conMercado = computeModelPrediction(baseInput({
    marketProbabilities: { home: 0.60, draw: 0.25, away: 0.15 },
  }))
  assert.ok(conMercado.home > solo.home,
    `mercado favorable al local debe subir su prob: ${conMercado.home} > ${solo.home}`)
  const sum = conMercado.home + conMercado.draw + conMercado.away
  assert.ok(Math.abs(sum - 1) < 0.005, 'suma 1 tras la mezcla')
})

test('lesiones simétricas no crean sesgo', () => {
  const r = computeModelPrediction(baseInput({ homeInjuryImpact: 45, awayInjuryImpact: 45 }))
  assert.ok(Math.abs(r.home - r.away) < 0.02, `home ${r.home} vs away ${r.away} con lesiones iguales`)
})

// ─── smartBetsEngine ─────────────────────────────────────────────────────────

const PREDICTION = {
  home_win_probability: 0.45,
  draw_probability: 0.27,
  away_win_probability: 0.28,
  confidence_score: 70,
}

test('computeSmartBets: sin predicción o sin datos devuelve []', () => {
  assert.deepEqual(computeSmartBets(null, null, null, {}, {}, []), [])
  // Sin forma reciente NI estadísticas: no se inventan picks
  assert.deepEqual(
    computeSmartBets(PREDICTION, null, null, { name: 'A' }, { name: 'B' }, [], undefined, [], [], []),
    [],
  )
})

test('computeSmartBets: con datos genera máximo 5 picks, ordenados por confianza', () => {
  const homeForm = [formEntry(), formEntry({ goals_scored: 3 }), formEntry({ result: 'D', goals_scored: 1 })]
  const awayForm = [formEntry({ result: 'L', goals_scored: 0, goals_conceded: 2 }), formEntry(), formEntry()]
  const bets = computeSmartBets(
    PREDICTION, null, null,
    { id: 'h', name: 'Colombia', short_name: 'COL' },
    { id: 'a', name: 'Ghana', short_name: 'GHA' },
    [], undefined, [], homeForm, awayForm,
  )
  assert.ok(bets.length > 0, 'genera al menos un pick con datos')
  assert.ok(bets.length <= 5, `máximo 5 picks, devolvió ${bets.length}`)
  for (let i = 1; i < bets.length; i++) {
    assert.ok(bets[i - 1].confidence >= bets[i].confidence, 'orden por confianza descendente')
  }
  for (const b of bets) {
    assert.ok(b.confidence >= 0 && b.confidence <= 100)
    assert.ok(['premium', 'muy_fuerte', 'fuerte', 'moderada', 'evitar'].includes(b.tier))
  }
})

test('computeSmartBets: el edge usa probabilidad justa (devig de pares)', () => {
  const homeForm = [formEntry(), formEntry(), formEntry()]
  const awayForm = [formEntry({ result: 'L' }), formEntry(), formEntry()]
  // btts_yes 0.55 + btts_no 0.55 = 1.10 de overround → devig a 0.5/0.5
  const odds = [
    { market: 'btts_yes', implied_probability: 0.55, odds_value: 1.82 },
    { market: 'btts_no', implied_probability: 0.55, odds_value: 1.82 },
  ]
  const bets = computeSmartBets(
    PREDICTION, null, null,
    { id: 'h', name: 'A' }, { id: 'a', name: 'B' },
    [], undefined, odds, homeForm, awayForm,
  )
  const btts = bets.find(b => b.id === 'btts_yes' || b.id === 'btts_no')
  if (btts && btts.edge !== null) {
    // edge = modelo − 50 (probabilidad justa), no modelo − 55 (con margen)
    const expected = Math.round((btts.confidence / 100 - 0.5) * 1000) / 10
    assert.ok(Math.abs(btts.edge - expected) < 0.2,
      `edge ${btts.edge} debería ser ~${expected} (vs prob justa 0.50)`)
  }
})

// ─── lib/bracket ─────────────────────────────────────────────────────────────

test('bracket: FEEDERS cubre 217-232 y cada cruce tiene horario', () => {
  for (let n = 217; n <= 232; n++) {
    assert.ok(FEEDERS[n], `falta feeder para el partido ${n}`)
    assert.ok(KNOCKOUT_SCHEDULE[n], `falta horario para el partido ${n}`)
  }
  // Los octavos consumen exactamente los 16 partidos de dieciseisavos
  const r32Consumed = new Set<number>()
  for (let n = 217; n <= 224; n++) {
    r32Consumed.add(FEEDERS[n].a); r32Consumed.add(FEEDERS[n].b)
  }
  assert.equal(r32Consumed.size, 16)
  for (let n = 201; n <= 216; n++) assert.ok(r32Consumed.has(n), `R32 ${n} sin destino`)
  // Tercer puesto usa perdedores de semis; final usa ganadores
  assert.equal(FEEDERS[231].losers, true)
  assert.deepEqual([FEEDERS[232].a, FEEDERS[232].b], [229, 230])
})

test('bracket: tieWinner resuelve victoria, penales y casos indefinidos', () => {
  const base = { id: 'x', match_number: 201, status: 'finished', home_team_id: 'H', away_team_id: 'A',
    home_penalties: null as number | null, away_penalties: null as number | null }
  assert.equal(tieWinner({ ...base, home_score: 2, away_score: 1 }), 'H')
  assert.equal(tieWinner({ ...base, home_score: 0, away_score: 3 }), 'A')
  assert.equal(tieWinner({ ...base, home_score: 1, away_score: 1, home_penalties: 4, away_penalties: 3 }), 'H')
  assert.equal(tieWinner({ ...base, home_score: 1, away_score: 1, home_penalties: 2, away_penalties: 4 }), 'A')
  // Empate sin penales registrados → indefinido (no avanza)
  assert.equal(tieWinner({ ...base, home_score: 1, away_score: 1 }), null)
  // No terminado → indefinido
  assert.equal(tieWinner({ ...base, status: 'scheduled', home_score: null as any, away_score: null as any }), null)
  // Perdedor para el tercer puesto
  assert.equal(tieLoser({ ...base, home_score: 0, away_score: 1 }), 'H')
})
