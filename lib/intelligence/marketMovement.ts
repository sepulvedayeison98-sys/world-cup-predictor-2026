/**
 * Market Movement — detecta drift en cuotas entre casas de apuestas.
 * Deriva señales de movimiento del spread entre bookmakers y del consenso implícito.
 */

export type MarketSignal = 'sube_local' | 'sube_visitante' | 'sube_empate' | 'estable' | 'sin_datos'

export interface MarketMovementSummary {
  signal: MarketSignal
  signalLabel: string
  signalColor: string
  consensusStrength: number    // 0..1 — qué tan alineadas están las casas
  spread: { home: number; draw: number; away: number }  // spread entre min/max cuota por resultado
  implied: { home: number; draw: number; away: number } // probabilidades implícitas promedio
  bookmakerCount: number
  sharpestBook: string | null  // casa con mayor diferencia vs promedio
}

interface OddsLine {
  bookmaker: string
  market: string
  odds_value: number
  implied_probability?: number
}

export function analyzeMarketMovement(odds: OddsLine[]): MarketMovementSummary {
  // Agrupar las cuotas 1X2 por bookmaker
  type H2HEntry = { home?: number; draw?: number; away?: number }
  const bookmakerMap = new Map<string, H2HEntry>()

  for (const o of odds) {
    const market = (o.market ?? '').toLowerCase()
    if (!['h2h', '1x2', 'match_winner'].includes(market)) continue

    const implied = o.implied_probability ?? (o.odds_value > 1 ? 1 / o.odds_value : 0)
    if (!bookmakerMap.has(o.bookmaker)) bookmakerMap.set(o.bookmaker, {})
    const entry = bookmakerMap.get(o.bookmaker)!

    // Inferir resultado por probabilidad implícita (home > away typically)
    if (!entry.home || implied > (entry.home ?? 0)) {
      if (!entry.home) entry.home = implied
      else if (!entry.draw) entry.draw = implied
      else entry.away = implied
    }
  }

  // También parsear cuotas con market específico
  for (const o of odds) {
    const market = (o.market ?? '').toLowerCase()
    if (!bookmakerMap.has(o.bookmaker)) bookmakerMap.set(o.bookmaker, {})
    const entry = bookmakerMap.get(o.bookmaker)!

    if (market === 'home_win' || market === 'h2h_home')   entry.home = o.implied_probability ?? 1 / Math.max(o.odds_value, 1.01)
    if (market === 'draw' || market === 'h2h_draw')        entry.draw = o.implied_probability ?? 1 / Math.max(o.odds_value, 1.01)
    if (market === 'away_win' || market === 'h2h_away')   entry.away = o.implied_probability ?? 1 / Math.max(o.odds_value, 1.01)
  }

  const completeLines = Array.from(bookmakerMap.entries())
    .filter(([, e]) => e.home && e.draw && e.away)

  if (completeLines.length === 0) {
    return {
      signal: 'sin_datos', signalLabel: 'Sin datos', signalColor: 'text-zinc-600',
      consensusStrength: 0, spread: { home: 0, draw: 0, away: 0 },
      implied: { home: 0.33, draw: 0.33, away: 0.34 },
      bookmakerCount: 0, sharpestBook: null,
    }
  }

  const homes = completeLines.map(([, e]) => e.home!)
  const draws = completeLines.map(([, e]) => e.draw!)
  const aways = completeLines.map(([, e]) => e.away!)

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
  const avgHome = avg(homes), avgDraw = avg(draws), avgAway = avg(aways)
  const spreadHome = Math.max(...homes) - Math.min(...homes)
  const spreadDraw = Math.max(...draws) - Math.min(...draws)
  const spreadAway = Math.max(...aways) - Math.min(...aways)

  // Consenso: 1 - varianza promedio normalizada
  const variance = (arr: number[], mean: number) => arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length
  const avgVar = (variance(homes, avgHome) + variance(draws, avgDraw) + variance(aways, avgAway)) / 3
  const consensusStrength = Math.max(0, 1 - avgVar * 50)

  // Casa más "sharp" — la que más difiere del promedio
  const bookDeviations = completeLines.map(([bk, e]) => ({
    bk,
    dev: Math.abs((e.home! - avgHome)) + Math.abs((e.draw! - avgDraw)) + Math.abs((e.away! - avgAway)),
  }))
  const sharpestBook = bookDeviations.length > 0
    ? bookDeviations.sort((a, b) => b.dev - a.dev)[0].bk
    : null

  // Señal: el resultado con mayor dispersión es donde el mercado está en movimiento
  const maxSpread = Math.max(spreadHome, spreadDraw, spreadAway)
  let signal: MarketSignal = 'estable'
  if (maxSpread > 0.04) {
    if (maxSpread === spreadHome) signal = 'sube_local'
    else if (maxSpread === spreadAway) signal = 'sube_visitante'
    else signal = 'sube_empate'
  }

  const SIGNAL_META: Record<MarketSignal, { label: string; color: string }> = {
    sube_local:      { label: 'Mov. hacia local',     color: 'text-emerald-400' },
    sube_visitante:  { label: 'Mov. hacia visitante', color: 'text-red-400'     },
    sube_empate:     { label: 'Mov. hacia empate',    color: 'text-amber-400'   },
    estable:         { label: 'Mercado estable',      color: 'text-zinc-400'    },
    sin_datos:       { label: 'Sin datos',            color: 'text-zinc-600'    },
  }

  return {
    signal,
    signalLabel: SIGNAL_META[signal].label,
    signalColor: SIGNAL_META[signal].color,
    consensusStrength: Math.round(consensusStrength * 100) / 100,
    spread: {
      home: Math.round(spreadHome * 1000) / 1000,
      draw: Math.round(spreadDraw * 1000) / 1000,
      away: Math.round(spreadAway * 1000) / 1000,
    },
    implied: {
      home: Math.round(avgHome * 10000) / 10000,
      draw: Math.round(avgDraw * 10000) / 10000,
      away: Math.round(avgAway * 10000) / 10000,
    },
    bookmakerCount: completeLines.length,
    sharpestBook,
  }
}
