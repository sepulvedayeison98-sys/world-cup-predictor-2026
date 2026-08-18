import { NextRequest, NextResponse } from 'next/server'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { COMPETITION_ID } from '@/lib/constants'
import { competitionHref, sportOfCompetition } from '@/lib/sports'

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

  // Nombre real de cada competición para el subtítulo del resultado. Con la
  // plataforma en modo por temporada, "Liga de clubes" ya no distinguía entre
  // la Premier 2024-25 y la 2026-27, que conviven en la misma tabla.
  const competitionIds = [...new Set(((data ?? []) as any[])
    .map((t) => t.competition_id).filter(Boolean))]
  const COMPETITION_NAMES: Record<string, string> = {}
  if (competitionIds.length > 0) {
    const { data: comps } = await supabase
      .from('competitions')
      .select('id, name, season')
      .in('id', competitionIds)
    for (const c of (comps ?? []) as any[]) {
      COMPETITION_NAMES[c.id] = c.season ? `${c.name} ${c.season}` : c.name
    }
  }

  const players = tennisError ? [] : ((tennisData ?? []) as any[]).map((p) => ({
    id: p.id,
    name: p.name,
    country_code: p.country_code,
    href: `/tennis/jugadores/${p.id}`,
    context: `Tenis · ${p.tour}`,
  }))

  const teams = (data ?? []).map((t: any) => {
    // Antes todo club caía en el hub de su liga y el perfil de equipo —que ya
    // existe— quedaba inalcanzable desde el buscador. Ahora cada resultado
    // lleva a SU ficha: buscar "Manchester United" debe abrir el United, no
    // la Premier League. El Mundial conserva su agenda filtrada porque una
    // selección no tiene perfil de club equivalente.
    const sport = sportOfCompetition(t.competition_id)
    const href =
      t.competition_id === COMPETITION_ID ? `/matches?team=${t.id}`
      : sport === 'baloncesto' ? `/nba/equipos/${t.id}`
      : sport === 'futbol' ? `/equipos/${t.id}`
      : competitionHref(t.competition_id)

    return {
      id: t.id,
      name: t.name,
      code: t.code,
      logo_url: t.logo_url,
      href,
      context: COMPETITION_NAMES[t.competition_id]
        ?? (t.competition_id === COMPETITION_ID ? 'Mundial 2026' : 'Equipo'),
    }
  })

  return NextResponse.json({ teams, players })
}
