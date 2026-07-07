import { NextRequest, NextResponse } from 'next/server'
import { syncOdds } from '@/services/sync/odds'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/odds  — ingesta de cuotas + value bets (The Odds API).
 * Protegida por CRON_SECRET: requiere header `Authorization: Bearer <CRON_SECRET>`.
 * La invoca Vercel Cron (ver vercel.json). No es publica.
 */
const authorized = isAuthorizedCron

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await syncOdds()
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[GET /api/sync/odds]', err)
    await logSyncError('pinnacle_via_odds_api', 'matches', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
