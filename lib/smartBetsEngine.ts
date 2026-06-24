/**
 * Smart Bets AI Engine v2 — Motor de Decisión Inteligente
 *
 * Arquitectura de 9 capas:
 *   Capa 1: Recolección y normalización de señales
 *   Capa 2: Motor Monte Carlo (50.000 simulaciones reales)
 *   Capa 3: Score de consenso entre modelos
 *   Capa 4: Detector de volatilidad/incertidumbre
 *   Capa 5: Motor de edge vs mercado
 *   Capa 6: Generador dinámico de candidatos
 *   Capa 7: Explicabilidad — evidencia MC por recomendación
 *   Capa 8: Ranking por ventaja matemática (no por categoría)
 *   Capa 9: Diversidad — máximo 1 por familia de mercado
 */

import { getMatchContext } from '@/lib/matchContext'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type SmartBetTier     = 'premium' | 'muy_fuerte' | 'fuerte' | 'moderada' | 'evitar'
export type SmartBetCategory = 'resultado' | 'goles' | 'porteria' | 'corners' | 'tarjetas' | 'disparos' | 'combinada'
export type VolatilityLevel  = 'LOW_VOLATILITY' | 'MEDIUM_VOLATILITY' | 'HIGH_VOLATILITY'

export interface MCEvidence {
  simulations:  number  // N simulaciones ejecutadas
  p50Goals:     number  // mediana de goles totales
  p80Goals:     number  // percentil 80 de goles totales
  p95Goals:     number  // percentil 95 de goles totales
  stdDev:       number  // desviación estándar de goles totales
  topScore:     string  // marcador más frecuente "H-A"
  topScoreFreq: number  // % de simulaciones con ese marcador
}

export interface SmartBetRecommendation {
  id:             string
  label:          string
  category:       SmartBetCategory
  rank:           number           // posición final 1-5
  confidence:     number           // probabilidad modelo × 100
  tier:           SmartBetTier
  edge:           number | null    // % ventaja vs mercado (null si sin cuotas)
  mcFrequency:    number           // % simulaciones donde la apuesta gana
  consensusScore: number           // 0-100 acuerdo entre modelos
  volatility:     VolatilityLevel
  mcEvidence:     MCEvidence
  justification:  string
  factors:        { for: string[]; against: string[] }
}

// ─── Utilidades internas ───────────────────────────────────────────────────────

function toTier(c: number): SmartBetTier {
  if (c >= 90) return 'premium'
  if (c >= 80) return 'muy_fuerte'
  if (c >= 70) return 'fuerte'
  if (c >= 60) return 'moderada'
  return 'evitar'
}

/** P(X > k) Poisson analítico — solo para corners/tarjetas/disparos */
function poissonOver(lambda: number, k: number): number {
  if (lambda <= 0) return 0
  let cum = 0, term = Math.exp(-lambda)
  for (let i = 0; i <= k; i++) { cum += term; term *= lambda / (i + 1) }
  return Math.max(0, Math.min(1, 1 - cum))
}

function formScore(form: string[] | null | undefined): number {
  if (!form?.length) return 0.5
  const r = form.slice(-5)
  return r.reduce((s, x) => s + (x === 'W' ? 1 : x === 'D' ? 0.5 : 0), 0) / r.length
}

function formStr(form: string[] | null | undefined): string {
  if (!form?.length) return ''
  return form.slice(-5).join(' ')
}

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  return sorted[Math.min(Math.floor(p * (sorted.length - 1)), sorted.length - 1)]
}

function fmt1(x: number): string { return x.toFixed(1) }
function fmt2(x: number): string { return x.toFixed(2) }
function pctStr(x: number): string { return `${Math.round(x * 1000) / 10}%` }

// ─── CAPA 2: Motor Monte Carlo ────────────────────────────────────────────────

interface MCRun {
  homeWin:    number   // conteo
  draw:       number
  awayWin:    number
  bothScored: number
  totalDist:  number[] // sorted asc
  homeDist:   number[] // sorted asc
  awayDist:   number[] // sorted asc
  exactScores: Map<string, number>
  N:          number
}

/** Muestreo Poisson (método Knuth). Promedio = lambda iteraciones. */
function samplePoisson(lambda: number): number {
  if (lambda <= 0) return 0
  const L = Math.exp(-Math.min(lambda, 20))
  let k = 0, p = 1
  do { k++; p *= Math.random() } while (p > L && k < 25)
  return k - 1
}

function runMC(lH: number, lA: number, N: number): MCRun {
  let homeWin = 0, draw = 0, awayWin = 0, bothScored = 0
  const totalDist = new Array<number>(N)
  const homeDist  = new Array<number>(N)
  const awayDist  = new Array<number>(N)
  const exactScores = new Map<string, number>()

  for (let i = 0; i < N; i++) {
    const h = samplePoisson(lH)
    const a = samplePoisson(lA)
    totalDist[i] = h + a
    homeDist[i]  = h
    awayDist[i]  = a
    if (h > a)       homeWin++
    else if (h < a)  awayWin++
    else             draw++
    if (h > 0 && a > 0) bothScored++
    const key = `${h}-${a}`
    exactScores.set(key, (exactScores.get(key) ?? 0) + 1)
  }

  totalDist.sort((a, b) => a - b)
  homeDist.sort((a, b) => a - b)
  awayDist.sort((a, b) => a - b)

  return { homeWin, draw, awayWin, bothScored, totalDist, homeDist, awayDist, exactScores, N }
}

function extractMCEvidence(mc: MCRun, N: number): MCEvidence {
  const p50Goals = pct(mc.totalDist, 0.50)
  const p80Goals = pct(mc.totalDist, 0.80)
  const p95Goals = pct(mc.totalDist, 0.95)
  const mean = mc.totalDist.reduce((s, v) => s + v, 0) / N
  const variance = mc.totalDist.reduce((s, v) => s + (v - mean) ** 2, 0) / N
  const stdDev = Math.round(Math.sqrt(variance) * 100) / 100

  let topKey = '1-0', topCount = 0
  for (const [k, c] of mc.exactScores) {
    if (c > topCount) { topCount = c; topKey = k }
  }

  return {
    simulations: N,
    p50Goals, p80Goals, p95Goals, stdDev,
    topScore: topKey,
    topScoreFreq: Math.round(topCount / N * 1000) / 10,
  }
}

// ─── CAPA 3: Consenso entre modelos ──────────────────────────────────────────

function consensusScore(prediction: any, homeWin: number, draw: number, awayWin: number): number {
  const base   = prediction.confidence_score ?? 60              // 40..95
  const maxP   = Math.max(homeWin, draw, awayWin)
  const dec    = Math.max(0, (maxP - 1 / 3) * 3)               // 0..1 decisiveness
  return Math.round(Math.min(100, Math.max(0, base * 0.60 + dec * 40)))
}

// ─── CAPA 4: Detector de volatilidad ─────────────────────────────────────────

// Recibe stdDev precalculado por extractMCEvidence para evitar 2 pases extra sobre N=50k
function detectVolatility(mc: MCRun, stdDev: number): VolatilityLevel {
  let topCount = 0
  for (const c of mc.exactScores.values()) { if (c > topCount) topCount = c }
  const topConc = topCount / mc.N

  if (stdDev < 1.25 && topConc > 0.18) return 'LOW_VOLATILITY'
  if (stdDev > 1.85 || topConc < 0.10) return 'HIGH_VOLATILITY'
  return 'MEDIUM_VOLATILITY'
}

// ─── CAPA 5: Motor de edge ────────────────────────────────────────────────────

/** Construye mapa market → implied_prob tomando siempre la cuota más favorable. */
function buildOddsMap(odds: any[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const o of odds ?? []) {
    const impl = o.implied_probability as number
    if (!impl || impl <= 0 || impl >= 1) continue
    if (!map.has(o.market) || impl < (map.get(o.market) ?? 1)) {
      map.set(o.market, impl)
    }
  }
  return map
}

function edge(modelProb: number, oddsMap: Map<string, number>, market: string): number | null {
  const implied = oddsMap.get(market)
  if (implied == null) return null
  return Math.round((modelProb - implied) * 1000) / 10
}

// ─── CAPA 6-8: Candidatos + Ranking ──────────────────────────────────────────

interface Candidate {
  id:        string
  label:     string
  category:  SmartBetCategory
  prob:      number          // probabilidad modelo (0..1)
  edgePct:   number | null
  analytic:  boolean         // true = corners/tarjetas (sin MC directo)
  justParts: string[]
  factors:   { for: string[]; against: string[] }
}

function rankScore(c: Candidate, consensus: number, hasOdds: boolean): number {
  const base     = c.prob
  const edgeB    = c.edgePct != null && c.edgePct > 0 ? c.edgePct / 100 : 0
  const consB    = consensus / 100
  const analyticPenalty = c.analytic ? 0.08 : 0  // MC evidence > analytic

  if (hasOdds && c.edgePct != null) {
    return base * 0.40 + edgeB * 0.35 + consB * 0.25 - analyticPenalty
  }
  if (c.analytic) {
    return base * 0.55 + consB * 0.20 - analyticPenalty
  }
  return base * 0.60 + consB * 0.40
}

function family(id: string): string {
  if (id.startsWith('over_'))     return 'over_goals'
  if (id.startsWith('under_'))    return 'under_goals'
  if (id.startsWith('corners_'))  return 'corners'
  if (id.startsWith('cards_'))    return 'cards'
  if (id.startsWith('shots_ot_')) return 'shots_ot'
  if (id.startsWith('cs_'))       return 'clean_sheet'
  // btts_yes/btts_no y dc_1x/dc_x2 son mercados complementarios independientes:
  // ambos lados pueden aparecer simultáneamente cuando los dos superan el umbral
  return id
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Genera las 5 mejores oportunidades de apuesta para el partido,
 * ordenadas por ventaja matemática real (edge + MC + consenso).
 * Cada recomendación es única: las distribuciones MC del partido
 * determinan qué mercados aparecen, no plantillas fijas.
 */
export function computeSmartBets(
  prediction: any,
  homeStats:  any,
  awayStats:  any,
  homeTeam:   any,
  awayTeam:   any,
  injuries:   any[],
  match?:     any,
  odds?:      any[],
  simCount = 50_000,
): SmartBetRecommendation[] {
  if (!prediction) return []

  // ── CAPA 1: Señales ─────────────────────────────────────────────────────────
  const homeWin = prediction.home_win_probability ?? 0.33
  const draw    = prediction.draw_probability     ?? 0.33
  const awayWin = prediction.away_win_probability ?? 0.33

  const homeXG      = homeStats?.avg_xg              ?? Math.max(0.5, prediction.predicted_home_score ?? 1.2)
  const awayXG      = awayStats?.avg_xg              ?? Math.max(0.5, prediction.predicted_away_score ?? 0.9)
  const homeXGA     = homeStats?.avg_xga             ?? Math.max(0.5, prediction.predicted_away_score ?? 0.9)
  const awayXGA     = awayStats?.avg_xga             ?? Math.max(0.5, prediction.predicted_home_score ?? 1.2)
  const homeGoals   = homeStats?.avg_goals_scored    ?? Math.max(0.5, prediction.predicted_home_score ?? 1.2)
  const awayGoals   = awayStats?.avg_goals_scored    ?? Math.max(0.5, prediction.predicted_away_score ?? 0.9)
  const homeCorners = homeStats?.avg_corners         ?? 4.5
  const awayCorners = awayStats?.avg_corners         ?? 4.0
  const homeYellow  = homeStats?.avg_yellow_cards    ?? 1.5
  const awayYellow  = awayStats?.avg_yellow_cards    ?? 1.5
  const homeShotsOT = homeStats?.avg_shots_on_target ?? 3.5
  const awayShotsOT = awayStats?.avg_shots_on_target ?? 3.0

  const eloDiff   = (homeTeam?.elo_rating ?? 1500) - (awayTeam?.elo_rating ?? 1500)
  const homeName  = homeTeam?.short_name ?? homeTeam?.name ?? 'Local'
  const awayName  = awayTeam?.short_name ?? awayTeam?.name ?? 'Visitante'

  const homeInj = injuries.filter((i: any) => i.team_id === homeTeam?.id)
  const awayInj = injuries.filter((i: any) => i.team_id === awayTeam?.id)
  const homeInjImpact = homeInj.reduce((s: number, i: any) => s + (i.impact_score ?? 0), 0)
  const awayInjImpact = awayInj.reduce((s: number, i: any) => s + (i.impact_score ?? 0), 0)
  const homeKeyDown   = homeInj.filter((i: any) => i.impact_score >= 7)
  const awayKeyDown   = awayInj.filter((i: any) => i.impact_score >= 7)

  // Contexto de partido — helper compartido con MonteCarloPanel
  const ctx        = getMatchContext(match)
  const { isKnockout, isBadW, isHot, goalMult, cornersF } = ctx
  const homeRest   = match?.home_rest_days ?? 4
  const awayRest   = match?.away_rest_days ?? 4

  const homeFS   = formScore(homeStats?.form)
  const awayFS   = formScore(awayStats?.form)
  const homeFStr = formStr(homeStats?.form)
  const awayFStr = formStr(awayStats?.form)

  // ── CAPA 2: Monte Carlo ──────────────────────────────────────────────────────
  // Lambda convergente: usa los valores calibrados del motor de predicción como
  // fuente primaria (ya incorporan ELO, forma, cuotas, noticias y xG).
  // Si hay stats de xG disponibles, se mezclan al 40% para mayor granularidad.
  const predLH = Math.max(0.15, prediction.predicted_home_score ?? 1.2)
  const predLA = Math.max(0.15, prediction.predicted_away_score ?? 0.9)
  const xgLH   = Math.max(0.15, (homeXG + awayXGA) / 2)
  const xgLA   = Math.max(0.15, (awayXG + homeXGA) / 2)
  const hasXgStats = homeStats?.avg_xg != null && awayStats?.avg_xg != null

  const rawLH = hasXgStats ? predLH * 0.60 + xgLH * 0.40 : predLH
  const rawLA = hasXgStats ? predLA * 0.60 + xgLA * 0.40 : predLA

  const lH = rawLH * goalMult
  const lA = rawLA * goalMult

  const mc  = runMC(lH, lA, simCount)
  const N   = mc.N
  const mce = extractMCEvidence(mc, N)

  // Probabilidades MC (binary-search sobre array ordenado para O(log N))
  function mcCount(dist: number[], gt: number): number {
    let lo = 0, hi = dist.length
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (dist[mid] <= gt) lo = mid + 1; else hi = mid }
    return dist.length - lo
  }

  const mcHomeWin   = mc.homeWin    / N
  const mcDraw      = mc.draw       / N
  const mcAwayWin   = mc.awayWin    / N
  const mcBothScore = mc.bothScored / N
  const mcOver05    = mcCount(mc.totalDist, 0) / N
  const mcOver15    = mcCount(mc.totalDist, 1) / N
  const mcOver25    = mcCount(mc.totalDist, 2) / N
  const mcOver35    = mcCount(mc.totalDist, 3) / N
  const mcCS_home   = (N - mcCount(mc.awayDist, 0)) / N   // awayDist === 0
  const mcCS_away   = (N - mcCount(mc.homeDist, 0)) / N   // homeDist === 0
  const mcDC_1X     = mcHomeWin + mcDraw
  const mcDC_X2     = mcDraw    + mcAwayWin

  // Analíticos (corners, tarjetas, disparos — lambdas independientes)
  const expCorners  = (homeCorners + awayCorners) * cornersF
  const expYellow   = homeYellow + awayYellow
  const expShotsOT  = homeShotsOT + awayShotsOT

  // ── CAPA 3: Consenso ────────────────────────────────────────────────────────
  const consensus = consensusScore(prediction, homeWin, draw, awayWin)

  // ── CAPA 4: Volatilidad (reutiliza stdDev de mce — sin pases extra sobre N) ─
  const volatility = detectVolatility(mc, mce.stdDev)

  // ── CAPA 5: Odds ────────────────────────────────────────────────────────────
  const oddsMap = buildOddsMap(odds ?? [])
  const hasOdds = oddsMap.size > 0

  // ── CAPA 6: Candidatos ──────────────────────────────────────────────────────
  const candidates: Candidate[] = []

  function add(c: Candidate) {
    if (c.prob >= 0.05) candidates.push(c)
  }

  const xGCombined = homeXG + awayXG

  // ─ RESULTADO 1X2 ──────────────────────────────────────────────────────────

  {
    const injF  = homeInjImpact > 15 ? 0.96 : 1.0
    const restF = homeRest < 3 ? 0.96 : 1.0
    const formF = homeFS >= 0.7 ? 1.02 : homeFS <= 0.3 ? 0.97 : 1.0
    const prob  = Math.min(0.96, mcHomeWin * injF * restF * formF)
    const e     = edge(prob, oddsMap, 'home_win')

    const fFor: string[] = [], fAg: string[] = []
    if (eloDiff > 80)   fFor.push(`Ventaja ELO significativa (+${eloDiff} pts)`)
    if (homeXG > awayXGA * 1.2) fFor.push(`xG superior a defensa rival (${fmt2(homeXG)} vs ${fmt2(awayXGA)})`)
    if (homeFS >= 0.7 && homeFStr) fFor.push(`Forma reciente: ${homeFStr}`)
    if (consensus >= 75) fFor.push(`Consenso de modelos alto (${consensus}/100)`)
    if (homeRest < 3) fAg.push(`Solo ${homeRest}d descanso — fatiga posible`)
    if (Math.abs(eloDiff) < 60) fAg.push('ELO equilibrado — partido abierto')
    if (homeKeyDown.length) fAg.push(`Baja clave: ${homeKeyDown[0].player?.short_name ?? 'jugador'}`)
    if (volatility === 'HIGH_VOLATILITY') fAg.push('Alta dispersión MC — resultado incierto')

    add({
      id: 'home_win', label: `${homeName} gana`, category: 'resultado',
      prob, edgePct: e, analytic: false,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) },
      justParts: [
        `${homeName} ganó en ${pctStr(mcHomeWin)} de ${N.toLocaleString()} simulaciones.`,
        `Marcador más frecuente: ${mce.topScore} (${mce.topScoreFreq}% de sim.).`,
        `xG local: ${fmt2(homeXG)} · xGA rival: ${fmt2(awayXGA)}.`,
        `Consenso: ${consensus}/100.`,
        e != null ? `Edge vs mercado: ${e > 0 ? '+' : ''}${fmt1(e)}%.` : '',
      ],
    })
  }

  {
    const drawMult = isKnockout ? 1.04 : 1.0
    const prob     = Math.min(0.96, mcDraw * drawMult)
    const e        = edge(prob, oddsMap, 'draw')

    const fFor: string[] = [], fAg: string[] = []
    if (Math.abs(eloDiff) < 60)  fFor.push(`Equipos igualados por ELO (dif. ${Math.abs(eloDiff)} pts)`)
    if (Math.abs(homeXG - awayXG) < 0.35) fFor.push(`xG casi idéntico (${fmt2(homeXG)} vs ${fmt2(awayXG)})`)
    if (isKnockout)              fFor.push('Eliminatoria — equipos más conservadores')
    if (mce.p50Goals <= 1)       fFor.push(`P50 de goles = ${mce.p50Goals} — partido muy ajustado`)
    if (Math.abs(eloDiff) > 120) fAg.push('Gran diferencia de nivel — empate menos probable')
    if (homeWin > 0.50 || awayWin > 0.50) fAg.push('El motor favorece claramente a un equipo')

    add({
      id: 'draw', label: 'Empate', category: 'resultado',
      prob, edgePct: e, analytic: false,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) },
      justParts: [
        `Empate en ${pctStr(mcDraw)} de ${N.toLocaleString()} simulaciones.`,
        `P50 goles totales: ${mce.p50Goals} · P80: ${mce.p80Goals}.`,
        `Consenso: ${consensus}/100.`,
        e != null ? `Edge vs mercado: ${e > 0 ? '+' : ''}${fmt1(e)}%.` : '',
      ],
    })
  }

  {
    const injF  = awayInjImpact > 15 ? 0.96 : 1.0
    const restF = awayRest < 3 ? 0.96 : 1.0
    const formF = awayFS >= 0.7 ? 1.02 : awayFS <= 0.3 ? 0.97 : 1.0
    const prob  = Math.min(0.96, mcAwayWin * injF * restF * formF)
    const e     = edge(prob, oddsMap, 'away_win')

    const fFor: string[] = [], fAg: string[] = []
    if (eloDiff < -80)   fFor.push(`Ventaja ELO del visitante (${Math.abs(eloDiff)} pts)`)
    if (awayXG > homeXGA * 1.2) fFor.push(`xG visitante supera defensa local (${fmt2(awayXG)} vs ${fmt2(homeXGA)})`)
    if (awayFS >= 0.7 && awayFStr) fFor.push(`Forma visitante: ${awayFStr}`)
    if (awayRest < 3) fAg.push(`Solo ${awayRest}d descanso del visitante`)
    if (homeFS >= 0.7 && homeFStr) fAg.push(`${homeName} en buena forma: ${homeFStr}`)
    if (awayKeyDown.length) fAg.push(`Baja clave: ${awayKeyDown[0].player?.short_name ?? 'jugador'}`)

    add({
      id: 'away_win', label: `${awayName} gana`, category: 'resultado',
      prob, edgePct: e, analytic: false,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) },
      justParts: [
        `${awayName} ganó en ${pctStr(mcAwayWin)} de ${N.toLocaleString()} simulaciones.`,
        `Marcador más frecuente: ${mce.topScore}.`,
        `xG visitante: ${fmt2(awayXG)} · xGA local: ${fmt2(homeXGA)}.`,
        e != null ? `Edge vs mercado: ${e > 0 ? '+' : ''}${fmt1(e)}%.` : '',
      ],
    })
  }

  // ─ DOBLE OPORTUNIDAD ──────────────────────────────────────────────────────

  if (homeWin >= 0.28 || mcDraw >= 0.25) {
    const prob = Math.min(0.99, mcDC_1X)
    const e    = edge(prob, oddsMap, 'dc_1x')
    add({
      id: 'dc_1x', label: `${homeName} o empate (1X)`, category: 'resultado',
      prob, edgePct: e, analytic: false,
      factors: {
        for: [
          `Cubre ${Math.round(mcDC_1X * 100)}% de los escenarios MC`,
          eloDiff > 40 ? `${homeName} parte con ventaja ELO (+${eloDiff} pts)` : 'Partido equilibrado — empate plausible',
        ],
        against: [mcAwayWin > 0.38 ? `Visitante gana en ${Math.round(mcAwayWin * 100)}% de sim.` : ''].filter(Boolean),
      },
      justParts: [
        `Cubre ${pctStr(mcDC_1X)} de ${N.toLocaleString()} simulaciones.`,
        `Vic. local: ${Math.round(mcHomeWin * 100)}% + Empate: ${Math.round(mcDraw * 100)}%.`,
        e != null ? `Edge: ${e > 0 ? '+' : ''}${fmt1(e)}%.` : '',
      ],
    })
  }

  if (awayWin >= 0.28 || mcDraw >= 0.25) {
    const prob = Math.min(0.99, mcDC_X2)
    const e    = edge(prob, oddsMap, 'dc_x2')
    add({
      id: 'dc_x2', label: `${awayName} o empate (X2)`, category: 'resultado',
      prob, edgePct: e, analytic: false,
      factors: {
        for: [
          `Cubre ${Math.round(mcDC_X2 * 100)}% de los escenarios MC`,
          eloDiff < -40 ? `${awayName} parte con ventaja ELO` : 'Partido equilibrado',
        ],
        against: [mcHomeWin > 0.38 ? `Local gana en ${Math.round(mcHomeWin * 100)}% de sim.` : ''].filter(Boolean),
      },
      justParts: [
        `Cubre ${pctStr(mcDC_X2)} de ${N.toLocaleString()} simulaciones.`,
        `Empate: ${Math.round(mcDraw * 100)}% + Vic. visitante: ${Math.round(mcAwayWin * 100)}%.`,
        e != null ? `Edge: ${e > 0 ? '+' : ''}${fmt1(e)}%.` : '',
      ],
    })
  }

  // ─ GOLES (desde distribución MC) ─────────────────────────────────────────

  const goalsMarkets = [
    { id: 'over_0_5', label: 'Más de 0.5 goles', prob: mcOver05 },
    { id: 'over_1_5', label: 'Más de 1.5 goles', prob: mcOver15 },
    { id: 'over_2_5', label: 'Más de 2.5 goles', prob: mcOver25 },
    { id: 'over_3_5', label: 'Más de 3.5 goles', prob: mcOver35 },
  ]

  for (const { id, label, prob } of goalsMarkets) {
    const e     = edge(prob, oddsMap, id)
    const k     = parseFloat(id.replace('over_', '').replace('_', '.'))
    const fFor: string[] = [], fAg: string[] = []
    if (xGCombined > 2.5)  fFor.push(`xG combinado alto (${fmt2(xGCombined)}/p)`)
    if (mce.p80Goals > k + 1)   fFor.push(`P80 goles = ${mce.p80Goals} — supera ampliamente el umbral`)
    if (mce.stdDev < 1.3 && mce.p50Goals > k) fFor.push(`Baja dispersión MC — resultado consistente`)
    if (isKnockout)        fAg.push('Eliminatoria — tendencia defensiva')
    if (isBadW)            fAg.push('Condiciones adversas reducen ofensiva')

    add({
      id, label, category: 'goles',
      prob, edgePct: e, analytic: false,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) },
      justParts: [
        `Ocurrió en ${pctStr(prob)} de ${N.toLocaleString()} simulaciones.`,
        `P50 goles = ${mce.p50Goals} · P80 = ${mce.p80Goals} · P95 = ${mce.p95Goals}.`,
        `xG combinado: ${fmt2(xGCombined)} · λ local: ${fmt2(lH)} · λ visit.: ${fmt2(lA)}.`,
        e != null ? `Edge vs mercado: ${e > 0 ? '+' : ''}${fmt1(e)}%.` : '',
      ],
    })
  }

  // ─ AMBOS MARCAN (desde MC) ────────────────────────────────────────────────

  {
    const e    = edge(mcBothScore, oddsMap, 'btts_yes')
    const fFor: string[] = [], fAg: string[] = []
    if (homeXG > 1.0 && awayXG > 0.8) fFor.push(`Ambos generan xG elevado (${fmt2(homeXG)} y ${fmt2(awayXG)})`)
    if (homeGoals > 1.2) fFor.push(`${homeName} anota en casi todos sus partidos`)
    if (awayGoals > 1.0) fFor.push(`${awayName} también suele anotar (${fmt1(awayGoals)}/p)`)
    if (lA < 0.7)  fAg.push(`λ visitante bajo (${fmt2(lA)}) — visitante poco generador`)
    if (awayXG < 0.8) fAg.push(`${awayName} genera poco xG (${fmt2(awayXG)})`)

    add({
      id: 'btts_yes', label: 'Ambos equipos marcan', category: 'goles',
      prob: mcBothScore, edgePct: e, analytic: false,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) },
      justParts: [
        `Ambos marcaron en ${pctStr(mcBothScore)} de ${N.toLocaleString()} simulaciones.`,
        `λ local: ${fmt2(lH)} · λ visitante: ${fmt2(lA)}.`,
        `P50 goles totales: ${mce.p50Goals}.`,
        e != null ? `Edge vs mercado: ${e > 0 ? '+' : ''}${fmt1(e)}%.` : '',
      ],
    })
  }

  {
    const probNo = 1 - mcBothScore
    const e      = edge(probNo, oddsMap, 'btts_no')
    add({
      id: 'btts_no', label: 'No marcan los dos', category: 'goles',
      prob: probNo, edgePct: e, analytic: false,
      factors: {
        for: [
          lA < 0.8 ? `λ visitante bajo (${fmt2(lA)})` : '',
          mcCS_home > 0.30 ? `${homeName} portería a cero en ${Math.round(mcCS_home * 100)}% de sim.` : '',
        ].filter(Boolean),
        against: [homeXG > 1.2 && awayXG > 1.0 ? 'Ambos atacan con eficacia' : ''].filter(Boolean),
      },
      justParts: [
        `Solo uno/ninguno marcó en ${pctStr(probNo)} de ${N.toLocaleString()} simulaciones.`,
        e != null ? `Edge vs mercado: ${e > 0 ? '+' : ''}${fmt1(e)}%.` : '',
      ],
    })
  }

  // ─ PORTERÍA A CERO (desde MC) ────────────────────────────────────────────

  {
    const probCS = mcCS_home
    const e      = edge(probCS, oddsMap, 'clean_sheet_home')
    const fFor: string[] = [], fAg: string[] = []
    if (homeXGA < 0.8)   fFor.push(`Defensa local muy sólida (xGA: ${fmt2(homeXGA)})`)
    if (awayXG < 1.0)    fFor.push(`Ataque visitante limitado (xG: ${fmt2(awayXG)})`)
    if (isKnockout)      fFor.push('Eliminatoria — defensa prioritaria')
    if (awayXG > 1.3)    fAg.push(`Visitante genera ${fmt2(awayXG)} xG/p — amenaza real`)

    add({
      id: 'cs_home', label: `${homeName} portería a cero`, category: 'porteria',
      prob: probCS, edgePct: e, analytic: false,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) },
      justParts: [
        `${homeName} mantuvo portería a cero en ${pctStr(probCS)} de ${N.toLocaleString()} simulaciones.`,
        `λ visitante ajustado: ${fmt2(lA)} · xG visitante: ${fmt2(awayXG)}.`,
        e != null ? `Edge vs mercado: ${e > 0 ? '+' : ''}${fmt1(e)}%.` : '',
      ],
    })
  }

  {
    const probCS = mcCS_away
    const e      = edge(probCS, oddsMap, 'clean_sheet_away')
    const fFor: string[] = [], fAg: string[] = []
    if (awayXGA < 0.8)   fFor.push(`Defensa visitante compacta (xGA: ${fmt2(awayXGA)})`)
    if (homeXG < 1.0)    fFor.push(`Ataque local moderado (xG: ${fmt2(homeXG)})`)
    if (homeXG > 1.3)    fAg.push(`${homeName} genera ${fmt2(homeXG)} xG en casa`)

    add({
      id: 'cs_away', label: `${awayName} portería a cero`, category: 'porteria',
      prob: probCS, edgePct: e, analytic: false,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) },
      justParts: [
        `${awayName} mantuvo portería a cero en ${pctStr(probCS)} de ${N.toLocaleString()} simulaciones.`,
        `λ local ajustado: ${fmt2(lH)} · xG local: ${fmt2(homeXG)}.`,
        e != null ? `Edge vs mercado: ${e > 0 ? '+' : ''}${fmt1(e)}%.` : '',
      ],
    })
  }

  // ─ CORNERS (analítico) ───────────────────────────────────────────────────

  for (const { k, id, label } of [
    { k: 8,  id: 'corners_8_5',  label: 'Más de 8.5 corners'  },
    { k: 9,  id: 'corners_9_5',  label: 'Más de 9.5 corners'  },
    { k: 10, id: 'corners_10_5', label: 'Más de 10.5 corners' },
  ]) {
    const prob = poissonOver(expCorners, k)
    add({
      id, label, category: 'corners',
      prob, edgePct: null, analytic: true,
      factors: {
        for: [`Media combinada: ${fmt1(homeCorners + awayCorners)} corners/p`, isBadW ? 'Lluvia aumenta corners' : ''].filter(Boolean),
        against: [expCorners < k + 1 ? 'Media muy cerca del umbral' : ''].filter(Boolean),
      },
      justParts: [
        `Media corners: ${fmt1(homeCorners + awayCorners)}/p. P(>${k}.5): ${Math.round(prob * 100)}% (analítico).`,
        `P80 goles MC: ${mce.p80Goals} — indica intensidad ofensiva del partido.`,
      ],
    })
  }

  // ─ TARJETAS (analítico) ──────────────────────────────────────────────────

  for (const { k, id, label } of [
    { k: 2, id: 'cards_2_5', label: 'Más de 2.5 amarillas' },
    { k: 3, id: 'cards_3_5', label: 'Más de 3.5 amarillas' },
    { k: 4, id: 'cards_4_5', label: 'Más de 4.5 amarillas' },
  ]) {
    const cardsF = isKnockout ? 1.05 : 1.0
    const prob   = poissonOver(expYellow * cardsF, k)
    add({
      id, label, category: 'tarjetas',
      prob, edgePct: null, analytic: true,
      factors: {
        for: [`Media: ${fmt1(expYellow)} amarillas/p`, isKnockout ? 'Eliminatoria — mayor tensión' : ''].filter(Boolean),
        against: [expYellow < k + 0.5 ? 'Media no garantiza superar el umbral' : ''].filter(Boolean),
      },
      justParts: [
        `Media amarillas: ${fmt1(expYellow)}/p${isKnockout ? ' (+5% eliminatoria)' : ''}. P(>${k}.5): ${Math.round(prob * 100)}%.`,
      ],
    })
  }

  // ─ DISPAROS (analítico) ──────────────────────────────────────────────────

  for (const { k, id, label } of [
    { k: 5, id: 'shots_ot_5_5', label: 'Más de 5.5 disparos a puerta' },
    { k: 7, id: 'shots_ot_7_5', label: 'Más de 7.5 disparos a puerta' },
  ]) {
    const prob = poissonOver(expShotsOT * (isBadW ? 0.96 : 1.0), k)
    add({
      id, label, category: 'disparos',
      prob, edgePct: null, analytic: true,
      factors: {
        for:     [`Media: ${fmt1(expShotsOT)} disparos/p`],
        against: [isBadW ? 'Condiciones adversas reducen precisión' : ''].filter(Boolean),
      },
      justParts: [`Media disparos a puerta: ${fmt1(expShotsOT)}/p. P(>${k}.5): ${Math.round(prob * 100)}%.`],
    })
  }

  // ── CAPA 8: Ranking por ventaja matemática ───────────────────────────────────
  // add() ya filtra prob < 0.05; no se necesita un segundo filtro
  const ranked = candidates
    .sort((a, b) => rankScore(b, consensus, hasOdds) - rankScore(a, consensus, hasOdds))

  // ── CAPA 9: Diversidad (máx 1 por familia) + top 5 ──────────────────────────
  const seen = new Set<string>()
  const top5: SmartBetRecommendation[] = []

  for (const c of ranked) {
    if (top5.length >= 5) break
    const fam = family(c.id)
    if (seen.has(fam)) continue
    seen.add(fam)

    const pct100 = Math.min(96, Math.max(0, Math.round(c.prob * 100)))
    top5.push({
      id:             c.id,
      label:          c.label,
      category:       c.category,
      rank:           top5.length + 1,
      confidence:     pct100,
      tier:           toTier(pct100),
      edge:           c.edgePct,
      mcFrequency:    Math.round(c.prob * 1000) / 10,
      consensusScore: consensus,
      volatility,
      mcEvidence:     mce,
      justification:  c.justParts.filter(Boolean).join(' '),
      factors:        c.factors,
    })
  }

  return top5
}
