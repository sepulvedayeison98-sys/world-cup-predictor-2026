import { NextRequest, NextResponse } from 'next/server'
import { calibrateLeagues } from '@/services/sync/league-calibrate'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // backtest de 760 partidos + upserts por lotes

/**
 * GET /api/sync/leagues/calibrate — corre el backtest walk-forward del
 * motor de ligas y persiste ELO, estadísticas y predicciones evaluadas.
 * No consume cuota de API-Football (usa datos ya ingestados).
 *
 * Protegida por CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // ?league=premier_league[,otra] — acota la corrida para no exceder el
    // límite de 60 s de la función (la temporada en curso trae cientos de
    // partidos por liga, jugados y próximos).
    const only = (req.nextUrl.searchParams.get('league') ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean)
    const result = await calibrateLeagues(only)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[GET /api/sync/leagues/calibrate]', err)
    await logSyncError('api_football', 'league_calibrate', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
