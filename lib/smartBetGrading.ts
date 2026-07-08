/**
 * Calificación de recomendaciones Smart Bets contra el resultado real.
 *
 * Módulo puro sin I/O — recibe el market_id (mismo id que genera
 * lib/smartBetsEngine.ts) y el resultado del partido, y responde si
 * acertó. Los mercados de córners/tarjetas requieren estadísticas
 * oficiales (match_statistics); sin ellas quedan como "no evaluable"
 * en vez de forzar un veredicto sin datos reales (Data First).
 *
 * Ver tests/smartBetGrading.test.ts.
 */

export interface GradeInput {
  marketId: string
  homeScore: number
  awayScore: number
  /** Suma de córners local+visitante si hay estadísticas oficiales */
  totalCorners?: number | null
  /** Suma de amarillas local+visitante si hay estadísticas oficiales */
  totalYellowCards?: number | null
}

export interface GradeResult {
  gradable: boolean
  correct: boolean | null
  detail: string
}

const CORNER_LINES: Record<string, number> = { corners_8_5: 8.5, corners_9_5: 9.5, corners_10_5: 10.5 }
const CARD_LINES: Record<string, number> = { cards_2_5: 2.5, cards_3_5: 3.5, cards_4_5: 4.5 }
const GOAL_LINES: Record<string, number> = { over_1_5: 1.5, over_2_5: 2.5, over_3_5: 3.5 }

export function gradeSmartBetPick(input: GradeInput): GradeResult {
  const { marketId, homeScore, awayScore } = input
  const totalGoals = homeScore + awayScore
  const scoreline = `${homeScore}-${awayScore}`

  switch (marketId) {
    case 'home_win':
      return { gradable: true, correct: homeScore > awayScore, detail: scoreline }
    case 'draw':
      return { gradable: true, correct: homeScore === awayScore, detail: scoreline }
    case 'away_win':
      return { gradable: true, correct: awayScore > homeScore, detail: scoreline }
    case 'dc_1x':
      return { gradable: true, correct: homeScore >= awayScore, detail: scoreline }
    case 'dc_x2':
      return { gradable: true, correct: awayScore >= homeScore, detail: scoreline }
    case 'btts_yes':
      return { gradable: true, correct: homeScore > 0 && awayScore > 0, detail: scoreline }
    case 'btts_no':
      return { gradable: true, correct: !(homeScore > 0 && awayScore > 0), detail: scoreline }
    case 'cs_home':
      return { gradable: true, correct: awayScore === 0, detail: scoreline }
    case 'cs_away':
      return { gradable: true, correct: homeScore === 0, detail: scoreline }
  }

  if (marketId in GOAL_LINES) {
    const line = GOAL_LINES[marketId]
    return { gradable: true, correct: totalGoals > line, detail: `${totalGoals} goles (${scoreline})` }
  }

  if (marketId in CORNER_LINES) {
    if (input.totalCorners == null) {
      return { gradable: false, correct: null, detail: 'Sin estadísticas oficiales de córners' }
    }
    const line = CORNER_LINES[marketId]
    return { gradable: true, correct: input.totalCorners > line, detail: `${input.totalCorners} córners` }
  }

  if (marketId in CARD_LINES) {
    if (input.totalYellowCards == null) {
      return { gradable: false, correct: null, detail: 'Sin estadísticas oficiales de tarjetas' }
    }
    const line = CARD_LINES[marketId]
    return { gradable: true, correct: input.totalYellowCards > line, detail: `${input.totalYellowCards} amarillas` }
  }

  return { gradable: false, correct: null, detail: 'Mercado no reconocido' }
}
