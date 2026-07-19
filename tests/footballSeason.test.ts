/**
 * Test de la temporada de fútbol dinámica (currentFootballSeason). La
 * campaña europea va de agosto a mayo y API-Football la etiqueta por su AÑO
 * DE INICIO (2024 = 2024-25). Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { currentFootballSeason } from '../services/sync/api-football'

const at = (iso: string) => currentFootballSeason(new Date(iso))

test('julio en adelante → campaña que arranca ese año (fixtures ya publicados)', () => {
  assert.equal(at('2026-07-01T00:00:00Z'), 2026) // 2026-27
  assert.equal(at('2026-08-15T00:00:00Z'), 2026)
  assert.equal(at('2026-12-20T00:00:00Z'), 2026)
})

test('enero a junio → campaña que empezó el año anterior (segunda mitad)', () => {
  assert.equal(at('2027-01-10T00:00:00Z'), 2026) // aún 2026-27
  assert.equal(at('2027-05-25T00:00:00Z'), 2026) // fin de 2026-27
  assert.equal(at('2026-06-15T00:00:00Z'), 2025) // fin de 2025-26
})

test('borde exacto del 1 de julio (UTC)', () => {
  assert.equal(at('2026-06-30T23:59:59Z'), 2025)
  assert.equal(at('2026-07-01T00:00:00Z'), 2026)
})
