/**
 * Refresco de RESULTADOS de las ligas de fútbol.
 *
 * ── El agujero que tapa ───────────────────────────────────────────────────
 * Hasta ahora, nada mantenía al día los marcadores de las ligas:
 *
 *   · `/api/sync/auto`, que corre cada 15 minutos, apunta a
 *     `soccer/fifa.world` — el Mundial, que terminó en julio. Llevaba días
 *     registrando «0 registros procesados» en cada corrida.
 *   · `services/sync/results.ts` pide a The Odds API los marcadores del
 *     Mundial. Mismo caso.
 *   · Lo único que escribía resultados de liga era `ingestLeagues`, y el
 *     workflow lo dispara **lunes y viernes**.
 *
 * Resultado: un partido que acaba el lunes por la tarde seguía en pantalla
 * como «programado» hasta el viernes. Así apareció un Deportivo–Elche de
 * LaLiga con el marcador en blanco un día después de jugarse (acabó 1-1).
 *
 * ── Por qué un proceso aparte y no correr `ingestLeagues` más veces ──────
 * `ingestLeagues` reingesta la temporada entera: dos peticiones y ~380
 * upserts por liga, escribiendo 2.000 filas que no han cambiado. Esto pide
 * SOLO una ventana de fechas —una petición por liga— y toca únicamente los
 * partidos cuyo estado o marcador difiere de lo que ya tenemos. Sale tan
 * barato que puede correr cada hora.
 *
 * Consume la capa de proveedores: no sabe que detrás hay API-Football.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { footballService } from '@/services/sports/football/football.service'
import { TARGET_LEAGUES, seasonForLeague, DEFAULT_SEASON } from './api-football'
import { LEAGUE_COMPETITION_IDS } from '@/lib/constants'
import type { Fixture } from '@/services/sports/core/types'

/** Estado normalizado del proveedor → nuestro enum `match_status`. */
const STATUS_MAP: Record<Fixture['status'], string> = {
  scheduled: 'scheduled',
  live: 'live',
  finished: 'finished',
  postponed: 'postponed',
  cancelled: 'cancelled',
}

export interface LeagueResultsSyncResult {
  ok: boolean
  leagues: string[]
  /** Partidos que la fuente devolvió en la ventana. */
  fetched: number
  /** Partidos que de verdad cambiaron y se escribieron. */
  updated: number
  /** Detalle de lo actualizado, para que la corrida sea auditable. */
  changes: string[]
  problems: string[]
  durationMs: number
}

/**
 * Refresca estado y marcador de los partidos de las últimas `hoursBack` horas
 * y las próximas `hoursAhead`.
 *
 * La ventana hacia delante existe para los partidos EN VIVO: uno que empezó
 * hace veinte minutos entra por «hacia atrás», pero conviene margen para
 * husos y para partidos que arrancan justo al filo de la corrida.
 */
export async function syncLeagueResults(opts: {
  leagues?: string[]
  hoursBack?: number
  hoursAhead?: number
} = {}): Promise<LeagueResultsSyncResult> {
  const t0 = Date.now()
  const supabase = createAdminClient()
  const hoursBack = opts.hoursBack ?? 48
  const hoursAhead = opts.hoursAhead ?? 6

  const keys = opts.leagues?.length
    ? TARGET_LEAGUES.filter((l) => opts.leagues!.includes(l.key))
    : TARGET_LEAGUES

  const problems: string[] = []
  const changes: string[] = []
  let fetched = 0
  let updated = 0

  const from = new Date(Date.now() - hoursBack * 3_600_000)
  const to = new Date(Date.now() + hoursAhead * 3_600_000)
  const day = (d: Date) => d.toISOString().slice(0, 10)

  for (const league of keys) {
    const competitionId = LEAGUE_COMPETITION_IDS[league.key]
    if (!competitionId) continue

    const season = seasonForLeague(league, DEFAULT_SEASON)
    const result = await footballService.getFixtures({
      competitionId: String(league.apiFootballId),
      season,
      from: day(from),
      to: day(to),
    })
    if (result.status !== 'ok') {
      problems.push(`${league.key}: ${result.reason}`)
      continue
    }
    fetched += result.data.length
    if (result.data.length === 0) continue

    // Lo que ya tenemos, para escribir solo lo que cambia. Un upsert ciego
    // funcionaría, pero movería `updated_at` de partidos intactos y haría
    // imposible saber, leyendo el informe, qué se actualizó de verdad.
    const apiIds = result.data.map((f) => Number(f.ref.id)).filter(Number.isFinite)
    const { data: existing, error } = await supabase
      .from('matches')
      .select('id, api_football_id, status, home_score, away_score')
      .eq('competition_id', competitionId)
      .in('api_football_id', apiIds)
    if (error) throw new Error(`leer partidos de ${league.key}: ${error.message}`)

    const byApiId = new Map((existing ?? []).map((m: any) => [m.api_football_id, m]))

    for (const f of result.data) {
      const apiId = Number(f.ref.id)
      const row = byApiId.get(apiId)
      // Un partido que la fuente conoce y nosotros no es cosa de la ingesta
      // de calendario, no de este proceso: aquí no se crean filas.
      if (!row) continue

      const status = STATUS_MAP[f.status]
      const home = f.home.score
      const away = f.away.score
      if (row.status === status && row.home_score === home && row.away_score === away) continue

      const { error: upErr } = await (supabase.from('matches') as any)
        .update({ status, home_score: home, away_score: away, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (upErr) throw new Error(`actualizar partido ${apiId}: ${upErr.message}`)

      updated++
      changes.push(
        `${league.key} · ${f.home.name} ${home ?? '-'}-${away ?? '-'} ${f.away.name} (${row.status} → ${status})`,
      )
    }
  }

  return {
    ok: problems.length === 0,
    leagues: keys.map((l) => l.key as string),
    fetched,
    updated,
    changes: changes.slice(0, 30),
    problems,
    durationMs: Date.now() - t0,
  }
}
