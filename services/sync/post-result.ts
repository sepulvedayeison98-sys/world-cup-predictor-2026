import { advanceBracket } from '@/lib/bracket'
import { recalibratePredictions } from './recalibrate'

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
 *   1. backfill_missing_match_stats() — estadísticas del partido
 *      (solo rellena las que falten: si ESPN ya insertó stats reales,
 *      no las toca)
 *   2. recalculate_group_standings() por cada grupo afectado
 *   3. refresh_team_statistics() — perfiles xG/forma de los equipos
 *   4. advanceBracket() — crea los cruces de la siguiente ronda
 *   5. recalibratePredictions() — regenera todas las predicciones
 */
export async function runPostResultChain(
  supabase: any,
  groupIds: Array<string | null | undefined> = [],
): Promise<PostResultChainResult> {
  const { data: matchStats } = await supabase.rpc('backfill_missing_match_stats')

  const uniqueGroups = [...new Set(groupIds.filter(Boolean))] as string[]
  for (const gid of uniqueGroups) {
    await supabase.rpc('recalculate_group_standings', { p_group_id: gid })
  }

  const { data: teamStats } = await supabase.rpc('refresh_team_statistics')
  const bracket = await advanceBracket(supabase)
  const recal = await recalibratePredictions()

  return {
    match_stats: matchStats ?? null,
    standings: uniqueGroups.length,
    team_stats: teamStats ?? null,
    bracket,
    recalibrated: recal.matches,
  }
}
