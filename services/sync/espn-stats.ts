import { createAdminClient } from '@/lib/supabase/admin'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world'

interface ESPNStat {
  name: string
  displayValue: string
}

interface ESPNBoxscoreTeam {
  homeAway: 'home' | 'away'
  team: { abbreviation: string }
  statistics: ESPNStat[]
}

function findStat(stats: ESPNStat[], ...keys: string[]): number | null {
  for (const key of keys) {
    const s = stats.find(s => s.name === key)
    if (s) {
      const v = parseFloat(s.displayValue)
      return Number.isNaN(v) ? null : v
    }
  }
  return null
}

async function fetchSummary(eventId: string): Promise<ESPNBoxscoreTeam[] | null> {
  try {
    const res = await fetch(`${ESPN_BASE}/summary?event=${eventId}`, {
      cache: 'no-store',
      headers: { 'User-Agent': 'WorldCupPredictor/1.0' },
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data?.boxscore?.teams ?? null) as ESPNBoxscoreTeam[] | null
  } catch {
    return null
  }
}

/**
 * Sincroniza estadísticas de partido desde el endpoint /summary de ESPN.
 * Hace upsert en match_statistics para un partido terminado.
 *
 * @param eventId  ID de evento ESPN (string numérico del scoreboard)
 * @param matchId  UUID del partido en nuestra BD
 * @param homeTeamId UUID del equipo local
 * @param awayTeamId UUID del equipo visitante
 */
export async function syncESPNMatchStats(
  eventId: string,
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const boxscoreTeams = await fetchSummary(eventId)
  if (!boxscoreTeams?.length) {
    return { ok: false, reason: 'no_boxscore' }
  }

  const supabase = createAdminClient()

  for (const bt of boxscoreTeams) {
    const teamId = bt.homeAway === 'home' ? homeTeamId : awayTeamId
    const stats  = bt.statistics ?? []

    const record: Record<string, number | null> = {
      possession:      findStat(stats, 'possessionPct', 'possession'),
      shots:           findStat(stats, 'shots', 'totalShots'),
      shots_on_target: findStat(stats, 'shotsOnGoal', 'onGoalAttempts'),
      corners:         findStat(stats, 'cornerKicks', 'corners'),
      fouls:           findStat(stats, 'foulsCommitted', 'fouls'),
      yellow_cards:    findStat(stats, 'yellowCards'),
      red_cards:       findStat(stats, 'redCards'),
      saves:           findStat(stats, 'saves', 'goalKeeperSaves'),
      offsides:        findStat(stats, 'offsides'),
    }

    // Eliminar nulos para no sobreescribir datos existentes con null
    const payload = Object.fromEntries(
      Object.entries(record).filter(([, v]) => v !== null)
    )
    if (!Object.keys(payload).length) continue

    await supabase
      .from('match_statistics')
      .upsert(
        { match_id: matchId, team_id: teamId, ...payload },
        { onConflict: 'match_id,team_id' }
      )
  }

  return { ok: true }
}
