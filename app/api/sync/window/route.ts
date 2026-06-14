import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COMPETITION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const MIN = 60 * 1000

/**
 * GET /api/sync/window — "gatekeeper" para n8n / cron inteligente.
 *
 * Consulta SOLO nuestra base (NO gasta creditos de The Odds API) y dice si
 * conviene sincronizar ahora. n8n revisa esto seguido (gratis) y solo dispara
 * /api/sync/results y /api/sync/odds cuando de verdad hace falta, concentrando
 * la cuota en las ventanas de partido.
 *
 * Protegido por CRON_SECRET (mismo header que los otros /api/sync/*).
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('matches')
      .select('id, kickoff_time, status')
      .eq('competition_id', COMPETITION_ID)
    if (error) throw error

    const now = Date.now()
    let liveMatches = 0
    let activeMatches = 0   // en ventana de juego (desde -15min hasta +150min del saque)
    let upcoming48 = 0      // programados en las proximas 48h
    let nextKickoff = Number.POSITIVE_INFINITY

    for (const m of (data ?? []) as any[]) {
      const k = new Date(m.kickoff_time).getTime()
      const finishedish = m.status === 'finished' || m.status === 'cancelled'

      if (m.status === 'live') liveMatches++
      if (!finishedish && now >= k - 15 * MIN && now <= k + 150 * MIN) activeMatches++
      if (m.status === 'scheduled' && k > now) {
        if (k <= now + 48 * 60 * MIN) upcoming48++
        if (k < nextKickoff) nextKickoff = k
      }
    }

    // Sincronizar resultados si hay algo en juego o por arrancar en breve.
    const shouldSyncResults = liveMatches > 0 || activeMatches > 0
    // Cuotas: vale la pena si hay partidos en las proximas 48h (n8n igual debe
    // limitar esto a ~cada 12h por su lado para cuidar la cuota).
    const shouldSyncOdds = upcoming48 > 0

    const nextKickoffInMin =
      nextKickoff === Number.POSITIVE_INFINITY ? null : Math.round((nextKickoff - now) / MIN)

    return NextResponse.json({
      now: new Date(now).toISOString(),
      liveMatches,
      activeMatches,
      upcomingNext48h: upcoming48,
      nextKickoffInMin,
      shouldSyncResults,
      shouldSyncOdds,
      reason: shouldSyncResults
        ? `${activeMatches || liveMatches} partido(s) en ventana de juego`
        : nextKickoffInMin != null
          ? `sin partidos activos; proximo saque en ${nextKickoffInMin} min`
          : 'sin partidos programados',
    })
  } catch (err: any) {
    console.error('[GET /api/sync/window]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
