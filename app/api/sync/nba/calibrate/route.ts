import { NextRequest, NextResponse } from 'next/server'
import { calibrateNba } from '@/services/sync/nba-calibrate'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/sync/nba/calibrate — backtest walk-forward del motor NBA +
 * persistencia de ELO, estadísticas y predicciones. No consume cuota.
 * Protegida por CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await calibrateNba())
  } catch (err: any) {
    console.error('[GET /api/sync/nba/calibrate]', err?.message)
    await logSyncError('api_basketball', 'nba_calibrate', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
