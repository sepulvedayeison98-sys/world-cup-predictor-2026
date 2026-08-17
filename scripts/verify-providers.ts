/**
 * Verificación en vivo de la capa de proveedores deportivos.
 *
 * No es un test unitario: llama a las APIs de verdad. Existe porque un
 * adapter puede compilar y pasar todos los tests y aun así estar roto — las
 * fuentes cambian de forma sin avisar y ninguna publica un contrato estable.
 * Este script es el que responde "¿sigue funcionando hoy?".
 *
 *   npm run verify:providers
 *
 * Consume cuota real de API-Football (unas 6 peticiones) y de The Odds API
 * (1, y solo si `ODDS_API_KEY` está presente). ESPN no tiene cuota.
 * Termina con código 1 si algún módulo obligatorio falla.
 */

import { footballService } from '../services/sports/football/football.service'
import { nbaService } from '../services/sports/nba/nba.service'
import { tennisService } from '../services/sports/tennis/tennis.service'
import { oddsService } from '../services/sports/odds/odds.service'
import { newsService } from '../services/sports/news/news.service'
import { accountStatus } from '../services/sports/providers/api-football/client'
import { providerInventory } from '../services/sports/core/registry'
import type { DataResult } from '../services/sports/core/types'

let failures = 0
let skipped = 0

function report<T>(label: string, r: DataResult<T>, summarize: (d: T) => string, optional = false) {
  if (r.status === 'ok') {
    console.log(`  ✅ ${label.padEnd(34)} ${summarize(r.data)}   [${r.provenance.provider}]`)
    return
  }
  if (r.status === 'unsupported') {
    console.log(`  ⚪ ${label.padEnd(34)} no cubierto: ${r.reason}`)
    skipped++
    return
  }
  console.log(`  ${optional ? '⚠️ ' : '❌'} ${label.padEnd(34)} ${r.reason} (${r.provider})`)
  if (optional) skipped++
  else failures++
}

/** Fecha reciente con actividad garantizada, en UTC. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
}

async function main() {
  console.log('\n═══ INVENTARIO DE PROVEEDORES ═══')
  for (const [mod, list] of Object.entries(providerInventory())) {
    console.log(`  ${mod.padEnd(12)} ${list.map((p) => p.id).join(' → ') || '(ninguno)'}`)
  }

  console.log('\n═══ CUENTA API-FOOTBALL ═══')
  try {
    const s = await accountStatus()
    console.log(`  plan ${s.plan} · ${s.requestsToday}/${s.requestsLimitDay} hoy · activa=${s.active}`)
  } catch (e) {
    console.log(`  ⚠️  no se pudo leer el estado: ${(e as Error).message}`)
  }

  console.log('\n═══ FÚTBOL (API-Football → ESPN) ═══')
  report('listTeams Premier 2026', await footballService.listTeams({ competitionId: '39', season: 2026 }),
    (d) => `${d.length} equipos, p.ej. ${d[0]?.name} (fund. ${d[0]?.founded ?? 's/d'})`)
  report('getTeam 33', await footballService.getTeam('33'),
    (d) => `${d.name} · ${d.venue?.name ?? 's/estadio'} (${d.venue?.capacity ?? '?'})`)
  report('getSquad 33', await footballService.getSquad('33'),
    (d) => `${d.length} jugadores, p.ej. ${d[0]?.name}`)
  report('getStandings Premier 2025', await footballService.getStandings({ competitionId: '39', season: 2025 }),
    (d) => `${d.length} filas, líder ${d[0]?.teamName} (${d[0]?.points} pts)`)
  report('getInjuries Premier 2025', await footballService.getInjuries({ competitionId: '39', season: 2025 }),
    (d) => `${d.length} partes`, true)
  report('getHeadToHead 33 vs 40', await footballService.getHeadToHead('33', '40', 5),
    (d) => `${d.length} enfrentamientos`)

  console.log('\n═══ NBA (ESPN) ═══')
  report('listTeams', await nbaService.listTeams(), (d) => `${d.length} equipos`)
  report('getStandings', await nbaService.getStandings(),
    (d) => `${d.length} filas · conferencias: ${[...new Set(d.map((s) => s.group))].join(', ')}`)
  report('getGames (hace 120 d)', await nbaService.getGames({ date: daysAgo(120) }),
    (d) => `${d.length} partidos${d[0] ? `, ${d[0].home.name} ${d[0].home.score}-${d[0].away.score} ${d[0].away.name}` : ''}`)

  console.log('\n═══ TENIS (ESPN) ═══')
  report('getRankings ATP', await tennisService.getRankings('ATP', 5),
    (d) => `nº1 ${d[0]?.name} (${d[0]?.points} pts, ${d[0]?.countryCode})`)
  report('getRankings WTA', await tennisService.getRankings('WTA', 5),
    (d) => `nº1 ${d[0]?.name} (${d[0]?.points} pts)`)
  report('getTournaments ATP', await tennisService.getTournaments('ATP'),
    (d) => `${d.length} torneos${d[0] ? `, p.ej. ${d[0].name}` : ''}`)
  report('getMatches ATP (hace 60 d)', await tennisService.getMatches({ tour: 'ATP', date: daysAgo(60) }),
    (d) => `${d.length} partidos individuales${d[0] ? `, ${d[0].home.name} vs ${d[0].away.name} (${d[0].round})` : ''}`)

  console.log('\n═══ NOTICIAS (ESPN) ═══')
  for (const sport of ['futbol', 'baloncesto', 'tenis'] as const) {
    report(`headlines ${sport}`, await newsService.headlines(sport, 3),
      (d) => `${d.length} titulares${d[0] ? `: "${d[0].headline.slice(0, 48)}…"` : ''}`)
  }

  console.log('\n═══ CUOTAS (The Odds API) ═══')
  if (!process.env.ODDS_API_KEY) {
    console.log('  ⚪ ODDS_API_KEY ausente — módulo omitido, no fallido')
    skipped++
  } else {
    report('listSports', await oddsService.listSports(),
      (d) => `${d.length} deportes, ${d.filter((s) => s.active).length} activos`)
  }

  console.log(`\n═══ RESULTADO: ${failures} fallo(s), ${skipped} omitido(s) ═══\n`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('\n❌ La verificación se cayó:', e)
  process.exit(1)
})
