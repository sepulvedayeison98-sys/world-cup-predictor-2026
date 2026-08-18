/**
 * Plantilla y entrenador de Copa Libertadores (Fase 1, el equipo como
 * entidad independiente — mismo espíritu que estadio/fundación).
 *
 * Bloqueado hasta ahora por cuota: en el plan Free, 32 equipos × ~2
 * páginas de /players + 1 de /coachs (~96 requests) no cabía junto al
 * resto de la ingesta diaria (100/día). El plan Pro (7.500/día) lo hace
 * trivial — se corre bajo demanda, no en el cron diario.
 *
 * `position` (el enum táctico de 11 valores) se deja NULL a propósito:
 * API-Football solo da 4 categorías (Goalkeeper/Defender/Midfielder/
 * Attacker) — ver migración 059 y `position_raw`.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchTeamSquad, fetchCurrentCoach } from './api-football'
import { LIBERTADORES_COMPETITION_ID } from '@/lib/constants'

export interface LibertadoresSquadResult {
  teamsProcessed: number
  playersUpserted: number
  coachesUpdated: number
  errors: string[]
}

export async function ingestLibertadoresSquads(season: number): Promise<LibertadoresSquadResult> {
  const supabase = createAdminClient()
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, api_football_id, name')
    .eq('competition_id', LIBERTADORES_COMPETITION_ID)
    .not('api_football_id', 'is', null)
  if (error) throw new Error(`teams: ${error.message}`)

  let playersUpserted = 0
  let coachesUpdated = 0
  const errors: string[] = []

  for (const team of (teams ?? []) as any[]) {
    try {
      const squad = await fetchTeamSquad(team.api_football_id, season)
      if (squad.length > 0) {
        const rows = squad.map((p) => ({
          team_id: team.id,
          api_football_id: p.apiFootballId,
          name: p.name,
          short_name: p.name,
          number: p.number,
          position: null, // ver nota de cabecera — no se fabrica granularidad
          position_raw: p.positionRaw,
          nationality: p.nationality,
          date_of_birth: p.dateOfBirth,
          height_cm: p.heightCm,
          weight_kg: p.weightKg,
          photo_url: p.photoUrl,
          age: p.age,
          source: 'api_football',
        }))
        const { error: upsertErr } = await (supabase.from('players') as any)
          .upsert(rows, { onConflict: 'team_id,api_football_id' })
        if (upsertErr) throw new Error(`players ${team.name}: ${upsertErr.message}`)
        playersUpserted += rows.length
      }
    } catch (e: any) {
      errors.push(`${team.name} (plantilla): ${e.message}`)
    }

    try {
      const coach = await fetchCurrentCoach(team.api_football_id)
      if (coach) {
        const { error: coachErr } = await (supabase.from('teams') as any)
          .update({ coach })
          .eq('id', team.id)
        if (coachErr) throw new Error(`coach ${team.name}: ${coachErr.message}`)
        coachesUpdated++
      }
    } catch (e: any) {
      errors.push(`${team.name} (entrenador): ${e.message}`)
    }
  }

  await (supabase.from('sync_logs') as any).insert({
    source: 'api_football',
    entity_type: 'libertadores_squad',
    status: errors.length === 0 ? 'success' : 'partial',
    records_processed: playersUpserted + coachesUpdated,
    records_failed: errors.length,
    metadata: { season, errors },
  })

  return { teamsProcessed: (teams ?? []).length, playersUpserted, coachesUpdated, errors }
}
