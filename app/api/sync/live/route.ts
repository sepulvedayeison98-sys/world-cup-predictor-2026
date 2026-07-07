import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncESPNResults } from '@/services/sync/espn-results'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/sync/live — sync de marcadores EN VIVO bajo demanda, PÚBLICO.
 *
 * Lo llama la página de partido mientras hay un partido en vivo (cada 30s).
 * A diferencia de /api/sync/auto (cron autenticado, cada 15 min pero que
 * GitHub retrasa 70-90 min), esto mantiene el marcador fresco cuando de
 * verdad hay espectadores.
 *
 * Sin secreto porque es idempotente y solo refleja datos factuales de ESPN
 * (marcadores). Protegido por un throttle GLOBAL vía sync_logs: si el último
 * sync ESPN fue hace <20s, no vuelve a llamar a ESPN (evita que se abuse y
 * ahorra escrituras). El throttle vive en la BD, así que es compartido entre
 * instancias serverless.
 */
const THROTTLE_MS = 20_000

export async function GET() {
  const supabase = createAdminClient()

  // ¿Hay algún partido realmente en ventana de juego? Si no, no tiene sentido.
  const nowMs = Date.now()
  const { data: windowRows } = await supabase
    .from('matches')
    .select('kickoff_time, status')
    .in('status', ['live', 'scheduled'])
    .gte('kickoff_time', new Date(nowMs - 210 * 60 * 1000).toISOString())  // prórroga+penales pueden superar 160 min
    .lte('kickoff_time', new Date(nowMs + 15 * 60 * 1000).toISOString())
    .limit(1)
  if (!windowRows || windowRows.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'sin-partidos-en-ventana' })
  }

  // Throttle global: no llamar a ESPN si otro cliente lo hizo hace <20s
  const { data: lastLog } = await supabase
    .from('sync_logs')
    .select('created_at')
    .eq('source', 'espn_api')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastLog?.created_at && nowMs - new Date(lastLog.created_at).getTime() < THROTTLE_MS) {
    return NextResponse.json({ ok: true, skipped: 'throttle' })
  }

  try {
    const result = await syncESPNResults()
    return NextResponse.json({ ok: true, updated: result.updated })
  } catch (err: any) {
    await logSyncError('espn_api', 'matches', err, { via: 'sync/live' })
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
