import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cronAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/health — Data Health para el panel /admin.
 * Devuelve las últimas corridas de sync por fuente y marca alerta
 * cuando una fuente acumula ≥2 fallos consecutivos (plan Semana 1).
 */
const SOURCES = ['espn_api', 'pinnacle_via_odds_api', 'recalibrate']

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: logs, error } = await supabase
    .from('sync_logs')
    .select('source, status, records_processed, error_message, created_at')
    .in('source', SOURCES)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const bySource: Record<string, any> = {}
  const alerts: string[] = []
  for (const src of SOURCES) {
    const rows = (logs ?? []).filter(l => l.source === src)
    const last = rows[0] ?? null
    let streak = 0
    for (const r of rows) {
      if (r.status === 'error') streak++
      else break
    }
    bySource[src] = {
      last_status: last?.status ?? 'sin_corridas',
      last_at: last?.created_at ?? null,
      last_error: last?.status === 'error' ? last?.error_message : null,
      failure_streak: streak,
    }
    if (streak >= 2) alerts.push(`${src}: ${streak} fallos consecutivos`)
  }

  return NextResponse.json({ ok: alerts.length === 0, alerts, sources: bySource, recent: (logs ?? []).slice(0, 8) })
}
