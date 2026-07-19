import { NextRequest, NextResponse } from 'next/server'
import { ingestLeagues } from '@/services/sync/league-ingest'
import { DEFAULT_SEASON } from '@/services/sync/api-football'
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
 * Protegida por CRON_SECRET. La temporada sale de FOOTBALL_API_SEASON
 * (env) o del fallback DEFAULT_SEASON; se puede sobreescribir por corrida
 * con ?season=2026 (útil tras el upgrade de plan para reingestar campañas).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const seasonParam = req.nextUrl.searchParams.get('season')
    const season = seasonParam ? Number(seasonParam) : DEFAULT_SEASON
    if (!Number.isFinite(season) || season < 2022) {
      return NextResponse.json({ error: 'season inválida (mínimo 2022)' }, { status: 400 })
    }
    const result = await ingestLeagues(season)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[GET /api/sync/leagues/ingest]', err)
    await logSyncError('api_football', 'league_ingest', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
