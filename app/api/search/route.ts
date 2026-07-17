import { NextRequest, NextResponse } from 'next/server'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { COMPETITION_ID } from '@/lib/constants'
import { competitionHref } from '@/lib/sports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/search?q=… — buscador global (auditoría I7).
 * Público y de solo lectura: equipos de todas las competiciones activas y
 * tenistas del circuito ATP (tablas tennis_*, sin cruzar dominios).
 * Las competiciones y páginas se filtran en el cliente (lista estática).
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 40)
  if (q.length < 2) return NextResponse.json({ teams: [], players: [] })

  // Sanear para el filtro PostgREST (mismos caracteres que matches.service)
  const safe = q.replace(/[,()*:%\\]/g, ' ').trim()
  if (!safe) return NextResponse.json({ teams: [], players: [] })

  const supabase = createStaticSupabaseClient()
  const [{ data, error }, { data: tennisData, error: tennisError }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, code, competition_id, logo_url')
      .ilike('name', `%${safe}%`)
      .limit(12),
    (supabase as any)
      .from('tennis_players')
      .select('id, name, country_code, tour')
      .ilike('name', `%${safe}%`)
      .order('name')
      .limit(8),
  ])

  if (error) return NextResponse.json({ teams: [], players: [] })

  const players = tennisError ? [] : ((tennisData ?? []) as any[]).map((p) => ({
    id: p.id,
    name: p.name,
    country_code: p.country_code,
    href: `/tennis/jugadores/${p.id}`,
    context: `Tenis · ${p.tour}`,
  }))

  const teams = (data ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    logo_url: t.logo_url,
    // Selecciones → agenda del Mundial filtrada; clubes → hub de su liga
    href: t.competition_id === COMPETITION_ID
      ? `/matches?team=${t.id}`
      : competitionHref(t.competition_id),
    context: t.competition_id === COMPETITION_ID ? 'Mundial 2026' : 'Liga de clubes',
  }))

  return NextResponse.json({ teams, players })
}
