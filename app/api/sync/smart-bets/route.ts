import { NextRequest, NextResponse } from 'next/server'
import { snapshotScheduledPicks, resolvePendingPicks } from '@/services/smartBetTracking'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/sync/smart-bets — historial de aciertos de Smart Bets AI.
 * 1) Congela el top-5 de partidos programados (snapshot pre-partido).
 * 2) Resuelve contra el resultado real los picks de partidos finalizados.
 * También se ejecuta automáticamente (best-effort) tras cada
 * recalibración de predicciones — este endpoint es para cron/manual.
 * Protegida por CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const snapshot = await snapshotScheduledPicks()
    const resolved = await resolvePendingPicks()
    return NextResponse.json({ ok: true, snapshot, resolved })
  } catch (err: any) {
    console.error('[GET /api/sync/smart-bets]', err?.message)
    await logSyncError('smart_bets_tracking', 'smart_bet_picks', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
