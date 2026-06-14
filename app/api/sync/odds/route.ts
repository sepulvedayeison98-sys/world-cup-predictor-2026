import { NextRequest, NextResponse } from 'next/server'
import { syncOdds } from '@/services/sync/odds'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/odds  — ingesta de cuotas + value bets (The Odds API).
 * Protegida por CRON_SECRET: requiere header `Authorization: Bearer <CRON_SECRET>`.
 * La invoca Vercel Cron (ver vercel.json). No es publica.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // sin secret configurado, no se permite
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await syncOdds()
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[GET /api/sync/odds]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
