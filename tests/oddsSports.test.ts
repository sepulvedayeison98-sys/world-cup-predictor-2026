/**
 * Emparejamiento de equipos entre The Odds API y nuestra base.
 *
 * ── Por qué hace falta ────────────────────────────────────────────────────
 * `lib/teamMapping.ts` traducía nombre → código FIFA y está escrito a mano
 * para las 48 selecciones del Mundial. Al llevar las cuotas a las ligas hay
 * que emparejar cientos de clubes cuyo nombre cada fuente escribe distinto,
 * y ya no hay código que sirva de puente.
 *
 * ── Qué se protege ────────────────────────────────────────────────────────
 * El fallo caro aquí no es dejar de emparejar: es emparejar MAL. Una cuota
 * colgada del partido equivocado produce una apuesta de valor plausible
 * sobre un encuentro que no es, y eso no se detecta mirando la página. Por
 * eso todo caso ambiguo devuelve null: antes ninguna cuota que una falsa.
 *
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeTeamName, buildTeamIndex, matchTeam, oddsSportByCompetition,
} from '../lib/oddsSports'
import { LEAGUE_SLUGS, LIBERTADORES_COMPETITION_ID } from '../lib/constants'

test('la normalización absorbe acentos, puntuación y afijos societarios', () => {
  assert.equal(normalizeTeamName('FC Barcelona'), 'barcelona')
  assert.equal(normalizeTeamName('Barcelona FC'), 'barcelona')
  assert.equal(normalizeTeamName('Atlético Madrid'), 'atletico madrid')
  assert.equal(normalizeTeamName('Borussia M.Gladbach'), 'borussia m gladbach')
  assert.equal(normalizeTeamName('  Inter   Milan  '), 'inter milan')
})

test('no se tocan las palabras que distinguen clubes reales', () => {
  // Quitar "Deportivo" o "Real" acortaría el nombre, pero fusionaría equipos
  // distintos de la misma ciudad. Se conservan a propósito.
  assert.equal(normalizeTeamName('Deportivo Cali'), 'deportivo cali')
  assert.notEqual(normalizeTeamName('Deportivo Cali'), normalizeTeamName('América de Cali'))
  assert.equal(normalizeTeamName('Real Sociedad'), 'real sociedad')
})

test('empareja por nombre exacto y por nombre corto', () => {
  const index = buildTeamIndex([
    { id: 'a', name: 'Manchester United', short_name: 'Man United' },
    { id: 'b', name: 'Osasuna', short_name: null },
  ])
  assert.equal(matchTeam(index, 'Manchester United'), 'a')
  assert.equal(matchTeam(index, 'Man United'), 'a')
  assert.equal(matchTeam(index, 'CA Osasuna'), 'b')
})

test('empareja por contención cuando hay un solo candidato', () => {
  const index = buildTeamIndex([
    { id: 'w', name: 'Wolverhampton Wanderers', short_name: null },
  ])
  assert.equal(matchTeam(index, 'Wolverhampton'), 'w')
})

test('la ambigüedad devuelve null en vez de elegir', () => {
  // "Manchester" contiene a dos clubes: emparejar al azar colgaría la cuota
  // del partido equivocado.
  const index = buildTeamIndex([
    { id: 'utd', name: 'Manchester United', short_name: null },
    { id: 'cty', name: 'Manchester City', short_name: null },
  ])
  assert.equal(matchTeam(index, 'Manchester'), null)
  // Cada uno por su nombre completo sí resuelve.
  assert.equal(matchTeam(index, 'Manchester United'), 'utd')
  assert.equal(matchTeam(index, 'Manchester City'), 'cty')
})

test('un nombre normalizado compartido por dos equipos se descarta de los dos', () => {
  const index = buildTeamIndex([
    { id: 'x', name: 'Racing Club', short_name: 'Racing' },
    { id: 'y', name: 'Racing', short_name: null },
  ])
  // 'racing' apunta a dos equipos: sale del índice y no empareja a ciegas.
  assert.equal(index.get('racing'), undefined)
})

test('un nombre desconocido no inventa un equipo', () => {
  const index = buildTeamIndex([{ id: 'a', name: 'Osasuna', short_name: null }])
  assert.equal(matchTeam(index, 'Getafe'), null)
  assert.equal(matchTeam(index, ''), null)
})

test('cada competición en curso tiene su clave de deporte', () => {
  const map = oddsSportByCompetition()
  for (const [slug, id] of Object.entries(LEAGUE_SLUGS)) {
    assert.ok(map.has(id), `falta la clave de The Odds API para ${slug}`)
  }
  assert.equal(map.get(LIBERTADORES_COMPETITION_ID), 'soccer_conmebol_copa_libertadores')
})
