import { NextRequest, NextResponse } from 'next/server'
import {
  snapshotScheduledPicks,
  resolvePendingPicks,
  resolveCompetitionScope,
} from '@/services/smartBetTracking'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const parseList = (value: string | null) =>
  (value ?? '').split(',').map((s) => s.trim()).filter(Boolean)

/**
 * GET /api/sync/smart-bets — historial de aciertos de Smart Bets AI.
 * 1) Congela el top-5 de partidos programados (snapshot pre-partido).
 * 2) Resuelve contra el resultado real los picks de partidos finalizados.
 * También se ejecuta automáticamente (best-effort) tras cada
 * recalibración de predicciones — este endpoint es para cron/manual.
 * Protegida por CRON_SECRET.
 *
 * Acotado opcional (recomendado si algún día vuelve a apretar el tope de
 * 60 s de la función): `?league=premier_league,la_liga` o `?competition=<uuid>`.
 * Sin parámetros corre sobre todas las competiciones de fútbol. La respuesta
 * incluye los tiempos de cada paso: sirve para medir, no para prometer.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const scope = resolveCompetitionScope({
      leagues: parseList(searchParams.get('league')),
      competitionIds: parseList(searchParams.get('competition')),
    })

    const t0 = Date.now()
    const snapshot = await snapshotScheduledPicks(scope)
    const t1 = Date.now()
    const resolved = await resolvePendingPicks(scope)
    const t2 = Date.now()

    return NextResponse.json({
      ok: true,
      competitions: scope.length,
      snapshot,
      resolved,
      ms: { snapshot: t1 - t0, resolve: t2 - t1, total: t2 - t0 },
    })
  } catch (err: any) {
    console.error('[GET /api/sync/smart-bets]', err?.message)
    await logSyncError('smart_bets_tracking', 'smart_bet_picks', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
