import { NextRequest, NextResponse } from 'next/server'
import { ingestNba } from '@/services/sync/nba-ingest'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/sync/nba/ingest — carga equipos y calendario de la NBA
 * desde API-Basketball (idempotente, ~2 requests de cuota).
 * Protegida por CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await ingestNba())
  } catch (err: any) {
    console.error('[GET /api/sync/nba/ingest]', err?.message)
    await logSyncError('api_basketball', 'nba_ingest', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
