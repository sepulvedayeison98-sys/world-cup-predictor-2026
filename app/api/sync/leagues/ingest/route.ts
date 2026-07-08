import { NextRequest, NextResponse } from 'next/server'
import { ingestLeagues } from '@/services/sync/league-ingest'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 760 partidos + 40 equipos en upserts por lotes

/**
 * GET /api/sync/leagues/ingest — ingesta real de Premier League y
 * La Liga desde API-Football hacia teams/matches (idempotente).
 * Consume ~4 requests de la cuota diaria (100/día en plan Free).
 *
 * Protegida por CRON_SECRET. Parámetro opcional: ?season=2024
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const seasonParam = req.nextUrl.searchParams.get('season')
    const season = seasonParam ? Number(seasonParam) : 2024
    if (!Number.isFinite(season) || season < 2022) {
      return NextResponse.json({ error: 'season inválida (plan Free: 2022-2024)' }, { status: 400 })
    }
    const result = await ingestLeagues(season)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[GET /api/sync/leagues/ingest]', err)
    await logSyncError('api_football', 'league_ingest', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
