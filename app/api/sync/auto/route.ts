import { NextRequest, NextResponse } from 'next/server'
import { getSyncWindow } from '@/lib/syncWindow'
import { syncESPNResults } from '@/services/sync/espn-results'
import { isAuthorizedCron } from '@/lib/cronAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/auto — punto único para el cron de GitHub Actions (cada 15 min).
 *
 * Chequea la ventana de partido y, si corresponde, sincroniza desde ESPN API
 * (gratuita, sin límite de cuota). ESPN provee: marcadores en vivo, estado
 * del partido, sede, asistencia y árbitro.
 *
 * Protegido por CRON_SECRET (header: Authorization: Bearer <secret>).
 */
const authorized = isAuthorizedCron

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const window = await getSyncWindow()
    if (!window.shouldSyncResults) {
      return NextResponse.json({ skipped: true, window })
    }
    const result = await syncESPNResults()
    return NextResponse.json({ skipped: false, window, ...result })
  } catch (err: any) {
    console.error('[GET /api/sync/auto]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
