import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ARCHIVED_COMPETITION_IDS } from '@/lib/sports'

/**
 * GET /api/predictions
 * Listado público de predicciones publicadas, o una sola por match_id.
 *
 * El POST que vivía aquí (generación manual con auth de usuario) era
 * código muerto heredado del modelo con login: la app es de acceso libre
 * y el motor corre por /api/sync/recalibrate con CRON_SECRET
 * (AUDIT 🟡-7 — eliminado en el saneamiento 2026-07-09).
 */

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const matchId = req.nextUrl.searchParams.get('match_id')
  // Sin match_id el listado devolvía SOLO el Mundial. Con el torneo
  // archivado, la regla se invierte: se devuelven las competiciones vivas y
  // se excluyen las archivadas. Pedir un match_id concreto sigue funcionando
  // para cualquier partido, incluidos los del archivo.
  let query
  if (matchId) {
    query = supabase.from('predictions').select('*, exact_score_predictions(*)').eq('match_id', matchId)
  } else {
    const base = supabase
      .from('predictions')
      .select('*, exact_score_predictions(*), match:matches!inner(competition_id)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(50)
    query = ARCHIVED_COMPETITION_IDS.length > 0
      ? base.not('match.competition_id', 'in', `(${ARCHIVED_COMPETITION_IDS.join(',')})`)
      : base
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
