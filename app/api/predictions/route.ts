import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { COMPETITION_ID } from '@/lib/constants'

/**
 * GET /api/predictions
 * Listado público de predicciones publicadas (Mundial) o por match_id.
 *
 * El POST que vivía aquí (generación manual con auth de usuario) era
 * código muerto heredado del modelo con login: la app es de acceso libre
 * y el motor corre por /api/sync/recalibrate con CRON_SECRET
 * (AUDIT 🟡-7 — eliminado en el saneamiento 2026-07-09).
 */

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const matchId = req.nextUrl.searchParams.get('match_id')
  // Sin match_id, el listado global queda acotado al Mundial: desde la
  // Fase 4 conviven en la tabla las predicciones de ligas (liga-1.0).
  const query = matchId
    ? supabase.from('predictions').select('*, exact_score_predictions(*)').eq('match_id', matchId)
    : supabase
        .from('predictions')
        .select('*, exact_score_predictions(*), match:matches!inner(competition_id)')
        .eq('is_published', true)
        .eq('match.competition_id', COMPETITION_ID)
        .order('created_at', { ascending: false })
        .limit(50)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
