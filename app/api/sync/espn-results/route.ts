import { NextRequest, NextResponse } from 'next/server'
import { syncESPNResults } from '@/services/sync/espn-results'
import { isAuthorizedCron } from '@/lib/cronAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const authorized = isAuthorizedCron

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
