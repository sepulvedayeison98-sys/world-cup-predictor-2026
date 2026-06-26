import { NextRequest, NextResponse } from 'next/server'
import { syncESPNResults } from '@/services/sync/espn-results'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await syncESPNResults()
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[GET /api/sync/espn-results]', err?.message)
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
