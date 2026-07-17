/**
 * DOMINIO TENNIS — pruebas del motor tennis-2.0 (composición final elegida
 * por ablación): ancla ranking+ELO, ELO de superficie, forma,
 * saque/devolución walk-forward, H2H y renormalización.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createWalkState2, advanceWalkState2, extractFactors2, predictTennisMatch2,
  SR_MIN_MATCHES, type T2MatchStats,
} from '../lib/tennis/engine2'
import { TENNIS2_WEIGHTS } from '../lib/tennis/constants'
import type { TEngineMatch } from '../lib/tennis/engine'

const m = (over: Partial<TEngineMatch>): TEngineMatch => ({
  id: 'x', p1_id: 'A', p2_id: 'B', winner_id: 'A', surface: 'hard',
  status: 'finished', scheduled_at: '2025-01-01', round: 'R32',
  external_id: '2025-100-1', ...over,
})
const st = (o: Partial<T2MatchStats>): T2MatchStats => ({
  service_games: null, break_points_faced: null, break_points_saved: null, ...o,
})

test('pesos 2.0 suman 1 y el ancla rankingElo es el mayor', () => {
  const sum = Object.values(TENNIS2_WEIGHTS).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(sum - 1) < 1e-12)
  assert.ok(TENNIS2_WEIGHTS.rankingElo >= Math.max(...Object.values(TENNIS2_WEIGHTS)))
})

test('ancla rankingElo: debutantes con ranking → señal de ratio; sin nada → null', () => {
  const s = createWalkState2()
  const f = extractFactors2(s, m({ winner_id: null }), 1, 99)!
  assert.ok(Math.abs((f.rankingElo ?? 0) - 99 / 100) < 1e-9)
  const g = extractFactors2(s, m({ winner_id: null }))!
  assert.equal(g.rankingElo, null)
})

test('saque/devolución: el dominador al saque y resto es favorito del factor', () => {
  const s = createWalkState2()
  for (let i = 0; i < SR_MIN_MATCHES; i++) {
    advanceWalkState2(s, m({ p1_id: 'A', p2_id: `R${i}`, winner_id: 'A', external_id: `2025-1-${i + 1}` }), {
      p1: st({ service_games: 12, break_points_faced: 2, break_points_saved: 2 }),
      p2: st({ service_games: 12, break_points_faced: 6, break_points_saved: 3 }),
    })
    advanceWalkState2(s, m({ p1_id: 'B', p2_id: `S${i}`, winner_id: `S${i}`, external_id: `2025-2-${i + 1}` }), {
      p1: st({ service_games: 12, break_points_faced: 6, break_points_saved: 3 }),
      p2: st({ service_games: 12, break_points_faced: 0, break_points_saved: 0 }),
    })
  }
  const f = extractFactors2(s, m({ p1_id: 'A', p2_id: 'B', winner_id: null }))!
  assert.ok(f.serveReturn != null && f.serveReturn > 0.7, `serveReturn=${f.serveReturn}`)
})

test('saque/devolución: sin mínimo de partidos con stats → factor null', () => {
  const s = createWalkState2()
  advanceWalkState2(s, m({}), {
    p1: st({ service_games: 12, break_points_faced: 2, break_points_saved: 2 }),
    p2: st({ service_games: 12, break_points_faced: 2, break_points_saved: 2 }),
  })
  const f = extractFactors2(s, m({ winner_id: null, external_id: '2025-1-9' }))!
  assert.equal(f.serveReturn, null) // 1 < SR_MIN_MATCHES
})

test('superficie: jerarquía medida — superficie → ELO global → ranking → null', () => {
  const s = createWalkState2()
  // A jugó en clay; B jugó solo en hard → sin superficie común: cae a ELO global
  advanceWalkState2(s, m({ p1_id: 'A', p2_id: 'X', winner_id: 'A', surface: 'clay', external_id: '2025-5-1' }))
  advanceWalkState2(s, m({ p1_id: 'B', p2_id: 'Y', winner_id: 'Y', surface: 'hard', external_id: '2025-5-2' }))
  const f = extractFactors2(s, m({ p1_id: 'A', p2_id: 'B', winner_id: null, surface: 'clay' }))!
  assert.ok(f.surfaceElo != null && f.surfaceElo > 0.5, 'respaldo: ELO global (A ganó, B perdió)')
  // Debutantes absolutos con ranking → respaldo de ranking (logElo)
  const s2 = createWalkState2()
  const g = extractFactors2(s2, m({ p1_id: 'C', p2_id: 'D', winner_id: null }), 1, 100)!
  assert.ok(g.surfaceElo != null && g.surfaceElo > 0.5)
  // Sin señal alguna → null (no se fabrica)
  const h = extractFactors2(s2, m({ p1_id: 'C', p2_id: 'D', winner_id: null }))!
  assert.equal(h.surfaceElo, null)
})

test('predictTennisMatch2: renormaliza (proporciones 40:15) y null sin factores', () => {
  assert.equal(predictTennisMatch2({ rankingElo: null, surfaceElo: null, form: null, serveReturn: null, headToHead: null, market: null }), null)
  const p = predictTennisMatch2({ rankingElo: 0.7, surfaceElo: null, form: null, serveReturn: 0.6, headToHead: null, market: null })!
  const sum = Object.values(p.effectiveWeights).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(sum - 1) < 1e-9)
  assert.ok(Math.abs(p.effectiveWeights.rankingElo - 0.40 / 0.55) < 1e-9)
  assert.ok(Math.abs(p.effectiveWeights.serveReturn - 0.15 / 0.55) < 1e-9)
  assert.equal(p.favorite, 'p1')
})

test('walkover no toca acumuladores de saque/devolución', () => {
  const s = createWalkState2()
  advanceWalkState2(s, m({ status: 'walkover' }), {
    p1: st({ service_games: 12, break_points_faced: 2, break_points_saved: 2 }),
    p2: st({ service_games: 12, break_points_faced: 2, break_points_saved: 2 }),
  })
  assert.equal(s.sr.size, 0)
  assert.equal(s.base.elo.size, 0)
})
