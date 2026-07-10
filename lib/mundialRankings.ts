/**
 * Ranking ELO del Mundial (playbook Sofascore, QW2) — módulo puro.
 *
 * Todo sale de datos reales ya cargados: ELO actual de `teams`, ranking
 * FIFA de `teams` y el récord del torneo calculado de `matches`. No se
 * calcula Δ de ELO histórico (no almacenamos serie de ELO — Data First:
 * antes que estimarla, no se publica). El contraste honesto es
 * ELO vs FIFA: dos ordenamientos reales del mismo grupo de 48.
 */

export interface RankingMatch {
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  status: string
  phase: string | null
}

export interface TournamentRecord {
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  /** Fase más avanzada en la que el equipo tiene un partido (jugado o programado) */
  maxPhase: string
}

/** Orden real de fases del torneo (para "fase alcanzada"). */
const PHASE_ORDER = ['group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']

export function phaseRank(phase: string | null): number {
  const i = PHASE_ORDER.indexOf(phase ?? '')
  return i === -1 ? 0 : i
}

/** Récord del torneo por equipo, calculado solo de partidos reales. */
export function computeTournamentRecords(matches: RankingMatch[]): Map<string, TournamentRecord> {
  const out = new Map<string, TournamentRecord>()
  const get = (id: string) => {
    let r = out.get(id)
    if (!r) {
      r = { played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, maxPhase: 'group' }
      out.set(id, r)
    }
    return r
  }

  for (const m of matches) {
    const home = get(m.home_team_id)
    const away = get(m.away_team_id)
    // Fase alcanzada: cuenta también partidos programados (estar en cuartos
    // es real aunque aún no se juegue)
    if (phaseRank(m.phase) > phaseRank(home.maxPhase)) home.maxPhase = m.phase as string
    if (phaseRank(m.phase) > phaseRank(away.maxPhase)) away.maxPhase = m.phase as string

    if (m.status !== 'finished' || m.home_score == null || m.away_score == null) continue
    home.played++; away.played++
    home.goals_for += m.home_score; home.goals_against += m.away_score
    away.goals_for += m.away_score; away.goals_against += m.home_score
    if (m.home_score > m.away_score) { home.won++; away.lost++ }
    else if (m.home_score < m.away_score) { away.won++; home.lost++ }
    else { home.drawn++; away.drawn++ }
  }
  return out
}

/**
 * Posición de cada equipo al ordenar por ranking FIFA (1 = mejor FIFA del
 * torneo). Sirve para contrastar el ordenamiento del modelo (ELO) contra
 * el oficial de FIFA dentro del mismo grupo de equipos.
 */
export function fifaPositions(teams: { id: string; fifa_ranking: number | null }[]): Map<string, number> {
  const sorted = [...teams]
    .filter((t) => t.fifa_ranking != null && t.fifa_ranking > 0)
    .sort((a, b) => (a.fifa_ranking as number) - (b.fifa_ranking as number))
  const map = new Map<string, number>()
  sorted.forEach((t, i) => map.set(t.id, i + 1))
  return map
}
