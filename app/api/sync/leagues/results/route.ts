import { NextRequest, NextResponse } from 'next/server'
import { syncLeagueResults } from '@/services/sync/league-results'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/sync/leagues/results?league=…&hoursBack=…&hoursAhead=…
 *
 * Refresca estado y marcador de los partidos de liga recientes. Una petición
 * por liga (seis en total), así que sale barato correrlo cada hora — que es
 * lo que hace falta: hasta ahora los resultados solo se escribían con la
 * ingesta completa de los lunes y viernes, y un partido del lunes por la
 * tarde se quedaba «programado» hasta el viernes.
 *
 * Protegida por CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const leagueParam = req.nextUrl.searchParams.get('league')
  const leagues = leagueParam
    ? leagueParam.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined
  const num = (k: string) => {
    const v = Number(req.nextUrl.searchParams.get(k))
    return Number.isFinite(v) && v > 0 ? v : undefined
  }

  try {
    const result = await syncLeagueResults({
      leagues,
      hoursBack: num('hoursBack'),
      hoursAhead: num('hoursAhead'),
    })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await logSyncError('api_football', 'league_results', e, { leagues: leagues ?? 'todas' })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
