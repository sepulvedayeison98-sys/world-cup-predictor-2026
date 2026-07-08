import { advanceBracket } from '@/lib/bracket'
import { recalibratePredictions } from './recalibrate'
import { syncSmartBetTracking } from '@/services/smartBetTracking'

export interface PostResultChainResult {
  match_stats: number | null
  standings: number
  team_stats: number | null
  bracket: { created: number[]; updated: number[]; pendingPenalties: number[] }
  recalibrated: number
}

/**
 * Cadena que debe correr cada vez que uno o más partidos pasan a
 * 'finished', venga el resultado del panel /admin o del sync de ESPN:
 *
 *   1. recalculate_group_standings() por cada grupo afectado
 *   2. refresh_team_statistics() — perfiles de los equipos (solo desde
 *      stats reales disponibles; sin generación sintética)
 *   3. advanceBracket() — crea los cruces de la siguiente ronda
 *   4. recalibratePredictions() — regenera todas las predicciones
 *   5. syncSmartBetTracking() — congela el top-5 de Smart Bets de los
 *      partidos que quedaron programados y resuelve los que ya jugaron
 *      (best-effort: nunca rompe la cadena si falla)
 */
export async function runPostResultChain(
  supabase: any,
  groupIds: Array<string | null | undefined> = [],
): Promise<PostResultChainResult> {
  // Data First (plan aprobado, semana 1): ya NO se generan estadísticas
  // sintéticas. Las stats reales llegan del boxscore de ESPN (espn-stats);
  // si ESPN no las tiene, la UI muestra "Dato no disponible actualmente."
  // La función backfill_missing_match_stats queda solo para uso manual.
  const matchStats = null

  const uniqueGroups = [...new Set(groupIds.filter(Boolean))] as string[]
  for (const gid of uniqueGroups) {
    await supabase.rpc('recalculate_group_standings', { p_group_id: gid })
  }

  const { data: teamStats } = await supabase.rpc('refresh_team_statistics')
  const bracket = await advanceBracket(supabase)
  const recal = await recalibratePredictions()
  await syncSmartBetTracking()

  return {
    match_stats: matchStats ?? null,
    standings: uniqueGroups.length,
    team_stats: teamStats ?? null,
    bracket,
    recalibrated: recal.matches,
  }
}
