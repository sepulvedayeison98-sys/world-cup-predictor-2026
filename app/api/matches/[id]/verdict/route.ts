import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateVerdict } from '@/services/verdict'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30 // primera generación puede llamar a Claude

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/matches/[id]/verdict — veredicto post-partido.
 * Se genera una sola vez por partido (caché permanente en BD); las
 * visitas siguientes son una lectura simple.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  try {
    const verdict = await getOrCreateVerdict(id)
    if (!verdict) return NextResponse.json({ verdict: null })
    return NextResponse.json({ verdict }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch (err: any) {
    console.error('[GET /api/matches/[id]/verdict]', err?.message)
    return NextResponse.json({ verdict: null })
  }
}
