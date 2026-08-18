import { NextRequest, NextResponse } from 'next/server'
import { calibrateLibertadores } from '@/services/sync/league-calibrate'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/sync/libertadores/calibrate — corre el backtest walk-forward
 * (el mismo motor de lib/leagueEngine.ts que usan las ligas) sobre Copa
 * Libertadores y persiste ELO, estadísticas y predicciones evaluadas.
 * No consume cuota de API-Football (usa datos ya ingestados).
 *
 * Protegida por CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await calibrateLibertadores()
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[GET /api/sync/libertadores/calibrate]', err)
    await logSyncError('api_football', 'libertadores_calibrate', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
