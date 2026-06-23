import { analyzeMarketMovement, type MarketMovementSummary } from '@/lib/intelligence/marketMovement'

export interface MarketMovementReport {
  summary: MarketMovementSummary
  valueDiscrepancies: { outcome: 'home' | 'draw' | 'away'; modelProb: number; marketProb: number; edge: number }[]
  alignment: 'fuerte' | 'moderado' | 'débil' | 'sin_datos'
  alignmentNote: string
  canTrust: boolean
}

interface MarketMovementInput {
  odds: any[]
  prediction?: any | null
}

export function runMarketMovementAgent({ odds, prediction }: MarketMovementInput): MarketMovementReport {
  const summary = analyzeMarketMovement(
    (odds ?? []).map((o) => ({
      bookmaker: o.bookmaker,
      market: o.market,
      odds_value: o.odds_value,
      implied_probability: o.implied_probability,
    }))
  )

  // Value discrepancies: where does the model disagree with the market?
  const valueDiscrepancies: MarketMovementReport['valueDiscrepancies'] = []
  if (prediction && summary.signal !== 'sin_datos') {
    const pairs: { outcome: 'home' | 'draw' | 'away'; modelProb: number; marketProb: number }[] = [
      { outcome: 'home', modelProb: prediction.home_win_probability ?? 0, marketProb: summary.implied.home },
      { outcome: 'draw', modelProb: prediction.draw_probability ?? 0,     marketProb: summary.implied.draw },
      { outcome: 'away', modelProb: prediction.away_win_probability ?? 0, marketProb: summary.implied.away },
    ]
    for (const p of pairs) {
      const edge = p.modelProb - p.marketProb
      if (Math.abs(edge) > 0.04) {
        valueDiscrepancies.push({ ...p, edge: Math.round(edge * 1000) / 1000 })
      }
    }
  }

  // Market alignment assessment
  let alignment: MarketMovementReport['alignment']
  let alignmentNote: string

  if (summary.signal === 'sin_datos') {
    alignment = 'sin_datos'
    alignmentNote = 'No hay datos de cuotas para este partido.'
  } else if (summary.consensusStrength >= 0.85) {
    alignment = 'fuerte'
    alignmentNote = `${summary.bookmakerCount} casas alineadas (consenso ${Math.round(summary.consensusStrength * 100)}%). Cuotas estables y confiables.`
  } else if (summary.consensusStrength >= 0.65) {
    alignment = 'moderado'
    alignmentNote = `Consenso moderado entre ${summary.bookmakerCount} casas. Hay dispersión en ${
      summary.spread.home > summary.spread.away && summary.spread.home > summary.spread.draw ? 'el local' :
      summary.spread.away > summary.spread.draw ? 'el visitante' : 'el empate'
    }.`
  } else {
    alignment = 'débil'
    alignmentNote = `Baja concordancia entre casas (consenso ${Math.round(summary.consensusStrength * 100)}%). ${summary.sharpestBook ? `"${summary.sharpestBook}" tiene posición atípica.` : ''} Posible movimiento de mercado activo.`
  }

  const canTrust = summary.bookmakerCount >= 2 && summary.consensusStrength >= 0.6

  return { summary, valueDiscrepancies, alignment, alignmentNote, canTrust }
}
