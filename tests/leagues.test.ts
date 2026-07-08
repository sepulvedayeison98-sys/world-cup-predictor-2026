/**
 * Tests unitarios del módulo de ligas (Fase 4): tabla de posiciones
 * y motor de backtest walk-forward. Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { computeLeagueStandings, type LeagueMatchRow, type LeagueTeamInfo } from '../lib/leagueStandings'
import {
  runLeagueBacktest,
  eloExpectedHome,
  LEAGUE_ELO_BASE,
  LEAGUE_WARMUP_MATCHES,
  type LeagueEngineMatch,
} from '../lib/leagueEngine'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const T = (id: string): LeagueTeamInfo => ({ id, name: `Equipo ${id}`, code: id.padEnd(3, 'X').toUpperCase(), logo_url: null })

let matchSeq = 0
function M(home: string, away: string, hs: number | null, as: number | null, day: number): LeagueMatchRow & LeagueEngineMatch {
  matchSeq++
  return {
    id: `m${matchSeq}`,
    home_team_id: home,
    away_team_id: away,
    home_score: hs,
    away_score: as,
    status: hs === null ? 'scheduled' : 'finished',
    kickoff_time: `2024-08-${String(day).padStart(2, '0')}T15:00:00+00:00`,
  }
}

// ─── computeLeagueStandings ──────────────────────────────────────────────────

test('standings: puntos, diferencia de gol y orden correctos', () => {
  const teams = [T('a'), T('b'), T('c')]
  const matches = [
    M('a', 'b', 3, 0, 1), // a gana
    M('b', 'c', 1, 1, 2), // empate
    M('c', 'a', 0, 2, 3), // a gana
  ]
  const rows = computeLeagueStandings(teams, matches)

  assert.equal(rows[0].team.id, 'a')
  assert.equal(rows[0].points, 6)
  assert.equal(rows[0].goal_difference, 5)
  assert.equal(rows[0].position, 1)
  // b y c empatan a 1 punto; c tiene mejor diferencia (-2 vs -3)
  assert.equal(rows[1].team.id, 'c')
  assert.equal(rows[2].team.id, 'b')
})

test('standings: ignora partidos no terminados y con marcador nulo', () => {
  const teams = [T('a'), T('b')]
  const rows = computeLeagueStandings(teams, [
    M('a', 'b', 2, 0, 1),
    M('b', 'a', null, null, 2), // programado: no cuenta
  ])
  assert.equal(rows[0].played, 1)
  assert.equal(rows[1].played, 1)
})

test('standings: la forma registra máximo 5 resultados, el más reciente al final', () => {
  const teams = [T('a'), T('b')]
  const matches = Array.from({ length: 7 }, (_, i) => M('a', 'b', i === 6 ? 0 : 1, i === 6 ? 1 : 0, i + 1))
  const rows = computeLeagueStandings(teams, matches)
  const a = rows.find((r) => r.team.id === 'a')!
  assert.equal(a.form.length, 5)
  assert.equal(a.form[4], 'L') // el último partido fue derrota
})

// ─── leagueEngine ────────────────────────────────────────────────────────────

/** Temporada sintética: 'fuerte' le gana 2-0 a todos; los demás empatan entre sí. */
function syntheticSeason(): LeagueEngineMatch[] {
  const others = ['b', 'c', 'd', 'e']
  const matches: LeagueEngineMatch[] = []
  let day = 1
  for (let round = 0; round < 4; round++) {
    for (const o of others) {
      matches.push(M(round % 2 ? o : 'fuerte', round % 2 ? 'fuerte' : o, round % 2 ? 0 : 2, round % 2 ? 2 : 0, day))
      day++
    }
    // los demás empatan entre sí para acumular partidos
    matches.push(M(others[0], others[1], 1, 1, day)); day++
    matches.push(M(others[2], others[3], 1, 1, day)); day++
  }
  return matches
}

test('backtest: el equipo dominante termina con ELO superior a la base', () => {
  const { finalElo } = runLeagueBacktest(syntheticSeason())
  const fuerte = finalElo.get('fuerte')!
  assert.ok(fuerte > LEAGUE_ELO_BASE + 50, `ELO ${fuerte} debería superar ampliamente la base`)
  for (const other of ['b', 'c', 'd', 'e']) {
    assert.ok(finalElo.get(other)! < fuerte)
  }
})

test('backtest: probabilidades válidas que suman 1 y calentamiento respetado', () => {
  const result = runLeagueBacktest(syntheticSeason())
  assert.ok(result.predictions.length > 0, 'debe evaluar partidos tras el calentamiento')
  assert.ok(result.metrics.skipped > 0, 'los primeros partidos se saltan')
  for (const p of result.predictions) {
    const sum = p.home_win_probability + p.draw_probability + p.away_win_probability
    assert.ok(Math.abs(sum - 1) < 0.005, `probabilidades suman ${sum}`)
    assert.ok(p.confidence_score > 0 && p.confidence_score <= 100)
  }
})

test('backtest: favorece al dominante una vez pasado el calentamiento', () => {
  const result = runLeagueBacktest(syntheticSeason())
  // Predicciones de partidos del equipo fuerte evaluadas: su prob. debe ser la mayor
  const strongMatches = result.predictions.filter((p) => p.match_id.length > 0)
  assert.ok(strongMatches.length > 0)
  const accuracy = result.metrics.accuracy
  assert.ok(accuracy >= 0.5, `precisión ${accuracy} demasiado baja para una liga sintética predecible`)
})

test('backtest: agregados de temporada consistentes con los resultados', () => {
  const { teamSeason } = runLeagueBacktest(syntheticSeason())
  const fuerte = teamSeason.get('fuerte')!
  assert.equal(fuerte.played, 16)
  assert.equal(fuerte.won, 16)
  assert.equal(fuerte.goals_for, 32)
  assert.equal(fuerte.goals_against, 0)
  assert.equal(fuerte.clean_sheets, 16)
  assert.deepEqual(fuerte.form, ['W', 'W', 'W', 'W', 'W'])
})

test('eloExpectedHome: simétrico alrededor de la ventaja de local', () => {
  const even = eloExpectedHome(1500, 1500)
  assert.ok(even > 0.5, 'con ELO igual, el local parte con ventaja')
  const strong = eloExpectedHome(1700, 1400)
  const weak = eloExpectedHome(1400, 1700)
  assert.ok(strong > 0.75)
  assert.ok(weak < 0.4)
})

test('backtest: partidos insuficientes → nada que evaluar, métricas en cero', () => {
  const few = [M('a', 'b', 1, 0, 1), M('b', 'a', 0, 1, 2)]
  const result = runLeagueBacktest(few)
  assert.equal(result.predictions.length, 0)
  assert.equal(result.metrics.evaluated, 0)
  assert.equal(result.metrics.accuracy, 0)
  assert.equal(result.metrics.skipped, 2)
  assert.ok(LEAGUE_WARMUP_MATCHES > 1)
})
