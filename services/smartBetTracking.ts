/**
 * Historial de aciertos de Smart Bets AI.
 *
 * Dos pasos, siempre en este orden:
 *   1. snapshotScheduledPicks — ANTES del partido: congela el top-5 que
 *      el motor recomienda en ese momento (status='scheduled'). Se
 *      puede re-ejecutar mientras el partido no empiece (recalibra con
 *      la última predicción/forma disponible sin tocar lo ya jugado).
 *   2. resolvePendingPicks — DESPUÉS del partido: califica cada pick
 *      contra el resultado real. Nunca reconstruye picks en retrospectiva.
 *
 * Ambos son best-effort: se llaman desde las cadenas de recalibración
 * existentes (Mundial y ligas) envueltos en try/catch — un fallo aquí
 * jamás debe romper la recalibración de predicciones.
 *
 * AISLAMIENTO POR DEPORTE: el motor de Smart Bets es exclusivo de fútbol
 * (goles, córners, tarjetas). Ambas funciones filtran por la lista blanca
 * de competiciones de fútbol del registro — un partido de NBA (o de
 * cualquier deporte futuro) jamás entra a este pipeline.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { computeSmartBets } from '@/lib/smartBetsEngine'
import { gradeSmartBetPick } from '@/lib/smartBetGrading'
import { fetchTeamForm } from '@/lib/teamForm'
import { competitionIdsOfSport } from '@/lib/sports'

async function buildMatchInputs(supabase: any, matchId: string) {
  const { data: match } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(*, team_statistics(*)),
      away_team:teams!matches_away_team_id_fkey(*, team_statistics(*)),
      predictions(*)
    `)
    .eq('id', matchId)
    .maybeSingle()
  if (!match) return null
  const m = match as any
  const prediction = Array.isArray(m.predictions) ? (m.predictions[0] ?? null) : (m.predictions ?? null)
  if (!prediction?.is_published) return null

  const [{ data: injuries }, { data: oddsRaw }, homeRecentMatches, awayRecentMatches] = await Promise.all([
    supabase.from('injuries').select('*').in('team_id', [m.home_team_id, m.away_team_id]).eq('is_active', true),
    supabase.from('odds').select('bookmaker, market, odds_value').eq('match_id', matchId),
    fetchTeamForm(supabase, m.home_team_id, matchId, m.competition_id),
    fetchTeamForm(supabase, m.away_team_id, matchId, m.competition_id),
  ])

  return {
    match: m,
    prediction,
    homeStats: m.home_team?.team_statistics?.[0] ?? null,
    awayStats: m.away_team?.team_statistics?.[0] ?? null,
    injuries: injuries ?? [],
    odds: oddsRaw ?? [],
    homeRecentMatches,
    awayRecentMatches,
  }
}

export async function snapshotScheduledPicks(): Promise<{ matchesSnapshotted: number; picksStored: number }> {
  const supabase = createAdminClient()
  const { data: scheduled } = await supabase
    .from('matches')
    .select('id')
    .eq('status', 'scheduled')
    .in('competition_id', competitionIdsOfSport('futbol'))
  let matchesSnapshotted = 0
  let picksStored = 0

  for (const row of (scheduled ?? []) as any[]) {
    const inputs = await buildMatchInputs(supabase, row.id)
    if (!inputs) continue

    const recs = computeSmartBets(
      inputs.prediction, inputs.homeStats, inputs.awayStats,
      inputs.match.home_team, inputs.match.away_team, inputs.injuries,
      inputs.match, inputs.odds, inputs.homeRecentMatches, inputs.awayRecentMatches,
    )
    if (recs.length === 0) continue

    const picks = recs.slice(0, 5).map((r) => ({
      match_id: row.id,
      competition_id: inputs.match.competition_id,
      market_id: r.id,
      category: r.category,
      label: r.label,
      rank: r.rank,
      confidence: r.confidence,
      snapshot_at: new Date().toISOString(),
    }))
    const { error } = await (supabase.from('smart_bet_picks') as any)
      .upsert(picks, { onConflict: 'match_id,market_id' })
    if (!error) {
      matchesSnapshotted++
      picksStored += picks.length
    }
  }

  return { matchesSnapshotted, picksStored }
}

export async function resolvePendingPicks(): Promise<{ matchesResolved: number; picksResolved: number }> {
  const supabase = createAdminClient()
  const { data: pending } = await supabase
    .from('smart_bet_picks')
    .select('id, match_id, market_id')
    .eq('resolved', false)
    .in('competition_id', competitionIdsOfSport('futbol'))
  if (!pending?.length) return { matchesResolved: 0, picksResolved: 0 }

  const matchIds = [...new Set((pending as any[]).map((p) => p.match_id))]
  const { data: finishedMatches } = await supabase
    .from('matches')
    .select('id, home_score, away_score, status')
    .in('id', matchIds)
    .eq('status', 'finished')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
  if (!finishedMatches?.length) return { matchesResolved: 0, picksResolved: 0 }

  let picksResolved = 0
  for (const match of finishedMatches as any[]) {
    const { data: stats } = await supabase
      .from('match_statistics')
      .select('corners, yellow_cards')
      .eq('match_id', match.id)
    const hasStats = (stats ?? []).length > 0
    const totalCorners = hasStats ? (stats as any[]).reduce((s, r) => s + (r.corners ?? 0), 0) : null
    const totalYellowCards = hasStats ? (stats as any[]).reduce((s, r) => s + (r.yellow_cards ?? 0), 0) : null

    const matchPicks = (pending as any[]).filter((p) => p.match_id === match.id)
    for (const pick of matchPicks) {
      const grade = gradeSmartBetPick({
        marketId: pick.market_id,
        homeScore: match.home_score,
        awayScore: match.away_score,
        totalCorners,
        totalYellowCards,
      })
      const { error } = await (supabase.from('smart_bet_picks') as any)
        .update({
          resolved: true,
          gradable: grade.gradable,
          correct: grade.correct,
          actual_detail: grade.detail,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', pick.id)
      if (!error) picksResolved++
    }
  }

  return { matchesResolved: finishedMatches.length, picksResolved }
}

/** Best-effort: nunca lanza — se llama desde las cadenas de recalibración. */
export async function syncSmartBetTracking(): Promise<void> {
  try {
    await snapshotScheduledPicks()
    await resolvePendingPicks()
  } catch (err: any) {
    console.error('[smartBetTracking] sync falló (no crítico):', err?.message)
  }
}
