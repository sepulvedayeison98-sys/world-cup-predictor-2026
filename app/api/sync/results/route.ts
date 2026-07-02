import { NextRequest, NextResponse } from 'next/server'
import { syncResults } from '@/services/sync/results'
import { isAuthorizedCron } from '@/lib/cronAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/results — actualiza marcadores y estado (API-Football).
 * Protegida por CRON_SECRET: requiere header `Authorization: Bearer <CRON_SECRET>`.
 * La invoca Vercel Cron (ver vercel.json). No es publica.
 */
const authorized = isAuthorizedCron

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await syncResults()
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[GET /api/sync/results]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
