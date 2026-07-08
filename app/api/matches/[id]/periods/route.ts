import { NextRequest, NextResponse } from 'next/server'
import { createStaticSupabaseClient } from '@/lib/supabase/static'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/matches/[id]/periods — marcador por periodo (cuartos NBA).
 * Público y de solo lectura.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  const supabase = createStaticSupabaseClient()
  const { data } = await supabase.from('matches').select('period_scores').eq('id', id).maybeSingle()
  return NextResponse.json(
    { period_scores: (data as any)?.period_scores ?? null },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  )
}
