import { NextRequest, NextResponse } from 'next/server'
import { syncESPNResults } from '@/services/sync/espn-results'
import { isAuthorizedCron } from '@/lib/cronAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/espn-stats
 * Ejecuta la sincronización ESPN (resultados + estadísticas) manualmente.
 * Las estadísticas se sincronizan automáticamente dentro de syncESPNResults
 * para los partidos terminados.
 */
const authorized = isAuthorizedCron

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await syncESPNResults()
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[GET /api/sync/espn-stats]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
