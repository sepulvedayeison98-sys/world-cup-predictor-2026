/**
 * Smart Bets AI Engine v3 — Motor basado en forma reciente
 *
 * Arquitectura:
 *   Capa 1: Recolección y normalización de señales de forma (últimos 5-6 partidos)
 *   Capa 2: processTeamForm — pesos de recencia para calcular métricas ponderadas
 *   Capa 3: Score de consenso basado en calidad de datos
 *   Capa 4: Detector de volatilidad basado en desviación estándar de goles
 *   Capa 5: Motor de edge vs mercado
 *   Capa 6: Generador dinámico de candidatos (scorers por mercado)
 *   Capa 7: Ranking por confianza descendente
 *   Capa 8: Diversidad — máximo 1 por familia de mercado, top 5
 */

import { getMatchContext } from '@/lib/matchContext'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type SmartBetTier     = 'premium' | 'muy_fuerte' | 'fuerte' | 'moderada' | 'evitar'
export type SmartBetCategory = 'resultado' | 'goles' | 'porteria' | 'corners' | 'tarjetas' | 'disparos' | 'combinada'
export type VolatilityLevel  = 'LOW_VOLATILITY' | 'MEDIUM_VOLATILITY' | 'HIGH_VOLATILITY'

export interface MCEvidence {
  simulations:   number  // total de partidos recientes analizados (h.n + a.n)
  homeGoalsAvg:  number  // media ponderada de goles del local
  awayGoalsAvg:  number  // media ponderada de goles del visitante
  totalGoalsAvg: number  // goles combinados local + visitante
  stdDev:        number  // desviación estándar de goles del local
  topScore:      string  // resultado más frecuente del local en forma
  topScoreFreq:  number  // % de ocurrencia del resultado más frecuente
}

export interface SmartBetRecommendation {
  id:             string
  label:          string
  category:       SmartBetCategory
  rank:           number           // posición final 1-5
  confidence:     number           // probabilidad modelo × 100
  tier:           SmartBetTier
  edge:           number | null    // % ventaja vs mercado (null si sin cuotas)
  mcFrequency:    number           // frecuencia de forma ponderada (%)
  consensusScore: number           // 0-100 basado en calidad de datos
  volatility:     VolatilityLevel
  mcEvidence:     MCEvidence
  justification:  string
  factors:        { for: string[]; against: string[] }
}

export interface MatchFormEntry {
  kickoff_time:     string
  result:           'W' | 'D' | 'L'
  goals_scored:     number
  goals_conceded:   number
  is_clean_sheet:   boolean
  btts:             boolean
  over_2_5:         boolean
  over_1_5:         boolean
  opponent_name:    string
  xg:               number | null
  xga:              number | null
  shots:            number | null
  shots_on_target:  number | null
  corners:          number | null
  yellow_cards:     number | null
  red_cards:        number | null
  fouls:            number | null
  possession:       number | null
  big_chances:      number | null
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface TeamFormData {
  name:           string
  n:              number
  goalsScored:    number
  xg:             number
  shots:          number
  shotsOT:        number
  bigChances:     number
  corners:        number
  goalsConceded:  number
  xga:            number
  yellowCards:    number
  fouls:          number
  possession:     number
  winFreq:        number
  drawFreq:       number
  lossFreq:       number
  cleanSheetFreq: number
  bttsFreq:       number
  over15Freq:     number
  over25Freq:     number
  goalsStdDev:    number
  topResult:      string
  topResultFreq:  number
}

interface Candidate {
  id:            string
  label:         string
  category:      SmartBetCategory
  confidence:    number   // 0-100
  freq:          number   // frecuencia de forma ponderada (0-1)
  justification: string
  factors:       { for: string[]; against: string[] }
}

// ─── Pesos de recencia ────────────────────────────────────────────────────────

const WEIGHTS_5 = [0.35, 0.25, 0.18, 0.12, 0.10]
const WEIGHTS_6 = [0.30, 0.22, 0.18, 0.14, 0.10, 0.06]

function getWeights(n: number): number[] {
  if (n >= 6) return WEIGHTS_6
  if (n === 5) return WEIGHTS_5
  // Para n < 5: normalizar los primeros n pesos del set de 5
  const raw = WEIGHTS_5.slice(0, n)
  const sum  = raw.reduce((s, w) => s + w, 0)
  return raw.map(w => w / sum)
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function toTier(c: number): SmartBetTier {
  if (c >= 90) return 'premium'
  if (c >= 80) return 'muy_fuerte'
  if (c >= 70) return 'fuerte'
  if (c >= 60) return 'moderada'
  return 'evitar'
}

/** P(X > k) Poisson analítico */
function poissonOver(lambda: number, k: number): number {
  if (lambda <= 0) return 0
  let cum = 0, term = Math.exp(-lambda)
  for (let i = 0; i <= k; i++) { cum += term; term *= lambda / (i + 1) }
  return Math.max(0, Math.min(1, 1 - cum))
}

function fmt1(x: number): string { return x.toFixed(1) }
function fmt2(x: number): string { return x.toFixed(2) }

function calcStdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

// ─── Motor de edge vs mercado ─────────────────────────────────────────────────

// Grupos de mercados complementarios: si están todos presentes, se quita el
// margen de la casa normalizando para que sumen 1 (misma metodología que
// services/sync/odds.ts con Pinnacle). Así "edge" significa lo mismo en
// Smart Bets y en Value Bets: modelo vs probabilidad JUSTA.
const COMPLEMENT_GROUPS: string[][] = [
  ['home_win', 'draw', 'away_win'],
  ['btts_yes', 'btts_no'],
  ['over_0_5', 'under_0_5'],
  ['over_1_5', 'under_1_5'],
  ['over_2_5', 'under_2_5'],
  ['over_3_5', 'under_3_5'],
]
// Para mercados sin complemento registrado se asume el margen típico (~6%).
const TYPICAL_OVERROUND = 1.06

function buildOddsMap(odds: any[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const o of odds ?? []) {
    const impl = o.implied_probability as number
    if (!impl || impl <= 0 || impl >= 1) continue
    if (!map.has(o.market) || impl < (map.get(o.market) ?? 1)) {
      map.set(o.market, impl)
    }
  }

  // Devig: normalizar grupos completos, estimar margen en los sueltos
  const grouped = new Set<string>()
  for (const group of COMPLEMENT_GROUPS) {
    if (!group.every(m => map.has(m))) continue
    const sum = group.reduce((s, m) => s + map.get(m)!, 0)
    if (sum <= 0) continue
    for (const m of group) {
      map.set(m, map.get(m)! / sum)
      grouped.add(m)
    }
  }
  for (const [market, impl] of map) {
    if (!grouped.has(market)) map.set(market, impl / TYPICAL_OVERROUND)
  }

  return map
}

function calcEdge(modelProb: number, oddsMap: Map<string, number>, market: string): number | null {
  const implied = oddsMap.get(market)
  if (implied == null) return null
  return Math.round((modelProb - implied) * 1000) / 10
}

// ─── Deduplicación por familia ────────────────────────────────────────────────

function family(id: string): string {
  if (id.startsWith('over_'))     return 'over_goals'
  if (id.startsWith('under_'))    return 'under_goals'
  if (id.startsWith('corners_'))  return 'corners'
  if (id.startsWith('cards_'))    return 'cards'
  if (id.startsWith('shots_ot_')) return 'shots_ot'
  if (id.startsWith('cs_'))       return 'clean_sheet'
  if (id.startsWith('dc_'))       return 'double_chance'
  if (id.startsWith('btts_'))     return 'btts'
  return id
}

// ─── processTeamForm ──────────────────────────────────────────────────────────

/**
 * Procesa las entradas de forma del equipo con pesos de recencia.
 * Si n === 0, usa fallbackStats de team_statistics.
 */
function processTeamForm(
  entries: MatchFormEntry[],
  fallbackStats: any,
  teamName: string,
): TeamFormData {
  // Tomar máximo 6 partidos, ordenados del más reciente al más antiguo
  const recent = entries.slice(0, 6)
  const n      = recent.length

  if (n === 0) {
    // Fallback completo a estadísticas de BD
    const gs  = fallbackStats?.avg_goals_scored   ?? 1.2
    const gc  = fallbackStats?.avg_goals_conceded ?? 1.0
    const xg  = fallbackStats?.avg_xg             ?? gs * 0.9
    const xga = fallbackStats?.avg_xga            ?? gc * 0.9
    return {
      name:           teamName,
      n:              0,
      goalsScored:    gs,
      xg,
      shots:          fallbackStats?.avg_shots ?? 10,
      shotsOT:        fallbackStats?.avg_shots_on_target ?? 3.5,
      bigChances:     2,
      corners:        fallbackStats?.avg_corners ?? 4.5,
      goalsConceded:  gc,
      xga,
      yellowCards:    fallbackStats?.avg_yellow_cards ?? 1.8,
      fouls:          14,
      possession:     50,
      winFreq:        0.45,
      drawFreq:       0.25,
      lossFreq:       0.30,
      cleanSheetFreq: 0.30,
      bttsFreq:       0.50,
      over15Freq:     0.65,
      over25Freq:     0.45,
      goalsStdDev:    0.9,
      topResult:      'V',
      topResultFreq:  45,
    }
  }

  const weights = getWeights(n)

  // Promedios ponderados de valores numéricos
  function wavg(vals: (number | null)[], fallback: number): number {
    let wSum = 0, total = 0
    for (let i = 0; i < n; i++) {
      const v = vals[i]
      if (v != null && !isNaN(v)) { total += v * weights[i]; wSum += weights[i] }
    }
    return wSum > 0 ? total / wSum : fallback
  }

  // Frecuencias ponderadas (binario: sí/no)
  function wfreq(flags: boolean[]): number {
    let total = 0
    for (let i = 0; i < n; i++) total += (flags[i] ? 1 : 0) * weights[i]
    return total  // ya normalizado porque sum(weights) ~ 1
  }

  const goalsScoredArr = recent.map(e => e.goals_scored)
  const xgArr          = recent.map(e => e.xg)
  const shotsArr       = recent.map(e => e.shots)
  const shotsOTArr     = recent.map(e => e.shots_on_target)
  const bigChancesArr  = recent.map(e => e.big_chances)
  const cornersArr     = recent.map(e => e.corners)
  const goalsConcArr   = recent.map(e => e.goals_conceded)
  const xgaArr         = recent.map(e => e.xga)
  const yellowArr      = recent.map(e => e.yellow_cards)
  const foulsArr       = recent.map(e => e.fouls)
  const possArr        = recent.map(e => e.possession)

  const goalsScored   = wavg(goalsScoredArr, 1.2)
  const goalsConceded = wavg(goalsConcArr, 1.0)

  // xG: usar datos de forma primero, fallback a stats, luego estimación
  const hasXg = xgArr.some(v => v != null)
  let xg: number
  if (hasXg) {
    xg = wavg(xgArr, goalsScored * 0.9)
  } else if (fallbackStats?.avg_xg != null) {
    xg = fallbackStats.avg_xg
  } else {
    xg = goalsScored * 0.9
  }

  // xGA
  const hasXga = xgaArr.some(v => v != null)
  let xga: number
  if (hasXga) {
    xga = wavg(xgaArr, goalsConceded * 0.9)
  } else if (fallbackStats?.avg_xga != null) {
    xga = fallbackStats.avg_xga
  } else {
    xga = goalsConceded * 0.9
  }

  // Corners: fallback a stats si todos nulos
  const hasCorners = cornersArr.some(v => v != null)
  const corners    = hasCorners
    ? wavg(cornersArr, fallbackStats?.avg_corners ?? 4.5)
    : (fallbackStats?.avg_corners ?? 4.5)

  const shots       = wavg(shotsArr, fallbackStats?.avg_shots ?? 10)
  const shotsOT     = wavg(shotsOTArr, fallbackStats?.avg_shots_on_target ?? 3.5)
  const bigChances  = wavg(bigChancesArr, 2)
  const yellowCards = wavg(yellowArr, fallbackStats?.avg_yellow_cards ?? 1.8)
  const fouls       = wavg(foulsArr, 14)
  const possession  = wavg(possArr, 50)

  // Frecuencias ponderadas de resultado
  const winFreq        = wfreq(recent.map(e => e.result === 'W'))
  const drawFreq       = wfreq(recent.map(e => e.result === 'D'))
  const lossFreq       = wfreq(recent.map(e => e.result === 'L'))
  const cleanSheetFreq = wfreq(recent.map(e => e.is_clean_sheet))
  const bttsFreq       = wfreq(recent.map(e => e.btts))
  const over15Freq     = wfreq(recent.map(e => e.over_1_5))
  const over25Freq     = wfreq(recent.map(e => e.over_2_5))

  // Resultado más frecuente (mayor peso acumulado)
  const resultBuckets: Record<string, number> = { W: 0, D: 0, L: 0 }
  for (let i = 0; i < n; i++) resultBuckets[recent[i].result] += weights[i]
  const topResult     = Object.entries(resultBuckets).sort((x, y) => y[1] - x[1])[0][0]
  const topResultFreq = Math.round(resultBuckets[topResult] * 100)

  // Desviación estándar de goles anotados
  const goalsStdDev = calcStdDev(goalsScoredArr)

  return {
    name: teamName, n,
    goalsScored, xg, shots, shotsOT, bigChances, corners,
    goalsConceded, xga, yellowCards, fouls, possession,
    winFreq, drawFreq, lossFreq,
    cleanSheetFreq, bttsFreq, over15Freq, over25Freq,
    goalsStdDev, topResult, topResultFreq,
  }
}

// ─── Motor de coherencia matemática ──────────────────────────────────────────

/**
 * Después de puntuar todos los candidatos, garantiza que los mercados
 * derivados de 1X2 (resultado + doble oportunidad) no se desvíen más de
 * MAX_DEV puntos porcentuales de la probabilidad matemática del modelo.
 * Esto evita que mezclas de forma contradigan la predicción base.
 */
function enforceCoherence(candidates: Candidate[], hw: number, dr: number, aw: number): Candidate[] {
  const modelTarget: Partial<Record<string, number>> = {
    home_win: Math.round(hw * 100),
    draw:     Math.round(dr * 100),
    away_win: Math.round(aw * 100),
    dc_1x:   Math.round((hw + dr) * 100),
    dc_x2:   Math.round((dr + aw) * 100),
  }
  const MAX_DEV = 9
  return candidates.map(c => {
    const target = modelTarget[c.id]
    if (target == null) return c
    if (c.confidence > target + MAX_DEV) c.confidence = target + MAX_DEV
    if (c.confidence < Math.max(5, target - MAX_DEV)) c.confidence = Math.max(5, target - MAX_DEV)
    return c
  })
}

/**
 * home_win y dc_x2 son complementos (suman ~100%).
 * away_win y dc_1x también.
 * Si dos complementos aparecen juntos con suma > 112%, uno es contradictorio.
 */
function isContradiction(candidateId: string, candidateConf: number, existing: SmartBetRecommendation[]): boolean {
  const COMPLEMENTS: [string, string][] = [
    ['home_win', 'dc_x2'],
    ['away_win', 'dc_1x'],
  ]
  for (const [a, b] of COMPLEMENTS) {
    const paired = candidateId === a ? b : candidateId === b ? a : null
    if (!paired) continue
    const existingRec = existing.find(r => r.id === paired)
    if (existingRec && existingRec.confidence + candidateConf > 112) return true
  }
  return false
}

// ─── Market scorers ───────────────────────────────────────────────────────────

/**
 * Over goals: over_1_5, over_2_5, over_3_5
 * Usa probabilidad Poisson analítica como señal principal (bounded), blendada con frecuencia de forma.
 */
function scoreOver(
  h: TeamFormData,
  a: TeamFormData,
  goals: number,
  marketId: string,
  label: string,
): Candidate {
  // Goles esperados combinados
  const expected = (h.goalsScored + a.goalsConceded + a.goalsScored + h.goalsConceded) / 2

  // Frecuencia base en over_2_5, ajustada para otras líneas
  let adjustedFreq = (h.over25Freq + a.over25Freq) / 2
  if (goals <= 1.5)       adjustedFreq = Math.min(0.98, adjustedFreq + 0.20)
  else if (goals >= 3.5)  adjustedFreq = Math.max(0.01, adjustedFreq - 0.20)

  // Probabilidad Poisson analítica: P(goles totales > k)
  const poissonProb = poissonOver(expected, Math.floor(goals))

  // Bonus si hay datos reales de forma
  const dataBonus = (h.n >= 3 && a.n >= 3) ? 3 : 0

  // Confianza: blend Poisson (60%) + frecuencia de forma (35%) + tiros a puerta (5%)
  const blended = poissonProb * 0.60 + adjustedFreq * 0.35 + Math.min(1, h.shotsOT / 12) * 0.05
  const confidence = Math.min(92, Math.round(blended * 100) + dataBonus)

  const fFor: string[] = []
  const fAg: string[]  = []

  if (h.goalsScored > 1.5)
    fFor.push(`${h.name} marcó ${fmt1(h.goalsScored)} goles por partido en sus últimos ${h.n || 5} partidos`)
  if (a.goalsScored > 1.2)
    fFor.push(`${a.name} marcó ${fmt1(a.goalsScored)} goles por partido en sus últimos ${a.n || 5} partidos`)
  if (adjustedFreq >= 0.60)
    fFor.push(`El Over ${goals} ocurrió en el ${Math.round(adjustedFreq * 100)}% de los partidos recientes combinados`)
  if (expected > goals + 0.5)
    fFor.push(`Goles esperados combinados: ${fmt1(expected)} — supera el umbral`)
  if (h.shotsOT > 4.5)
    fFor.push(`${h.name} genera ${fmt1(h.shotsOT)} disparos a puerta por partido`)
  if (goals > 2 && expected < goals + 0.3)
    fAg.push(`Goles esperados (${fmt1(expected)}) muy ajustados al umbral ${goals}`)
  if (h.goalsConceded < 0.7 || a.goalsConceded < 0.7)
    fAg.push('Una de las defensas es muy sólida — puede limitar los goles')

  return {
    id: marketId, label, category: 'goles',
    confidence, freq: adjustedFreq,
    justification: [
      `${h.name} marcó ${fmt1(h.goalsScored)} goles/p · ${a.name} marcó ${fmt1(a.goalsScored)} goles/p en forma reciente.`,
      `Goles esperados combinados: ${fmt1(expected)}. P(>${goals}): ${Math.round(poissonProb * 100)}% (Poisson).`,
      `Over ${goals} registrado en el ${Math.round(adjustedFreq * 100)}% de partidos recientes.`,
      `${h.name} concede ${fmt1(h.goalsConceded)}/p · ${a.name} concede ${fmt1(a.goalsConceded)}/p.`,
    ].join(' '),
    factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) },
  }
}

/**
 * Ambos marcan (BTTS)
 */
function scoreBtts(h: TeamFormData, a: TeamFormData, isYes: boolean): Candidate {
  const freq         = (h.bttsFreq + a.bttsFreq) / 2
  const adjustedFreq = isYes ? freq : 1 - freq

  let confidence: number
  const fFor: string[] = []
  const fAg: string[]  = []

  if (isYes) {
    const scoringSignal   = Math.min(1, (h.goalsScored / 1.5 + a.goalsScored / 1.5) / 2)
    const defenseWeakness = Math.min(1, (h.goalsConceded / 1.2 + a.goalsConceded / 1.2) / 2)
    const raw = adjustedFreq * 55 + scoringSignal * 25 + defenseWeakness * 15 + (h.n >= 3 && a.n >= 3 ? 5 : 0)
    confidence = Math.min(90, Math.round(raw))

    if (h.goalsScored > 1.2)
      fFor.push(`${h.name} marcó ${fmt1(h.goalsScored)} goles por partido en forma reciente`)
    if (a.goalsScored > 1.0)
      fFor.push(`${a.name} marcó ${fmt1(a.goalsScored)} goles por partido en forma reciente`)
    if (freq >= 0.55)
      fFor.push(`Ambos marcaron en el ${Math.round(freq * 100)}% de los partidos combinados recientes`)
    if (h.goalsConceded < 0.7)
      fAg.push(`${h.name} es muy sólido defensivamente (${fmt1(h.goalsConceded)} goles concedidos/p)`)
    if (a.goalsScored < 0.8)
      fAg.push(`${a.name} genera poco en ataque (${fmt1(a.goalsScored)} goles/p)`)
  } else {
    const csSignal    = Math.min(1, (h.cleanSheetFreq + a.cleanSheetFreq) / 2)
    const defStrength = Math.min(1, Math.max(0, 1 - (h.goalsConceded + a.goalsConceded) / 4))
    const raw = adjustedFreq * 55 + csSignal * 25 + defStrength * 15 + (h.n >= 3 && a.n >= 3 ? 5 : 0)
    confidence = Math.min(90, Math.round(raw))

    const csFreqCombined = (h.cleanSheetFreq + a.cleanSheetFreq) / 2
    if (csFreqCombined >= 0.30)
      fFor.push(`Las defensas mantienen portería a cero en el ${Math.round(csFreqCombined * 100)}% de sus partidos`)
    if (h.goalsConceded < 0.9)
      fFor.push(`${h.name} concede solo ${fmt1(h.goalsConceded)} goles por partido`)
    if (a.goalsConceded < 0.9)
      fFor.push(`${a.name} concede solo ${fmt1(a.goalsConceded)} goles por partido`)
    if (freq >= 0.55)
      fAg.push(`Ambos marcaron en el ${Math.round(freq * 100)}% de sus partidos recientes`)
    if (h.goalsScored > 1.5 && a.goalsScored > 1.3)
      fAg.push('Ambos equipos tienen buen poder ofensivo')
  }

  const idStr  = isYes ? 'btts_yes' : 'btts_no'
  const lblStr = isYes ? 'Ambos equipos marcan' : 'No marcan los dos'

  return {
    id: idStr, label: lblStr, category: 'goles',
    confidence, freq: adjustedFreq,
    justification: isYes
      ? `${h.name} marcó en ${Math.round(h.bttsFreq * 100)}% · ${a.name} en ${Math.round(a.bttsFreq * 100)}% de sus partidos recientes. BTTS ocurrió en ${Math.round(freq * 100)}% de los partidos combinados.`
      : `${h.name} portería a cero en ${Math.round(h.cleanSheetFreq * 100)}% · ${a.name} en ${Math.round(a.cleanSheetFreq * 100)}% de sus partidos recientes. No-BTTS: ${Math.round(adjustedFreq * 100)}% combinado.`,
    factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) },
  }
}

/**
 * Portería a cero
 * homeTeamCS = true → puntuar portería a cero del equipo local; false → visitante
 */
function scoreCleanSheet(h: TeamFormData, a: TeamFormData, homeTeamCS: boolean): Candidate {
  const defTeam = homeTeamCS ? h : a
  const attTeam = homeTeamCS ? a : h
  const teamId  = homeTeamCS ? 'cs_home' : 'cs_away'
  const teamLbl = homeTeamCS ? `${h.name} portería a cero` : `${a.name} portería a cero`

  const csBase   = defTeam.cleanSheetFreq
  const attPower = Math.min(1, attTeam.goalsScored / 2.0)
  const defStr   = Math.max(0, 1 - defTeam.goalsConceded / 1.5)

  const raw = csBase * 55 + defStr * 25 + (1 - attPower) * 15 + (defTeam.n >= 3 ? 5 : 0)
  const confidence = Math.min(88, Math.round(raw))

  const fFor: string[] = []
  const fAg: string[]  = []

  if (csBase >= 0.35)
    fFor.push(`${defTeam.name} mantiene portería a cero en el ${Math.round(csBase * 100)}% de sus últimos partidos`)
  if (defTeam.goalsConceded < 0.9)
    fFor.push(`${defTeam.name} concede solo ${fmt1(defTeam.goalsConceded)} goles por partido`)
  if (attTeam.goalsScored > 1.5)
    fAg.push(`${attTeam.name} marcó ${fmt1(attTeam.goalsScored)} goles/p — amenaza real`)
  if (attTeam.xg > 1.3)
    fAg.push(`${attTeam.name} genera ${fmt2(attTeam.xg)} xG por partido`)

  return {
    id: teamId, label: teamLbl, category: 'porteria',
    confidence, freq: csBase,
    justification: `${defTeam.name} mantiene portería a cero en el ${Math.round(csBase * 100)}% de sus últimos ${defTeam.n || 5} partidos. Concede ${fmt1(defTeam.goalsConceded)} goles/p. ${attTeam.name} anota ${fmt1(attTeam.goalsScored)} goles/p.`,
    factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) },
  }
}

/**
 * Corners — solo si hay datos reales de forma
 */
function scoreCorners(
  h: TeamFormData,
  a: TeamFormData,
  line: number,
  marketId: string,
): Candidate | null {
  if (h.corners <= 0 && a.corners <= 0) return null

  const totalCorners = h.corners + a.corners
  const probOver     = poissonOver(totalCorners, Math.floor(line))
  const confidence   = Math.min(88, Math.round(probOver * 100))

  return {
    id: marketId, label: `Más de ${line} corners`, category: 'corners',
    confidence, freq: probOver,
    justification: `${h.name} promedió ${fmt1(h.corners)} corners/p · ${a.name} promedió ${fmt1(a.corners)} corners/p en forma reciente. Total esperado: ${fmt1(totalCorners)}. P(>${line}): ${Math.round(probOver * 100)}%.`,
    factors: {
      for:     [`Media combinada de corners: ${fmt1(totalCorners)}/p`],
      against: [totalCorners < line + 0.5 ? `Media muy ajustada al umbral ${line}` : ''].filter(Boolean),
    },
  }
}

/**
 * Tarjetas amarillas
 */
function scoreCards(
  h: TeamFormData,
  a: TeamFormData,
  line: number,
  marketId: string,
  isKnockout: boolean,
): Candidate | null {
  // Sin datos reales de forma, el fallback (1.8+1.7=3.5) produce el mismo score
  // para todos los partidos — no aporta valor diferencial
  if (h.n === 0 && a.n === 0) return null
  const totalCards = h.yellowCards + a.yellowCards + (isKnockout ? 0.6 : 0)
  const probOver   = poissonOver(totalCards, Math.floor(line))
  const confidence = Math.min(88, Math.round(probOver * 100))

  return {
    id: marketId, label: `Más de ${line} amarillas`, category: 'tarjetas',
    confidence, freq: probOver,
    justification: `${h.name} recibió ${fmt1(h.yellowCards)} amarillas/p · ${a.name} ${fmt1(a.yellowCards)} amarillas/p en forma reciente.${isKnockout ? ' Eliminatoria (+0.6 ajuste tensión).' : ''} Total esperado: ${fmt1(totalCards)}. P(>${line}): ${Math.round(probOver * 100)}%.`,
    factors: {
      for:     [`Media combinada: ${fmt1(totalCards)} amarillas/p`, isKnockout ? 'Eliminatoria — mayor tensión' : ''].filter(Boolean),
      against: [totalCards < line + 0.5 ? 'Media muy ajustada al umbral' : ''].filter(Boolean),
    },
  }
}

/**
 * Resultado 1X2
 */
function scoreResult(
  h: TeamFormData,
  a: TeamFormData,
  prediction: any,
  market: 'home_win' | 'draw' | 'away_win',
): Candidate {
  const modelProb =
    market === 'home_win' ? (prediction.home_win_probability ?? 0.33) :
    market === 'draw'     ? (prediction.draw_probability     ?? 0.33) :
                            (prediction.away_win_probability ?? 0.33)

  const formFreq =
    market === 'home_win' ? h.winFreq  :
    market === 'draw'     ? (h.drawFreq + a.drawFreq) / 2 :
                            a.winFreq

  // Modelo es señal primaria (80-100%); forma solo afina cuando hay datos reales
  const formW    = h.n >= 3 && a.n >= 3 ? 0.20 : h.n >= 1 || a.n >= 1 ? 0.10 : 0.0
  const blended  = modelProb * (1 - formW) + formFreq * formW
  const confidence = Math.round(Math.min(92, blended * 100))

  const fFor: string[] = []
  const fAg: string[]  = []

  if (market === 'home_win') {
    if (h.winFreq >= 0.55)
      fFor.push(`${h.name} ganó el ${Math.round(h.winFreq * 100)}% de sus últimos ${h.n || 5} partidos`)
    if (h.goalsScored > 1.5)
      fFor.push(`${h.name} marcó ${fmt1(h.goalsScored)} goles por partido en forma reciente`)
    if (a.goalsConceded > 1.2)
      fFor.push(`${a.name} concede ${fmt1(a.goalsConceded)} goles por partido`)
    if (h.lossFreq > 0.3)
      fAg.push(`${h.name} perdió el ${Math.round(h.lossFreq * 100)}% de sus partidos recientes`)
    if (a.winFreq >= 0.50)
      fAg.push(`${a.name} también llega en buena forma (${Math.round(a.winFreq * 100)}% victorias)`)
    return {
      id: 'home_win', label: `${h.name} gana`, category: 'resultado',
      confidence, freq: formFreq,
      justification: `${h.name} ganó el ${Math.round(h.winFreq * 100)}% de sus últimos ${h.n || 5} partidos. Modelo asigna ${Math.round(modelProb * 100)}% de probabilidad. Blend forma+modelo: ${confidence}%.`,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) },
    }
  }

  if (market === 'draw') {
    const avgFormDraw = (h.drawFreq + a.drawFreq) / 2
    if (avgFormDraw >= 0.25)
      fFor.push(`Empate ocurrió en ${Math.round(avgFormDraw * 100)}% de los partidos combinados`)
    if (Math.abs(h.goalsScored - a.goalsScored) < 0.3)
      fFor.push(`Ataque equilibrado: ${h.name} ${fmt1(h.goalsScored)} goles/p · ${a.name} ${fmt1(a.goalsScored)} goles/p`)
    if (h.winFreq > 0.55)
      fAg.push(`${h.name} gana con frecuencia (${Math.round(h.winFreq * 100)}%)`)
    if (a.winFreq > 0.55)
      fAg.push(`${a.name} también gana con frecuencia (${Math.round(a.winFreq * 100)}%)`)
    return {
      id: 'draw', label: 'Empate', category: 'resultado',
      confidence, freq: formFreq,
      justification: `Empate registrado en ${Math.round(h.drawFreq * 100)}% de partidos de ${h.name} y ${Math.round(a.drawFreq * 100)}% de ${a.name} en forma reciente. Modelo: ${Math.round(modelProb * 100)}%. Blend: ${confidence}%.`,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) },
    }
  }

  // away_win
  if (a.winFreq >= 0.55)
    fFor.push(`${a.name} ganó el ${Math.round(a.winFreq * 100)}% de sus últimos ${a.n || 5} partidos`)
  if (a.goalsScored > 1.5)
    fFor.push(`${a.name} marcó ${fmt1(a.goalsScored)} goles por partido en forma reciente`)
  if (h.goalsConceded > 1.2)
    fFor.push(`${h.name} concede ${fmt1(h.goalsConceded)} goles por partido`)
  if (a.lossFreq > 0.3)
    fAg.push(`${a.name} perdió el ${Math.round(a.lossFreq * 100)}% de sus partidos recientes`)
  if (h.winFreq >= 0.55)
    fAg.push(`${h.name} gana en casa con frecuencia (${Math.round(h.winFreq * 100)}%)`)
  return {
    id: 'away_win', label: `${a.name} gana`, category: 'resultado',
    confidence, freq: formFreq,
    justification: `${a.name} ganó el ${Math.round(a.winFreq * 100)}% de sus últimos ${a.n || 5} partidos. Modelo asigna ${Math.round(modelProb * 100)}% de probabilidad. Blend forma+modelo: ${confidence}%.`,
    factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) },
  }
}

/**
 * Doble oportunidad
 */
function scoreDoubleChance(
  h: TeamFormData,
  a: TeamFormData,
  prediction: any,
  market: 'dc_1x' | 'dc_x2',
): Candidate {
  const homeWin = prediction.home_win_probability ?? 0.33
  const draw    = prediction.draw_probability     ?? 0.33
  const awayWin = prediction.away_win_probability ?? 0.33

  if (market === 'dc_1x') {
    const modelProb   = homeWin + draw
    const formNotLoss = 1 - a.winFreq
    // Modelo ancla la confianza; la forma ajusta ≤12% cuando hay datos reales
    const formW       = h.n >= 3 && a.n >= 3 ? 0.12 : 0.0
    const blended     = modelProb * (1 - formW) + formNotLoss * formW
    const confidence  = Math.round(Math.min(96, blended * 100))

    return {
      id: 'dc_1x', label: `${h.name} o empate (1X)`, category: 'resultado',
      confidence, freq: formNotLoss,
      justification: `Cubre victoria local (${Math.round(homeWin * 100)}%) + empate (${Math.round(draw * 100)}%) = ${Math.round(modelProb * 100)}% del modelo. ${h.name} no perdió en el ${Math.round(formNotLoss * 100)}% de sus partidos recientes.`,
      factors: {
        for: [
          `Cubre ${Math.round(modelProb * 100)}% de los escenarios del modelo`,
          h.n > 0 ? `${h.name} no perdió en ${Math.round(formNotLoss * 100)}% de sus partidos` : '',
        ].filter(Boolean),
        against: [awayWin > 0.38 ? `${a.name} gana en el ${Math.round(awayWin * 100)}% del modelo` : ''].filter(Boolean),
      },
    }
  }

  // dc_x2
  const modelProb   = draw + awayWin
  const formNotLoss = 1 - h.winFreq
  const formW       = h.n >= 3 && a.n >= 3 ? 0.12 : 0.0
  const blended     = modelProb * (1 - formW) + formNotLoss * formW
  const confidence  = Math.round(Math.min(96, blended * 100))

  return {
    id: 'dc_x2', label: `${a.name} o empate (X2)`, category: 'resultado',
    confidence, freq: formNotLoss,
    justification: `Cubre empate (${Math.round(draw * 100)}%) + victoria visitante (${Math.round(awayWin * 100)}%) = ${Math.round(modelProb * 100)}% del modelo. ${a.name} no perdió en el ${Math.round(formNotLoss * 100)}% de sus partidos recientes.`,
    factors: {
      for: [
        `Cubre ${Math.round(modelProb * 100)}% de los escenarios del modelo`,
        a.n > 0 ? `${a.name} no perdió en ${Math.round(formNotLoss * 100)}% de sus partidos` : '',
      ].filter(Boolean),
      against: [homeWin > 0.38 ? `${h.name} gana en el ${Math.round(homeWin * 100)}% del modelo` : ''].filter(Boolean),
    },
  }
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Genera las 5 mejores oportunidades de apuesta para el partido,
 * basadas en la forma reciente de los últimos 5-6 partidos con pesos de recencia.
 */
export function computeSmartBets(
  prediction:         any,
  homeStats:          any,
  awayStats:          any,
  homeTeam:           any,
  awayTeam:           any,
  injuries:           any[],
  match?:             any,
  odds?:              any[],
  homeRecentMatches?: MatchFormEntry[],
  awayRecentMatches?: MatchFormEntry[],
): SmartBetRecommendation[] {
  if (!prediction) return []

  const homeName = homeTeam?.short_name ?? homeTeam?.name ?? 'Local'
  const awayName = awayTeam?.short_name ?? awayTeam?.name ?? 'Visitante'

  // Sin partidos registrados de alguno de los dos equipos no hay base real
  // para recomendar: mejor no generar picks que generarlos sobre un perfil
  // inventado (el panel muestra "datos insuficientes").
  const hasHomeData = (homeRecentMatches?.length ?? 0) > 0 || homeStats?.avg_goals_scored != null
  const hasAwayData = (awayRecentMatches?.length ?? 0) > 0 || awayStats?.avg_goals_scored != null
  if (!hasHomeData || !hasAwayData) return []

  // ── Capa 1: Procesar forma reciente ──────────────────────────────────────────
  const h = processTeamForm(homeRecentMatches ?? [], homeStats, homeName)
  const a = processTeamForm(awayRecentMatches ?? [], awayStats, awayName)

  // ── Contexto de partido ───────────────────────────────────────────────────────
  const ctx = getMatchContext(match)
  const { isKnockout, goalMult, cornersF, homeRestF, awayRestF } = ctx

  // ── C2: Penalización de lesiones por equipo ───────────────────────────────────
  const homeInjuryImpact = (injuries ?? [])
    .filter((i: any) => i.team_id === homeTeam?.id)
    .reduce((sum: number, i: any) => sum + (i.impact_score ?? 0), 0)
  const awayInjuryImpact = (injuries ?? [])
    .filter((i: any) => i.team_id === awayTeam?.id)
    .reduce((sum: number, i: any) => sum + (i.impact_score ?? 0), 0)
  const homePenalty = Math.min(0.20, homeInjuryImpact / 100)
  const awayPenalty = Math.min(0.20, awayInjuryImpact / 100)

  // ── C3: Aplicar contexto + lesiones a métricas de forma ─────────────────────
  const hMult = goalMult * homeRestF * (1 - homePenalty)
  const aMult = goalMult * awayRestF * (1 - awayPenalty)
  h.goalsScored    *= hMult
  h.xg             *= hMult
  h.shotsOT        *= hMult
  h.bigChances     *= hMult
  h.corners        *= cornersF
  h.goalsConceded  *= goalMult
  a.goalsScored    *= aMult
  a.xg             *= aMult
  a.shotsOT        *= aMult
  a.bigChances     *= aMult
  a.corners        *= cornersF
  a.goalsConceded  *= goalMult

  // ── Capa 3: Consenso basado en calidad de datos ──────────────────────────────
  const dataPoints        = h.n + a.n
  const confScore         = prediction.confidence_score ?? 60
  const consensusScoreVal = Math.round(Math.min(100, (dataPoints / 12) * 50 + confScore * 0.5))

  // ── Capa 4: Volatilidad ───────────────────────────────────────────────────────
  const avgStd = (h.goalsStdDev + a.goalsStdDev) / 2
  const minN   = Math.min(h.n, a.n)
  let volatility: VolatilityLevel
  if (avgStd < 0.8 && minN >= 4)      volatility = 'LOW_VOLATILITY'
  else if (avgStd > 1.5 || minN < 2)  volatility = 'HIGH_VOLATILITY'
  else                                 volatility = 'MEDIUM_VOLATILITY'

  // ── Evidencia de forma ────────────────────────────────────────────────────────
  const mce: MCEvidence = {
    simulations:   h.n + a.n,
    homeGoalsAvg:  Math.round(h.goalsScored * 10) / 10,
    awayGoalsAvg:  Math.round(a.goalsScored * 10) / 10,
    totalGoalsAvg: Math.round((h.goalsScored + a.goalsScored) * 10) / 10,
    stdDev:        Math.round(h.goalsStdDev * 100) / 100,
    topScore:      h.topResult,
    topScoreFreq:  h.topResultFreq,
  }

  // ── Capa 5: Odds ──────────────────────────────────────────────────────────────
  const oddsMap = buildOddsMap(odds ?? [])

  // ── Capa 6: Candidatos ────────────────────────────────────────────────────────
  const candidates: Candidate[] = []

  function add(c: Candidate | null) {
    if (c && c.confidence >= 55) candidates.push(c)
  }

  // Resultado 1X2
  add(scoreResult(h, a, prediction, 'home_win'))
  add(scoreResult(h, a, prediction, 'draw'))
  add(scoreResult(h, a, prediction, 'away_win'))

  // Doble oportunidad — solo si el resultado complementario tiene probabilidad real (≥12%)
  // Evita mostrar apuestas trivialmente ciertas (ej: dc_1x cuando P(away)=5%)
  const homeWin = prediction.home_win_probability ?? 0.33
  const draw    = prediction.draw_probability     ?? 0.33
  const awayWin = prediction.away_win_probability ?? 0.33
  if ((homeWin >= 0.28 || draw >= 0.25) && awayWin >= 0.12) add(scoreDoubleChance(h, a, prediction, 'dc_1x'))
  if ((awayWin >= 0.28 || draw >= 0.25) && homeWin >= 0.12) add(scoreDoubleChance(h, a, prediction, 'dc_x2'))

  // Goles
  add(scoreOver(h, a, 1.5, 'over_1_5', 'Más de 1.5 goles'))
  add(scoreOver(h, a, 2.5, 'over_2_5', 'Más de 2.5 goles'))
  add(scoreOver(h, a, 3.5, 'over_3_5', 'Más de 3.5 goles'))

  // BTTS
  add(scoreBtts(h, a, true))
  add(scoreBtts(h, a, false))

  // Portería a cero
  add(scoreCleanSheet(h, a, true))
  add(scoreCleanSheet(h, a, false))

  // Corners (solo si hay datos)
  for (const { line, id } of [
    { line: 8.5,  id: 'corners_8_5'  },
    { line: 9.5,  id: 'corners_9_5'  },
    { line: 10.5, id: 'corners_10_5' },
  ]) {
    add(scoreCorners(h, a, line, id))
  }

  // Tarjetas
  for (const { line, id } of [
    { line: 2.5, id: 'cards_2_5' },
    { line: 3.5, id: 'cards_3_5' },
    { line: 4.5, id: 'cards_4_5' },
  ]) {
    add(scoreCards(h, a, line, id, isKnockout))
  }

  // ── Capa 6.5: Coherencia matemática — anclar 1X2-derivados al modelo ─────────
  const coherentCandidates = enforceCoherence(candidates, homeWin, draw, awayWin)

  // ── Capa 7: Ranking por confianza descendente ────────────────────────────────
  const ranked = [...coherentCandidates].sort((x, y) => y.confidence - x.confidence)

  // Mapa de market IDs para edge vs cuotas
  const marketOddsId: Record<string, string> = {
    home_win: 'home_win', draw: 'draw', away_win: 'away_win',
    dc_1x: 'dc_1x', dc_x2: 'dc_x2',
    over_1_5: 'over_1_5', over_2_5: 'over_2_5', over_3_5: 'over_3_5',
    btts_yes: 'btts_yes', btts_no: 'btts_no',
    cs_home: 'clean_sheet_home', cs_away: 'clean_sheet_away',
    corners_8_5: 'corners_8_5', corners_9_5: 'corners_9_5', corners_10_5: 'corners_10_5',
    cards_2_5: 'cards_2_5', cards_3_5: 'cards_3_5', cards_4_5: 'cards_4_5',
  }

  // ── Capa 8: Deduplicar por familia + validar coherencia + top 5 ─────────────
  const seen = new Set<string>()
  const top5: SmartBetRecommendation[] = []

  for (const c of ranked) {
    if (top5.length >= 5) break
    const fam = family(c.id)
    if (seen.has(fam)) continue
    // Descartar si contradice matemáticamente a un candidato ya seleccionado
    if (isContradiction(c.id, c.confidence, top5)) continue
    seen.add(fam)

    const edgeVal = calcEdge(c.confidence / 100, oddsMap, marketOddsId[c.id] ?? c.id)

    top5.push({
      id:             c.id,
      label:          c.label,
      category:       c.category,
      rank:           top5.length + 1,
      confidence:     c.confidence,
      tier:           toTier(c.confidence),
      edge:           edgeVal,
      mcFrequency:    Math.round(c.freq * 1000) / 10,
      consensusScore: consensusScoreVal,
      volatility,
      mcEvidence:     mce,
      justification:  c.justification,
      factors:        c.factors,
    })
  }

  return top5
}
