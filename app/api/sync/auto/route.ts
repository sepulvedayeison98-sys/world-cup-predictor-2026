import { NextRequest, NextResponse } from 'next/server'
import { getSyncWindow } from '@/lib/syncWindow'
import { syncESPNResults } from '@/services/sync/espn-results'
import { syncESPNResultsLibertadores } from '@/services/sync/espn-results-libertadores'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
    // Mundial y Libertadores en paralelo — un fallo en una no bloquea la otra.
    const [wc, lib] = await Promise.allSettled([syncESPNResults(), syncESPNResultsLibertadores()])
    if (wc.status === 'rejected') await logSyncError('espn_api', 'matches', wc.reason)
    if (lib.status === 'rejected') await logSyncError('espn_api', 'libertadores_matches', lib.reason)
    return NextResponse.json({
      skipped: false,
      window,
      worldCup: wc.status === 'fulfilled' ? wc.value : { ok: false, error: String(wc.reason) },
      libertadores: lib.status === 'fulfilled' ? lib.value : { ok: false, error: String(lib.reason) },
    })
  } catch (err: any) {
    console.error('[GET /api/sync/auto]', err)
    await logSyncError('espn_api', 'matches', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
