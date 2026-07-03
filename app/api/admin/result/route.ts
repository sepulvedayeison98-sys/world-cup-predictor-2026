import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { advanceBracket } from '@/lib/bracket'
import { recalibratePredictions } from '@/services/sync/recalibrate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/admin/result — carga de resultados desde el panel /admin.
 * Protegida con CRON_SECRET (header Authorization: Bearer <secret>).
 *
 * Body: {
 *   matchId: string
 *   status: 'live' | 'finished' | 'scheduled'
 *   homeScore?: number, awayScore?: number
 *   homePenalties?: number, awayPenalties?: number   // si terminó en empate (eliminatoria)
 * }
 *
 * Al finalizar un partido dispara la cadena completa:
 * stats del partido → standings (si es de grupo) → team_statistics →
 * avance del bracket → recalibración de predicciones.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { matchId, status, homeScore, awayScore, homePenalties, awayPenalties } = body ?? {}
  if (!matchId || !['live', 'finished', 'scheduled'].includes(status)) {
    return NextResponse.json({ error: 'matchId y status (live|finished|scheduled) requeridos' }, { status: 400 })
  }
  const isInt = (v: any) => Number.isInteger(v) && v >= 0 && v <= 99
  if (status !== 'scheduled' && (!isInt(homeScore) || !isInt(awayScore))) {
    return NextResponse.json({ error: 'homeScore y awayScore deben ser enteros >= 0' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: match, error: mErr } = await supabase
    .from('matches')
    .select('id, phase, group_id, match_number')
    .eq('id', matchId)
    .single()
  if (mErr || !match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })

  const isKnockout = match.phase !== 'group'
  const isDraw = status === 'finished' && homeScore === awayScore
  if (isKnockout && isDraw && (!isInt(homePenalties) || !isInt(awayPenalties) || homePenalties === awayPenalties)) {
    return NextResponse.json(
      { error: 'Empate en eliminatoria: se requieren penales (homePenalties ≠ awayPenalties)' },
      { status: 400 },
    )
  }

  // 1. Guardar resultado
  const { error: upErr } = await supabase
    .from('matches')
    .update({
      status,
      home_score: status === 'scheduled' ? null : homeScore,
      away_score: status === 'scheduled' ? null : awayScore,
      home_penalties: isKnockout && isDraw ? homePenalties : null,
      away_penalties: isKnockout && isDraw ? awayPenalties : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  if (status !== 'finished') {
    return NextResponse.json({ ok: true, status })
  }

  // 2. Cadena post-resultado
  const chain: Record<string, any> = {}
  try {
    // Stats del partido (regenerar si es corrección)
    await supabase.from('match_statistics').delete().eq('match_id', matchId)
    const { data: statsN } = await supabase.rpc('backfill_missing_match_stats')
    chain.match_stats = statsN

    // Standings si es fase de grupos
    if (match.group_id) {
      await supabase.rpc('recalculate_group_standings', { p_group_id: match.group_id })
      chain.standings = 'recalculadas'
    }

    // Perfiles de equipo
    const { data: teamsN } = await supabase.rpc('refresh_team_statistics')
    chain.team_stats = teamsN

    // Avance del bracket
    const bracket = await advanceBracket(supabase)
    chain.bracket = bracket

    // Recalibración de predicciones
    const recal = await recalibratePredictions()
    chain.recalibrated = recal.matches
  } catch (err: any) {
    // El resultado ya quedó guardado; se reporta qué parte de la cadena falló
    return NextResponse.json({ ok: true, status, chain, chainError: err.message }, { status: 207 })
  }

  return NextResponse.json({ ok: true, status, chain })
}
