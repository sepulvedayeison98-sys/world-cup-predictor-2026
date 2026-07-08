import { NextRequest, NextResponse } from 'next/server'
import { ensureMatchEvents } from '@/services/sync/match-events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/matches/[id]/events — línea de tiempo del partido.
 * Pública y de solo lectura para el cliente; la primera visita a un
 * partido de liga dispara la ingesta única desde API-Football
 * (cacheada para siempre, con throttle diario de cuota).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  try {
    const result = await ensureMatchEvents(id)
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (err: any) {
    console.error('[GET /api/matches/[id]/events]', err?.message)
    return NextResponse.json({ events: [], source: 'none' })
  }
}
