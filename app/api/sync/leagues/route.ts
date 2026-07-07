import { NextRequest, NextResponse } from 'next/server'
import { validateLeaguesSetup } from '@/services/sync/api-football'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/leagues — validación del collector de API-Football
 * (Fase 4: Premier League + La Liga). Solo lectura contra la API,
 * no escribe en la base de datos. Consume ~4 requests de la cuota diaria.
 *
 * Protegida por CRON_SECRET. Parámetro opcional: ?season=2023
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const seasonParam = req.nextUrl.searchParams.get('season')
    const season = seasonParam ? Number(seasonParam) : undefined
    const report = await validateLeaguesSetup(season)
    return NextResponse.json(report)
  } catch (err: any) {
    console.error('[GET /api/sync/leagues]', err)
    await logSyncError('api_football', 'leagues', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
