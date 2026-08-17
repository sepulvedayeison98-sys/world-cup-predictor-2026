import { NextRequest, NextResponse } from 'next/server'
import { ingestLeagueStats, pendingLeagueStats } from '@/services/sync/league-stats'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/sync/leagues/stats — boxscores de liga (córners, tarjetas, tiros,
 * posesión, xG), que la ingesta de ligas nunca pidió.
 *
 *   ?pending=1                     → cuántos faltan por liga. NO gasta cuota.
 *   ?league=premier_league&limit=40 → trae esa tanda. UNA petición por partido.
 *
 * `league` es OBLIGATORIO para ingerir: son ~2.427 partidos pendientes contra
 * 7.500 peticiones/día, y correrlo a ciegas agota la cuota (ya pasó con la
 * calibración). Protegida por CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)

    if (searchParams.get('pending')) {
      const pending = await pendingLeagueStats()
      return NextResponse.json({
        ok: true,
        pending,
        total: Object.values(pending).reduce((s, n) => s + n, 0),
      })
    }

    const league = searchParams.get('league')
    if (!league) {
      return NextResponse.json(
        { error: 'Falta ?league= (acotar es obligatorio: cada partido cuesta una petición de cuota)' },
        { status: 400 },
      )
    }
    const limitRaw = Number(searchParams.get('limit'))
    const t0 = Date.now()
    const result = await ingestLeagueStats(
      league,
      Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined,
    )
    return NextResponse.json({ ok: true, ...result, ms: Date.now() - t0 })
  } catch (err: any) {
    console.error('[GET /api/sync/leagues/stats]', err?.message)
    await logSyncError('league_stats', 'match_statistics', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
