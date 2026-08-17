/**
 * Tests del acceso en lote del tracking de Smart Bets.
 * Cubren las dos piezas puras de la optimización: el agrupado de forma
 * reciente (antes eran dos consultas por partido) y el acotado por
 * competición, que es además la barrera de aislamiento por deporte.
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { groupFormsByTeam, toFormEntry, FORM_WINDOW } from '../lib/teamForm'
import { resolveCompetitionScope } from '../services/smartBetTracking'
import { competitionIdsOfSport } from '../lib/sports'
import { leagueAllCompetitionIds, LEAGUE_COMPETITION_IDS } from '../lib/constants'
import { chunk } from '../lib/fetchAll'

const NBA_COMPETITION = '12000000-0000-4000-8000-000000000012'

/** Partido finalizado mínimo, tal como lo devuelve la consulta de forma. */
function match(id: string, home: string, away: string, hs: number, as: number, kickoff: string) {
  return {
    id,
    kickoff_time: kickoff,
    home_score: hs,
    away_score: as,
    home_team_id: home,
    away_team_id: away,
    home_team: { name: `Equipo ${home}`, short_name: home },
    away_team: { name: `Equipo ${away}`, short_name: away },
    match_statistics: [],
  }
}

// ── Forma en lote ───────────────────────────────────────────────────────────

test('cada partido alimenta la forma de los DOS equipos que lo jugaron', () => {
  const forms = groupFormsByTeam([match('m1', 'A', 'B', 2, 0, '2026-08-01T00:00:00Z')])

  assert.equal(forms.get('A')?.length, 1)
  assert.equal(forms.get('B')?.length, 1)
  assert.equal(forms.get('A')?.[0].result, 'W')
  assert.equal(forms.get('B')?.[0].result, 'L')
  assert.equal(forms.get('A')?.[0].goals_scored, 2)
  assert.equal(forms.get('B')?.[0].goals_scored, 0)
  assert.equal(forms.get('A')?.[0].opponent_name, 'B')
})

test('el agrupado conserva el orden recibido: del más reciente al más antiguo', () => {
  const forms = groupFormsByTeam([
    match('m3', 'A', 'C', 1, 1, '2026-08-03T00:00:00Z'),
    match('m2', 'B', 'A', 0, 3, '2026-08-02T00:00:00Z'),
    match('m1', 'A', 'B', 2, 0, '2026-08-01T00:00:00Z'),
  ])

  assert.deepEqual(forms.get('A')?.map((e) => e.result), ['D', 'W', 'W'])
  assert.deepEqual(forms.get('A')?.map((e) => e.kickoff_time), [
    '2026-08-03T00:00:00Z', '2026-08-02T00:00:00Z', '2026-08-01T00:00:00Z',
  ])
})

test('la ventana de forma corta en FORM_WINDOW partidos por equipo', () => {
  const rows = Array.from({ length: FORM_WINDOW + 5 }, (_, i) =>
    match(`m${i}`, 'A', `rival${i}`, 1, 0, `2026-08-${String(20 - i).padStart(2, '0')}T00:00:00Z`))

  const forms = groupFormsByTeam(rows)

  assert.equal(forms.get('A')?.length, FORM_WINDOW)
  // Se quedan los primeros de la lista, que son los más recientes
  assert.equal(forms.get('A')?.[0].kickoff_time, '2026-08-20T00:00:00Z')
  assert.equal(forms.get('rival0')?.length, 1)
})

test('el agrupado en lote coincide con el mapeo de un solo equipo', () => {
  const m = match('m1', 'A', 'B', 3, 1, '2026-08-01T00:00:00Z')

  assert.deepEqual(groupFormsByTeam([m]).get('A')?.[0], toFormEntry(m, 'A'))
  assert.deepEqual(groupFormsByTeam([m]).get('B')?.[0], toFormEntry(m, 'B'))
})

test('un partido sin uno de los equipos no rompe el agrupado', () => {
  const huerfano = { ...match('m1', 'A', 'B', 1, 0, '2026-08-01T00:00:00Z'), away_team_id: null }

  const forms = groupFormsByTeam([huerfano])

  assert.equal(forms.size, 1)
  assert.equal(forms.get('A')?.length, 1)
})

// ── Acotado por competición (aislamiento por deporte) ───────────────────────

test('sin acotar corre sobre toda la lista blanca de fútbol', () => {
  assert.deepEqual(resolveCompetitionScope(), competitionIdsOfSport('futbol'))
  assert.deepEqual(resolveCompetitionScope({ leagues: [], competitionIds: [] }),
    competitionIdsOfSport('futbol'))
})

test('acotar por liga incluye TODAS sus temporadas', () => {
  const scope = resolveCompetitionScope({ leagues: ['premier_league'] })

  assert.deepEqual(scope.sort(), leagueAllCompetitionIds('premier_league').sort())
  assert.ok(scope.includes(LEAGUE_COMPETITION_IDS.premier_league))
})

test('una liga desconocida falla en vez de correr sobre todo', () => {
  assert.throws(() => resolveCompetitionScope({ leagues: ['liga_inventada'] }), /Liga desconocida/)
})

test('el acotado nunca deja pasar una competición de otro deporte', () => {
  // Pedir la NBA a mano no la mete al pipeline de fútbol: se intersecta
  // siempre contra la lista blanca del deporte.
  assert.throws(
    () => resolveCompetitionScope({ competitionIds: [NBA_COMPETITION] }),
    /ninguna competición de fútbol/,
  )

  const mixto = resolveCompetitionScope({
    competitionIds: [NBA_COMPETITION, LEAGUE_COMPETITION_IDS.la_liga],
  })
  assert.deepEqual(mixto, [LEAGUE_COMPETITION_IDS.la_liga])
})

test('el acotado no repite competiciones aunque se pidan dos veces', () => {
  const scope = resolveCompetitionScope({
    leagues: ['la_liga'],
    competitionIds: [LEAGUE_COMPETITION_IDS.la_liga],
  })

  assert.equal(new Set(scope).size, scope.length)
})

// ── Troceado de lotes ───────────────────────────────────────────────────────

test('chunk parte en lotes sin perder ni duplicar elementos', () => {
  const items = Array.from({ length: 450 }, (_, i) => i)
  const batches = chunk(items, 200)

  assert.deepEqual(batches.map((b) => b.length), [200, 200, 50])
  assert.deepEqual(batches.flat(), items)
  assert.deepEqual(chunk([], 200), [])
})
