import { NextRequest, NextResponse } from 'next/server'
import { recalibratePredictions } from '@/services/sync/recalibrate'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/recalibrate — mezcla las predicciones con el consenso de mercado.
 * Protegida por CRON_SECRET. Correr DESPUES de /api/sync/odds (necesita cuotas).
 */
const authorized = isAuthorizedCron

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await recalibratePredictions())
  } catch (err: any) {
    await logSyncError('recalibrate', 'predictions', err)
    console.error('[GET /api/sync/recalibrate]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
