import { COMPETITION_ID } from '@/lib/constants'

/**
 * Progresión del cuadro eliminatorio.
 *
 * Numeración de partidos:
 *   201-216  Dieciseisavos (ya existen en la BD)
 *   217-224  Octavos       W201vW202 … W215vW216
 *   225-228  Cuartos       W217vW218 … W223vW224
 *   229-230  Semifinales   W225vW226 · W227vW228
 *   231      Tercer puesto L229vL230
 *   232      Final         W229vW230
 *
 * Los partidos de una ronda se CREAN cuando sus dos alimentadores
 * terminan (home/away son NOT NULL en el schema). advanceBracket()
 * es idempotente y corrige equipos si un resultado previo cambia,
 * siempre que el partido siguiente no haya empezado.
 */

interface Feeder {
  a: number
  b: number
  losers?: boolean // tercer puesto: avanzan los PERDEDORES de las semis
}

export const FEEDERS: Record<number, Feeder> = {
  217: { a: 201, b: 202 }, 218: { a: 203, b: 204 },
  219: { a: 205, b: 206 }, 220: { a: 207, b: 208 },
  221: { a: 209, b: 210 }, 222: { a: 211, b: 212 },
  223: { a: 213, b: 214 }, 224: { a: 215, b: 216 },
  225: { a: 217, b: 218 }, 226: { a: 219, b: 220 },
  227: { a: 221, b: 222 }, 228: { a: 223, b: 224 },
  229: { a: 225, b: 226 }, 230: { a: 227, b: 228 },
  231: { a: 229, b: 230, losers: true },
  232: { a: 229, b: 230 },
}

interface Slot {
  phase: string
  kickoff: string // UTC
  venue: string
  city: string
  country: string
}

export const KNOCKOUT_SCHEDULE: Record<number, Slot> = {
  217: { phase: 'round_of_16', kickoff: '2026-07-04 17:00:00+00', venue: 'MetLife Stadium',        city: 'East Rutherford', country: 'USA' },
  218: { phase: 'round_of_16', kickoff: '2026-07-04 21:00:00+00', venue: 'Lincoln Financial Field', city: 'Philadelphia',    country: 'USA' },
  219: { phase: 'round_of_16', kickoff: '2026-07-05 17:00:00+00', venue: 'NRG Stadium',            city: 'Houston',         country: 'USA' },
  220: { phase: 'round_of_16', kickoff: '2026-07-05 21:00:00+00', venue: 'Mercedes-Benz Stadium',  city: 'Atlanta',         country: 'USA' },
  221: { phase: 'round_of_16', kickoff: '2026-07-06 17:00:00+00', venue: 'SoFi Stadium',           city: 'Los Angeles',     country: 'USA' },
  222: { phase: 'round_of_16', kickoff: '2026-07-06 21:00:00+00', venue: 'Estadio Azteca',         city: 'Ciudad de México', country: 'Mexico' },
  223: { phase: 'round_of_16', kickoff: '2026-07-07 17:00:00+00', venue: 'AT&T Stadium',           city: 'Dallas',          country: 'USA' },
  224: { phase: 'round_of_16', kickoff: '2026-07-07 21:00:00+00', venue: 'Hard Rock Stadium',      city: 'Miami',           country: 'USA' },
  225: { phase: 'quarter_final', kickoff: '2026-07-09 19:00:00+00', venue: 'Gillette Stadium',     city: 'Boston',          country: 'USA' },
  226: { phase: 'quarter_final', kickoff: '2026-07-10 19:00:00+00', venue: 'SoFi Stadium',         city: 'Los Angeles',     country: 'USA' },
  227: { phase: 'quarter_final', kickoff: '2026-07-11 17:00:00+00', venue: 'Arrowhead Stadium',    city: 'Kansas City',     country: 'USA' },
  228: { phase: 'quarter_final', kickoff: '2026-07-11 21:00:00+00', venue: 'Hard Rock Stadium',    city: 'Miami',           country: 'USA' },
  229: { phase: 'semi_final', kickoff: '2026-07-14 20:00:00+00', venue: 'AT&T Stadium',            city: 'Dallas',          country: 'USA' },
  230: { phase: 'semi_final', kickoff: '2026-07-15 20:00:00+00', venue: 'Mercedes-Benz Stadium',   city: 'Atlanta',         country: 'USA' },
  231: { phase: 'third_place', kickoff: '2026-07-18 20:00:00+00', venue: 'Hard Rock Stadium',      city: 'Miami',           country: 'USA' },
  232: { phase: 'final', kickoff: '2026-07-19 19:00:00+00', venue: 'MetLife Stadium',              city: 'East Rutherford', country: 'USA' },
}

interface KnockoutMatchRow {
  id: string
  match_number: number
  status: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  home_penalties: number | null
  away_penalties: number | null
}

/** Ganador de un cruce terminado (null si no terminó o no es decidible). */
export function tieWinner(m: KnockoutMatchRow | undefined): string | null {
  if (!m || m.status !== 'finished' || m.home_score == null || m.away_score == null) return null
  if (m.home_score > m.away_score) return m.home_team_id
  if (m.away_score > m.home_score) return m.away_team_id
  // Empate en 90'+prórroga → penales
  if (m.home_penalties != null && m.away_penalties != null && m.home_penalties !== m.away_penalties) {
    return m.home_penalties > m.away_penalties ? m.home_team_id : m.away_team_id
  }
  return null
}

/** Perdedor de un cruce terminado (para el tercer puesto). */
export function tieLoser(m: KnockoutMatchRow | undefined): string | null {
  const w = tieWinner(m)
  if (!w || !m) return null
  return w === m.home_team_id ? m.away_team_id : m.home_team_id
}

/**
 * Crea/actualiza los cruces de la siguiente ronda cuyos alimentadores
 * ya terminaron. Devuelve el detalle de lo creado/actualizado.
 */
export async function advanceBracket(supabase: any): Promise<{
  created: number[]
  updated: number[]
  pendingPenalties: number[]
}> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, match_number, status, home_team_id, away_team_id, home_score, away_score, home_penalties, away_penalties')
    .eq('competition_id', COMPETITION_ID)
    .gte('match_number', 201)
    .lte('match_number', 232)
  if (error) throw error

  const byNumber = new Map<number, KnockoutMatchRow>(
    (data ?? []).map((m: KnockoutMatchRow) => [m.match_number, m])
  )

  const created: number[] = []
  const updated: number[] = []
  const pendingPenalties: number[] = []

  for (const [numStr, feeder] of Object.entries(FEEDERS)) {
    const num = Number(numStr)
    const fa = byNumber.get(feeder.a)
    const fb = byNumber.get(feeder.b)

    // Detectar empates sin penales registrados (bloquean el avance)
    for (const f of [fa, fb]) {
      if (f && f.status === 'finished' && f.home_score != null && f.home_score === f.away_score
          && tieWinner(f) === null && !pendingPenalties.includes(f.match_number)) {
        pendingPenalties.push(f.match_number)
      }
    }

    const teamA = feeder.losers ? tieLoser(fa) : tieWinner(fa)
    const teamB = feeder.losers ? tieLoser(fb) : tieWinner(fb)
    if (!teamA || !teamB) continue

    const existing = byNumber.get(num)
    const slot = KNOCKOUT_SCHEDULE[num]

    if (!existing) {
      const { error: insErr } = await supabase.from('matches').insert({
        competition_id: COMPETITION_ID,
        phase: slot.phase,
        match_number: num,
        status: 'scheduled',
        home_team_id: teamA,
        away_team_id: teamB,
        kickoff_time: slot.kickoff,
        venue: slot.venue,
        city: slot.city,
        country: slot.country,
      })
      if (insErr) throw insErr
      created.push(num)
    } else if (
      existing.status === 'scheduled' &&
      (existing.home_team_id !== teamA || existing.away_team_id !== teamB)
    ) {
      // Corrección de un resultado previo: reasignar equipos si aún no se juega
      const { error: updErr } = await supabase
        .from('matches')
        .update({ home_team_id: teamA, away_team_id: teamB })
        .eq('id', existing.id)
      if (updErr) throw updErr
      updated.push(num)
    }
  }

  return { created, updated, pendingPenalties }
}
