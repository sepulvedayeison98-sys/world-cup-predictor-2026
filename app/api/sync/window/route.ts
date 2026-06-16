import { NextRequest, NextResponse } from 'next/server'
import { getSyncWindow } from '@/lib/syncWindow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    const window = await getSyncWindow()
    return NextResponse.json(window)
  } catch (err: any) {
    console.error('[GET /api/sync/window]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
