import { NextRequest, NextResponse } from 'next/server'
import { recalibratePredictions } from '@/services/sync/recalibrate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/recalibrate — mezcla las predicciones con el consenso de mercado.
 * Protegida por CRON_SECRET. Correr DESPUES de /api/sync/odds (necesita cuotas).
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await recalibratePredictions())
  } catch (err: any) {
    console.error('[GET /api/sync/recalibrate]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
