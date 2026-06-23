/**
 * Smart Bets AI Engine — evalúa todos los mercados posibles y devuelve las
 * recomendaciones ordenadas por confianza. Sin dependencia de cuotas ni casas.
 *
 * Factores contextuales aplicados:
 *   - Forma reciente (últimos 5 partidos)
 *   - Días de descanso por equipo
 *   - Fase del torneo (grupo vs eliminatoria)
 *   - Condiciones climáticas
 */

export type SmartBetTier     = 'premium' | 'muy_fuerte' | 'fuerte' | 'moderada' | 'evitar'
export type SmartBetCategory = 'resultado' | 'goles' | 'porteria' | 'corners' | 'tarjetas' | 'disparos' | 'combinada'

export interface SmartBetRecommendation {
  id:            string
  label:         string
  category:      SmartBetCategory
  confidence:    number          // 60-96 cuando tier != evitar
  tier:          SmartBetTier
  justification: string
  factors:       { for: string[]; against: string[] }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toTier(c: number): SmartBetTier {
  if (c >= 90) return 'premium'
  if (c >= 80) return 'muy_fuerte'
  if (c >= 70) return 'fuerte'
  if (c >= 60) return 'moderada'
  return 'evitar'
}

function cap(v: number): number {
  return Math.round(Math.min(96, Math.max(0, v)))
}

/** P(X > k) — Poisson con media lambda */
function poissonOver(lambda: number, k: number): number {
  if (lambda <= 0) return 0
  let cum = 0, term = Math.exp(-lambda)
  for (let i = 0; i <= k; i++) { cum += term; term *= lambda / (i + 1) }
  return Math.max(0, Math.min(1, 1 - cum))
}

/** P(X = k) — Poisson PMF (log-space para estabilidad) */
function poissonPMF(lambda: number, k: number): number {
  if (k < 0 || lambda <= 0) return k === 0 ? 1 : 0
  if (k === 0) return Math.exp(-lambda)
  let logP = -lambda + k * Math.log(lambda)
  for (let i = 1; i <= k; i++) logP -= Math.log(i)
  return Math.exp(logP)
}

/** P(home goals − away goals ≥ 2) via rejilla Poisson 9×9 */
function probWinByTwo(lH: number, lA: number): number {
  let p = 0
  for (let h = 2; h <= 9; h++) {
    const ph = poissonPMF(lH, h)
    if (ph < 1e-7) continue
    for (let a = 0; a <= h - 2; a++) p += ph * poissonPMF(lA, a)
  }
  return Math.min(0.95, p)
}

/** P(Poisson >= 1) = 1 - e^(-lambda) */
function atLeastOne(lambda: number): number {
  return Math.min(0.99, 1 - Math.exp(-Math.max(0, lambda)))
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

// ─── Motor principal ──────────────────────────────────────────────────────────

/**
 * Calcula todos los mercados con confianza ≥ 60%, ordenados descendente.
 * El componente decide cuántos mostrar como "top" y cuántos en "otros".
 */
export function computeSmartBets(
  prediction: any,
  homeStats:  any,
  awayStats:  any,
  homeTeam:   any,
  awayTeam:   any,
  injuries:   any[],
  match?:     any,
): SmartBetRecommendation[] {
  if (!prediction) return []

  // ── Datos del modelo ────────────────────────────────────────────────────────
  const homeWin = prediction.home_win_probability  ?? 0.33
  const draw    = prediction.draw_probability      ?? 0.33
  const awayWin = prediction.away_win_probability  ?? 0.33
  const predH   = Math.max(0.1, prediction.predicted_home_score ?? 1)
  const predA   = Math.max(0.1, prediction.predicted_away_score ?? 1)

  const homeXG       = homeStats?.avg_xg              ?? predH
  const awayXG       = awayStats?.avg_xg              ?? predA
  const homeXGA      = homeStats?.avg_xga             ?? predA
  const awayXGA      = awayStats?.avg_xga             ?? predH
  const homeGoals    = homeStats?.avg_goals_scored    ?? predH
  const awayGoals    = awayStats?.avg_goals_scored    ?? predA
  const homeConceded = homeStats?.avg_goals_conceded  ?? predA
  const awayConceded = awayStats?.avg_goals_conceded  ?? predH
  const homeCorners  = homeStats?.avg_corners         ?? 4.5
  const awayCorners  = awayStats?.avg_corners         ?? 4.0
  const homeYellow   = homeStats?.avg_yellow_cards    ?? 1.5
  const awayYellow   = awayStats?.avg_yellow_cards    ?? 1.5
  const homeShotsOT  = homeStats?.avg_shots_on_target ?? 3.5
  const awayShotsOT  = awayStats?.avg_shots_on_target ?? 3.0

  const eloDiff  = (homeTeam?.elo_rating ?? 1500) - (awayTeam?.elo_rating ?? 1500)
  const homeName = homeTeam?.short_name ?? homeTeam?.name ?? 'Local'
  const awayName = awayTeam?.short_name ?? awayTeam?.name ?? 'Visitante'

  const homeInjuries = injuries.filter((i: any) => i.team_id === homeTeam?.id)
  const awayInjuries = injuries.filter((i: any) => i.team_id === awayTeam?.id)
  const homeInjImpact = homeInjuries.reduce((s: number, i: any) => s + (i.impact_score ?? 0), 0)
  const awayInjImpact = awayInjuries.reduce((s: number, i: any) => s + (i.impact_score ?? 0), 0)
  const homeKeyDown   = homeInjuries.filter((i: any) => i.impact_score >= 7)
  const awayKeyDown   = awayInjuries.filter((i: any) => i.impact_score >= 7)

  // ── Factores contextuales ────────────────────────────────────────────────────
  const phase       = match?.phase ?? 'group'
  const isKnockout  = ['round_of_16', 'quarter_final', 'semi_final', 'final', 'third_place'].includes(phase)
  const homeRest    = match?.home_rest_days ?? 4
  const awayRest    = match?.away_rest_days ?? 4
  const weatherRaw  = (match?.weather_condition ?? '').toLowerCase()
  const isBadWeather = /rain|wet|storm|wind|drizzle/i.test(weatherRaw)
  const tempC        = match?.weather_temp_celsius ?? 22
  const isHot        = tempC > 32

  const homeFS = formScore(homeStats?.form)
  const awayFS = formScore(awayStats?.form)
  const homeFStr = formStr(homeStats?.form)
  const awayFStr = formStr(awayStats?.form)

  // Factores multiplicativos por equipo
  const homeRestF = homeRest < 3 ? 0.95 : homeRest > 7 ? 1.02 : 1.0
  const awayRestF = awayRest < 3 ? 0.95 : awayRest > 7 ? 1.02 : 1.0
  const homeFormF = homeFS >= 0.7 ? 1.03 : homeFS <= 0.3 ? 0.95 : 1.0
  const awayFormF = awayFS >= 0.7 ? 1.03 : awayFS <= 0.3 ? 0.95 : 1.0

  // Factores por tipo de mercado
  const goalsF   = (isKnockout ? 0.92 : 1.0) * (isBadWeather ? 0.97 : 1.0) * (isHot ? 0.97 : 1.0)
  const cornersF = isBadWeather ? 1.04 : 1.0
  const drawF    = isKnockout ? 1.06 : 1.0
  const csF      = isKnockout ? 1.04 : 1.0

  const results: SmartBetRecommendation[] = []

  function push(rec: Omit<SmartBetRecommendation, 'tier'>) {
    if (rec.confidence < 60) return
    results.push({ ...rec, tier: toTier(rec.confidence) })
  }

  // ── 1X2 ───────────────────────────────────────────────────────────────────

  // Victoria local
  {
    const base = homeWin * 100
    const c = cap(base * homeRestF * homeFormF * (homeInjImpact > 15 ? 0.94 : 1.0))
    const fFor: string[] = [], fAg: string[] = []
    if (eloDiff > 80)  fFor.push(`Ventaja ELO significativa (+${eloDiff} puntos)`)
    if (homeXG > awayXGA * 1.2) fFor.push(`xG superior a la defensa rival (${homeXG.toFixed(2)} vs ${awayXGA.toFixed(2)})`)
    if (homeGoals > 1.5) fFor.push(`${homeName} promedia ${homeGoals.toFixed(1)} goles/partido`)
    if (homeFS >= 0.7 && homeFStr) fFor.push(`Racha positiva: ${homeFStr}`)
    if (homeRest < 3) fAg.push(`Solo ${homeRest} días de descanso — posible fatiga`)
    if (Math.abs(eloDiff) < 60) fAg.push('ELO equilibrado — resultado abierto')
    if (awayFS >= 0.7 && awayFStr) fAg.push(`${awayName} también en buena forma: ${awayFStr}`)
    if (homeKeyDown.length > 0) fAg.push(`Baja de alto impacto: ${homeKeyDown[0].player?.short_name ?? 'jugador clave'}`)
    push({ id: 'home_win', label: `${homeName} gana`, category: 'resultado', confidence: c,
      justification: `Con ${base.toFixed(0)}% de probabilidad, el motor favorece al local impulsado por su ventaja ELO y producción ofensiva medida en xG.`,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) } })
  }

  // Empate
  {
    const base = draw * 100
    const c = cap(base * drawF)
    const fFor: string[] = [], fAg: string[] = []
    if (Math.abs(eloDiff) < 60) fFor.push(`Equipos muy igualados por ELO (dif. ${Math.abs(eloDiff)} pts)`)
    if (Math.abs(homeXG - awayXG) < 0.35) fFor.push(`Potencial ofensivo similar (${homeXG.toFixed(2)} vs ${awayXG.toFixed(2)} xG)`)
    if (isKnockout) fFor.push('Eliminatoria — equipos más conservadores, más empates en 90 min')
    if (homeGoals < 1.3 && awayGoals < 1.3) fFor.push('Producción ofensiva moderada de ambos')
    if (Math.abs(eloDiff) > 120) fAg.push('Diferencia de nivel considerable reduce la probabilidad de empate')
    if (homeWin > 0.5 || awayWin > 0.5) fAg.push('El motor favorece claramente a uno de los equipos')
    push({ id: 'draw', label: 'Empate', category: 'resultado', confidence: c,
      justification: `El motor calcula ${base.toFixed(0)}% de probabilidad de empate, respaldado por el equilibrio de fuerzas y producción ofensiva similar.`,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) } })
  }

  // Victoria visitante
  {
    const base = awayWin * 100
    const c = cap(base * awayRestF * awayFormF * (awayInjImpact > 15 ? 0.94 : 1.0))
    const fFor: string[] = [], fAg: string[] = []
    if (eloDiff < -80) fFor.push(`Ventaja ELO del visitante (${Math.abs(eloDiff)} puntos)`)
    if (awayXG > homeXGA * 1.2) fFor.push(`xG visitante supera la defensa local (${awayXG.toFixed(2)} vs ${homeXGA.toFixed(2)})`)
    if (awayGoals > 1.5) fFor.push(`${awayName} promedia ${awayGoals.toFixed(1)} goles/partido`)
    if (awayFS >= 0.7 && awayFStr) fFor.push(`Racha positiva: ${awayFStr}`)
    if (awayRest < 3) fAg.push(`Solo ${awayRest} días de descanso — posible fatiga del visitante`)
    if (Math.abs(eloDiff) < 60) fAg.push('El factor local compensa el equilibrio de ELO')
    if (homeFS >= 0.7 && homeFStr) fAg.push(`${homeName} también en buena forma: ${homeFStr}`)
    if (awayKeyDown.length > 0) fAg.push(`Baja de alto impacto: ${awayKeyDown[0].player?.short_name ?? 'jugador clave'}`)
    push({ id: 'away_win', label: `${awayName} gana`, category: 'resultado', confidence: c,
      justification: `El motor asigna ${base.toFixed(0)}% al triunfo visitante, impulsado por su superioridad ELO y eficacia ofensiva demostrada.`,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) } })
  }

  // ── DOBLE OPORTUNIDAD ──────────────────────────────────────────────────────

  if (homeWin >= 0.35) {
    const prob = homeWin + draw
    const c = cap(prob * 100 * 0.98)
    push({ id: 'dc_1x', label: `${homeName} o empate (1X)`, category: 'resultado', confidence: c,
      justification: `La doble oportunidad local cubre el ${(prob*100).toFixed(0)}% de los escenarios: victoria local (${(homeWin*100).toFixed(0)}%) más empate como red de seguridad (${(draw*100).toFixed(0)}%).`,
      factors: { for: [`Cubre ${(prob*100).toFixed(0)}% de los escenarios posibles`, eloDiff > 40 ? `${homeName} parte con ventaja ELO (+${eloDiff} pts)` : 'Partido equilibrado — empate plausible'].slice(0, 2), against: [awayWin > 0.35 ? `Riesgo real de victoria visitante (${(awayWin*100).toFixed(0)}%)` : ''].filter(Boolean) } })
  }

  if (awayWin >= 0.35) {
    const prob = draw + awayWin
    const c = cap(prob * 100 * 0.98)
    push({ id: 'dc_x2', label: `${awayName} o empate (X2)`, category: 'resultado', confidence: c,
      justification: `La doble oportunidad visitante abarca el ${(prob*100).toFixed(0)}% de los escenarios: victoria visitante (${(awayWin*100).toFixed(0)}%) más empate (${(draw*100).toFixed(0)}%).`,
      factors: { for: [`Cubre ${(prob*100).toFixed(0)}% de los escenarios posibles`, eloDiff < -40 ? `${awayName} parte con ventaja ELO` : 'Partido equilibrado — empate plausible'].slice(0, 2), against: [homeWin > 0.35 ? `Riesgo de victoria local (${(homeWin*100).toFixed(0)}%)` : ''].filter(Boolean) } })
  }

  // ── HANDICAP -1 LOCAL ─────────────────────────────────────────────────────

  if (homeWin >= 0.5 && predH - predA >= 0.8) {
    const prob = probWinByTwo(predH, predA)
    const c = cap(prob * 100 * homeFormF)
    const fFor: string[] = [], fAg: string[] = []
    if (eloDiff > 100) fFor.push(`Gran ventaja ELO (+${eloDiff} pts)`)
    if (predH - predA >= 1.2) fFor.push(`Motor proyecta ${predH.toFixed(1)}-${predA.toFixed(1)} — diferencia amplia`)
    if (homeXG > 2.0) fFor.push(`${homeName} genera mucho xG (${homeXG.toFixed(2)}/partido)`)
    if (prob < 0.50) fAg.push('Ganar por 2+ goles no es el escenario más probable')
    if (awayXGA < 1.0) fAg.push(`${awayName} defiende bien (xGA: ${awayXGA.toFixed(2)})`)
    push({ id: 'handicap_home', label: `${homeName} -1 (gana por 2+)`, category: 'resultado', confidence: c,
      justification: `Con marcador proyectado ${predH.toFixed(1)}-${predA.toFixed(1)}, el motor calcula ${(prob*100).toFixed(0)}% de probabilidad de que ${homeName} gane por dos o más goles de diferencia.`,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) } })
  }

  // ── GOLES ─────────────────────────────────────────────────────────────────

  const totalLambda = predH + predA
  const totalXG     = homeXG + awayXG

  // Más de 1.5 goles
  {
    const prob = 1 - Math.exp(-totalLambda) * (1 + totalLambda)
    const c = cap(prob * 100 * goalsF * (totalXG > 2.8 ? 1.03 : 1.0))
    const fFor: string[] = [], fAg: string[] = []
    if (totalXG > 2.5) fFor.push(`xG combinado alto (${totalXG.toFixed(2)}/partido)`)
    if (homeGoals > 1.3) fFor.push(`${homeName} anota ${homeGoals.toFixed(1)} goles/partido`)
    if (awayGoals > 1.0) fFor.push(`${awayName} genera ${awayGoals.toFixed(1)} goles/partido`)
    if (isKnockout) fAg.push('Eliminatoria — equipos más defensivos históricamente')
    if (isBadWeather) fAg.push('Condiciones adversas reducen la producción ofensiva')
    if (homeXGA < 0.7 && awayXGA < 0.7) fAg.push('Ambas defensas sólidas — partido cerrado posible')
    push({ id: 'over_1_5', label: 'Más de 1.5 goles', category: 'goles', confidence: c,
      justification: `Motor proyecta ${totalLambda.toFixed(1)} goles totales (${predH.toFixed(1)}-${predA.toFixed(1)}) con xG combinado de ${totalXG.toFixed(2)}. Probabilidad de superar 1.5: ${(prob*100).toFixed(0)}%.`,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) } })
  }

  // Más de 2.5 goles
  {
    const prob = poissonOver(totalLambda, 2)
    const c = cap(prob * 100 * goalsF * (totalXG > 3.0 ? 1.04 : totalXG < 2.0 ? 0.95 : 1.0))
    const fFor: string[] = [], fAg: string[] = []
    if (totalXG > 3.0) fFor.push(`xG combinado muy alto (${totalXG.toFixed(2)})`)
    if (homeGoals + awayGoals > 2.8) fFor.push(`Media combinada de ${(homeGoals+awayGoals).toFixed(1)} goles/partido`)
    if (homeXGA > 1.2 && awayXGA > 1.2) fFor.push('Ambas defensas conceden con regularidad')
    if (isKnockout) fAg.push('Eliminatoria — tendencia a partidos cerrados')
    if (totalXG < 2.2) fAg.push(`xG combinado moderado (${totalXG.toFixed(2)}) no garantiza 3 goles`)
    push({ id: 'over_2_5', label: 'Más de 2.5 goles', category: 'goles', confidence: c,
      justification: `Con ${totalLambda.toFixed(1)} goles proyectados y xG combinado de ${totalXG.toFixed(2)}, el motor estima ${(prob*100).toFixed(0)}% de probabilidad de superar 2.5 goles.`,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) } })
  }

  // Más de 3.5 goles
  {
    const prob = poissonOver(totalLambda, 3)
    const c = cap(prob * 100 * goalsF)
    const fFor: string[] = [], fAg: string[] = []
    if (totalXG > 3.5) fFor.push(`xG combinado muy elevado (${totalXG.toFixed(2)})`)
    if (homeGoals + awayGoals > 3.2) fFor.push(`Media combinada de ${(homeGoals+awayGoals).toFixed(1)} goles/partido`)
    if (isKnockout) fAg.push('Eliminatoria — difícil superar 3.5 goles')
    if (totalXG < 3.0) fAg.push(`xG combinado (${totalXG.toFixed(2)}) no sustenta 4+ goles`)
    push({ id: 'over_3_5', label: 'Más de 3.5 goles', category: 'goles', confidence: c,
      justification: `El motor proyecta ${totalLambda.toFixed(1)} goles totales. Probabilidad de superar 3.5: ${(prob*100).toFixed(0)}%.`,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) } })
  }

  // Ambos marcan
  {
    const pH = atLeastOne(predH), pA = atLeastOne(predA)
    const prob = pH * pA
    const c = cap(prob * 100 * goalsF * (homeXG > 1.0 && awayXG > 0.8 ? 1.02 : 1.0))
    const fFor: string[] = [], fAg: string[] = []
    if (homeXG > 1.2 && awayXG > 1.0) fFor.push(`Ambos generan xG elevado (${homeXG.toFixed(2)} y ${awayXG.toFixed(2)})`)
    if (homeGoals > 1.2) fFor.push(`${homeName} marca en casi todos sus partidos`)
    if (awayGoals > 1.0) fFor.push(`${awayName} también suele anotar (${awayGoals.toFixed(1)}/p)`)
    if (predA < 0.7) fAg.push(`Motor proyecta solo ${predA.toFixed(1)} goles para el visitante`)
    if (awayXG < 0.8) fAg.push(`${awayName} genera pocas ocasiones (xG: ${awayXG.toFixed(2)})`)
    push({ id: 'btts', label: 'Ambos equipos marcan', category: 'goles', confidence: c,
      justification: `Con proyección ${predH.toFixed(1)}-${predA.toFixed(1)}, el motor calcula ${(prob*100).toFixed(0)}% de que ambos equipos anoten (local ${(pH*100).toFixed(0)}% × visitante ${(pA*100).toFixed(0)}%).`,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) } })
  }

  // Local marca
  {
    const prob = atLeastOne(predH)
    const c = cap(prob * 100 * homeFormF)
    if (c >= 65) push({ id: 'home_scores', label: `${homeName} marca`, category: 'goles', confidence: c,
      justification: `Con ${predH.toFixed(1)} goles proyectados y xG de ${homeXG.toFixed(2)}, el motor estima ${(prob*100).toFixed(0)}% de probabilidad de que ${homeName} anote al menos un gol.`,
      factors: { for: [homeXG > 1.3 ? `Producción ofensiva alta (xG: ${homeXG.toFixed(2)})` : `xG de ${homeXG.toFixed(2)}/partido`, awayXGA > 1.0 ? `Defensa rival permeable (xGA: ${awayXGA.toFixed(2)})` : ''].filter(Boolean).slice(0, 2),
        against: [awayXGA < 0.7 ? `${awayName} concede muy poco (xGA: ${awayXGA.toFixed(2)})` : '', homeKeyDown.length > 0 ? 'Bajas en el ataque local' : ''].filter(Boolean).slice(0, 2) } })
  }

  // Visitante marca
  {
    const prob = atLeastOne(predA)
    const c = cap(prob * 100 * awayFormF)
    if (c >= 65) push({ id: 'away_scores', label: `${awayName} marca`, category: 'goles', confidence: c,
      justification: `El motor proyecta ${predA.toFixed(1)} goles para ${awayName} con xG de ${awayXG.toFixed(2)}, estimando ${(prob*100).toFixed(0)}% de probabilidad de que el visitante anote.`,
      factors: { for: [`xG visitante de ${awayXG.toFixed(2)}/partido`, homeXGA > 1.0 ? `Defensa local permeable (xGA: ${homeXGA.toFixed(2)})` : ''].filter(Boolean).slice(0, 2),
        against: [homeXGA < 0.7 ? `${homeName} defiende muy bien (xGA: ${homeXGA.toFixed(2)})` : '', awayKeyDown.length > 0 ? 'Bajas en el ataque visitante' : ''].filter(Boolean).slice(0, 2) } })
  }

  // ── PORTERÍA A CERO ───────────────────────────────────────────────────────

  // Local a cero
  {
    const prob = Math.exp(-predA)
    const c = cap(prob * 100 * csF * (awayXG < 0.9 ? 1.04 : awayXG > 1.4 ? 0.93 : 1.0))
    const fFor: string[] = [], fAg: string[] = []
    if (homeXGA < 0.8) fFor.push(`Defensa local muy sólida (xGA: ${homeXGA.toFixed(2)})`)
    if (awayXG < 1.0)  fFor.push(`Ataque visitante limitado (xG: ${awayXG.toFixed(2)})`)
    if (homeConceded < 0.8) fFor.push(`${homeName} concede solo ${homeConceded.toFixed(1)} goles/partido`)
    if (isKnockout) fFor.push('Eliminatoria — equipos muy ordenados defensivamente')
    if (awayXG > 1.3) fAg.push(`${awayName} genera ${awayXG.toFixed(2)} xG/partido — amenaza real`)
    if (awayGoals > 1.3) fAg.push(`${awayName} promedia ${awayGoals.toFixed(1)} goles/partido`)
    push({ id: 'cs_home', label: `${homeName} portería a cero`, category: 'porteria', confidence: c,
      justification: `Con solo ${predA.toFixed(1)} goles proyectados para ${awayName}, el motor estima ${(prob*100).toFixed(0)}% de que ${homeName} mantenga la portería a cero.`,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) } })
  }

  // Visitante a cero
  {
    const prob = Math.exp(-predH)
    const c = cap(prob * 100 * csF * (homeXG < 0.9 ? 1.04 : homeXG > 1.4 ? 0.93 : 1.0))
    const fFor: string[] = [], fAg: string[] = []
    if (awayXGA < 0.8) fFor.push(`Defensa visitante compacta (xGA: ${awayXGA.toFixed(2)})`)
    if (homeXG < 1.0)  fFor.push(`Ataque local moderado (xG: ${homeXG.toFixed(2)})`)
    if (awayConceded < 0.8) fFor.push(`${awayName} concede solo ${awayConceded.toFixed(1)} goles/partido`)
    if (isKnockout) fFor.push('Eliminatoria — defensas más conservadoras')
    if (homeXG > 1.3) fAg.push(`${homeName} genera ${homeXG.toFixed(2)} xG en casa`)
    if (homeGoals > 1.3) fAg.push(`${homeName} promedia ${homeGoals.toFixed(1)} goles de local`)
    push({ id: 'cs_away', label: `${awayName} portería a cero`, category: 'porteria', confidence: c,
      justification: `Con ${predH.toFixed(1)} goles proyectados para ${homeName}, el motor estima ${(prob*100).toFixed(0)}% de que ${awayName} mantenga la portería a cero.`,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) } })
  }

  // Local gana a cero (win to nil)
  {
    const prob = Math.exp(-predA) * atLeastOne(predH)
    const c = cap(prob * 100 * homeFormF * csF)
    const fFor: string[] = [], fAg: string[] = []
    if (homeWin > 0.55) fFor.push(`${homeName} es claro favorito (${(homeWin*100).toFixed(0)}%)`)
    if (homeXGA < 0.9 && awayXG < 1.0) fFor.push('Superioridad ofensiva y defensiva combinadas')
    if (eloDiff > 100) fFor.push(`Ventaja ELO grande (+${eloDiff} pts)`)
    if (prob < 0.35) fAg.push('Combinar victoria Y portería a 0 reduce la probabilidad')
    if (awayXG > 1.2) fAg.push(`${awayName} genera suficiente xG para puntuar`)
    push({ id: 'home_wtn', label: `${homeName} gana sin encajar`, category: 'porteria', confidence: c,
      justification: `El motor combina la probabilidad de victoria local (${(homeWin*100).toFixed(0)}%) con portería a cero (${(Math.exp(-predA)*100).toFixed(0)}%) para estimar ${(prob*100).toFixed(0)}% de triunfo limpio.`,
      factors: { for: fFor.slice(0, 3), against: fAg.slice(0, 2) } })
  }

  // ── CORNERS ───────────────────────────────────────────────────────────────

  const expCorners = (homeCorners + awayCorners) * cornersF
  if (expCorners > 0) {
    [{k: 8, label: 'Más de 8.5 corners'}, {k: 9, label: 'Más de 9.5 corners'}, {k: 10, label: 'Más de 10.5 corners'}].forEach(({ k, label }) => {
      const prob = poissonOver(expCorners, k)
      const c = cap(prob * 100)
      push({ id: `corners_${k}_5`, label, category: 'corners', confidence: c,
        justification: `Media de corners combinada: ${(homeCorners + awayCorners).toFixed(1)}/partido (${homeName}: ${homeCorners.toFixed(1)}, ${awayName}: ${awayCorners.toFixed(1)})${isBadWeather ? ' — condiciones adversas aumentan los corners' : ''}. Probabilidad de superar ${k}.5: ${(prob*100).toFixed(0)}%.`,
        factors: { for: [`Media combinada de ${(homeCorners+awayCorners).toFixed(1)} corners/partido`, isBadWeather ? 'Lluvia/viento genera más saques de esquina' : '', expCorners > k + 1.5 ? 'Ambos equipos presionan en banda' : ''].filter(Boolean).slice(0, 3),
          against: [expCorners < k + 1 ? 'Media cerca del umbral — poco margen' : ''].filter(Boolean) } })
    })
  }

  // ── TARJETAS AMARILLAS ────────────────────────────────────────────────────

  const expYellow = homeYellow + awayYellow
  if (expYellow > 0) {
    [{k: 2, label: 'Más de 2.5 amarillas'}, {k: 3, label: 'Más de 3.5 amarillas'}, {k: 4, label: 'Más de 4.5 amarillas'}].forEach(({ k, label }) => {
      const prob = poissonOver(expYellow, k)
      const c = cap(prob * 100 * (isKnockout ? 1.04 : 1.0))
      push({ id: `cards_${k}_5`, label, category: 'tarjetas', confidence: c,
        justification: `Media combinada de ${expYellow.toFixed(1)} amarillas/partido (${homeName}: ${homeYellow.toFixed(1)}, ${awayName}: ${awayYellow.toFixed(1)})${isKnockout ? ' — eliminatorias tienden a más intensidad' : ''}. Probabilidad de superar ${k}.5: ${(prob*100).toFixed(0)}%.`,
        factors: { for: [`Media combinada de ${expYellow.toFixed(1)} amarillas/partido`, isKnockout ? 'Eliminatoria — mayor tensión e intensidad' : '', expYellow > k + 1 ? 'Equipos con tendencia a la falta' : ''].filter(Boolean).slice(0, 3),
          against: [expYellow < k + 0.5 ? 'Media no garantiza superar el umbral con margen' : ''].filter(Boolean) } })
    })
  }

  // ── DISPAROS A PUERTA ─────────────────────────────────────────────────────

  const expShotsOT = homeShotsOT + awayShotsOT
  if (expShotsOT > 0) {
    [{k: 5, label: 'Más de 5.5 disparos a puerta'}, {k: 7, label: 'Más de 7.5 disparos a puerta'}].forEach(({ k, label }) => {
      const prob = poissonOver(expShotsOT, k)
      const c = cap(prob * 100 * (isBadWeather ? 0.96 : 1.0))
      push({ id: `shots_ot_${k}_5`, label, category: 'disparos', confidence: c,
        justification: `Media combinada de ${expShotsOT.toFixed(1)} disparos a puerta/partido (${homeName}: ${homeShotsOT.toFixed(1)}, ${awayName}: ${awayShotsOT.toFixed(1)}). Probabilidad de superar ${k}.5: ${(prob*100).toFixed(0)}%.`,
        factors: { for: [`Media combinada de ${expShotsOT.toFixed(1)} disparos a puerta/partido`, expShotsOT > k + 2 ? 'Ambos equipos muy activos en ataque' : ''].filter(Boolean).slice(0, 2),
          against: [isBadWeather ? 'Condiciones adversas reducen la precisión' : '', expShotsOT < k + 1 ? 'Media cerca del umbral' : ''].filter(Boolean).slice(0, 2) } })
    })
  }

  // ── COMBINADAS ────────────────────────────────────────────────────────────

  if (homeWin >= 0.45) {
    const over15 = 1 - Math.exp(-totalLambda) * (1 + totalLambda)
    const prob = homeWin * over15 * 0.88
    const c = cap(prob * 100 * goalsF * homeFormF)
    push({ id: 'combo_hw_o15', label: `${homeName} gana y más de 1.5 goles`, category: 'combinada', confidence: c,
      justification: `Combinada: victoria local (${(homeWin*100).toFixed(0)}%) con partido de goles (${(over15*100).toFixed(0)}% de >1.5). Probabilidad conjunta estimada: ${(prob*100).toFixed(0)}%.`,
      factors: { for: [`${homeName} favorito (${(homeWin*100).toFixed(0)}%)`, `${(over15*100).toFixed(0)}% de probabilidad de superar 1.5 goles`],
        against: [homeWin < 0.55 ? 'La victoria local no es segura (< 55%)' : '', isKnockout ? 'Eliminatoria — puede ser partido más cerrado' : ''].filter(Boolean).slice(0, 2) } })
  }

  if (awayWin >= 0.45) {
    const over15 = 1 - Math.exp(-totalLambda) * (1 + totalLambda)
    const prob = awayWin * over15 * 0.88
    const c = cap(prob * 100 * goalsF * awayFormF)
    push({ id: 'combo_aw_o15', label: `${awayName} gana y más de 1.5 goles`, category: 'combinada', confidence: c,
      justification: `Combinada: victoria visitante (${(awayWin*100).toFixed(0)}%) con partido de goles (${(over15*100).toFixed(0)}% de >1.5). Probabilidad conjunta: ${(prob*100).toFixed(0)}%.`,
      factors: { for: [`${awayName} favorito (${(awayWin*100).toFixed(0)}%)`, `${(over15*100).toFixed(0)}% de probabilidad de superar 1.5 goles`],
        against: [awayWin < 0.55 ? 'La victoria visitante no es segura' : ''].filter(Boolean) } })
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}
