import { NextRequest, NextResponse } from 'next/server'
import { syncResults } from '@/services/sync/results'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/results — actualiza marcadores y estado (API-Football).
 * Protegida por CRON_SECRET: requiere header `Authorization: Bearer <CRON_SECRET>`.
 * La invoca Vercel Cron (ver vercel.json). No es publica.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

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
