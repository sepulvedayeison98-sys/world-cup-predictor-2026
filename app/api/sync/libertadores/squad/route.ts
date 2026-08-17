import { NextRequest, NextResponse } from 'next/server'
import { ingestLibertadoresSquads } from '@/services/sync/libertadores-squad'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/sync/libertadores/squad — plantilla + entrenador de los 32
 * clubes de Copa Libertadores. ~65-100 requests (plan Pro, 7.500/día) —
 * ver services/sync/libertadores-squad.ts. Idempotente, bajo demanda
 * (no en el cron diario junto al resto).
 *
 * Protegida por CRON_SECRET. ?season=2026 por defecto.
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
    const result = await ingestLibertadoresSquads(season)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[GET /api/sync/libertadores/squad]', err)
    await logSyncError('api_football', 'libertadores_squad', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
