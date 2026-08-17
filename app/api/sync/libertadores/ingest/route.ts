import { NextRequest, NextResponse } from 'next/server'
import { ingestLibertadores } from '@/services/sync/libertadores-ingest'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/sync/libertadores/ingest — ingesta real de Copa Libertadores
 * (liga 13 de API-Football) desde fase de grupos en adelante. Idempotente.
 * Consume 3 requests de cuota (equipos, calendario, tabla de grupos).
 *
 * Protegida por CRON_SECRET. ?season=2026 por defecto (única temporada
 * con datos hoy).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const seasonParam = req.nextUrl.searchParams.get('season')
    const season = seasonParam ? Number(seasonParam) : 2026
    if (!Number.isFinite(season) || season < 2024) {
      return NextResponse.json({ error: 'season inválida' }, { status: 400 })
    }
    const result = await ingestLibertadores(season)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[GET /api/sync/libertadores/ingest]', err)
    await logSyncError('api_football', 'libertadores_ingest', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
