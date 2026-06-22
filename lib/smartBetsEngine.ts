/**
 * Motor de Smart Bets AI: evalua todos los mercados disponibles y devuelve
 * las N apuestas con mayor probabilidad de éxito, ordenadas por confianza.
 * No depende de cuotas ni casas de apuestas — funciona solo con el modelo.
 */

export type SmartBetTier = 'premium' | 'muy_fuerte' | 'fuerte' | 'moderada' | 'evitar'

export interface SmartBetRecommendation {
  id: string
  label: string
  confidence: number  // 0-100
  tier: SmartBetTier
  justification: string
  factors: { for: string[]; against: string[] }
}

function tier(c: number): SmartBetTier {
  if (c >= 90) return 'premium'
  if (c >= 80) return 'muy_fuerte'
  if (c >= 70) return 'fuerte'
  if (c >= 60) return 'moderada'
  return 'evitar'
}

/** P(X > k) para distribución de Poisson con media lambda */
function poissonOver(lambda: number, k: number): number {
  if (lambda <= 0) return 0
  let cumulative = 0
  let term = Math.exp(-lambda)
  for (let i = 0; i <= k; i++) {
    cumulative += term
    term *= lambda / (i + 1)
  }
  return Math.max(0, Math.min(1, 1 - cumulative))
}

/** P(X >= 1) para Poisson = 1 - e^(-lambda) */
function poissonAtLeastOne(lambda: number): number {
  if (lambda <= 0) return 0
  return Math.min(0.99, 1 - Math.exp(-lambda))
}

function cap(v: number): number {
  return Math.round(Math.min(96, Math.max(0, v)))
}

export function computeSmartBets(
  prediction: any,
  homeStats: any,
  awayStats: any,
  homeTeam: any,
  awayTeam: any,
  injuries: any[],
  maxResults = 3,
): SmartBetRecommendation[] {
  if (!prediction) return []

  const homeWin = prediction.home_win_probability ?? 0.33
  const draw    = prediction.draw_probability    ?? 0.33
  const awayWin = prediction.away_win_probability ?? 0.33
  const predH   = Math.max(0.1, prediction.predicted_home_score ?? 1)
  const predA   = Math.max(0.1, prediction.predicted_away_score ?? 1)
  const modelConf = (prediction.confidence_score ?? 50) / 100

  const homeXG  = homeStats?.avg_xg ?? predH
  const awayXG  = awayStats?.avg_xg ?? predA
  const homeXGA = homeStats?.avg_xga ?? predA
  const awayXGA = awayStats?.avg_xga ?? predH
  const homeGoals    = homeStats?.avg_goals_scored   ?? predH
  const awayGoals    = awayStats?.avg_goals_scored   ?? predA
  const homeConceded = homeStats?.avg_goals_conceded ?? predA
  const awayConceded = awayStats?.avg_goals_conceded ?? predH

  const homeCorners = homeStats?.avg_corners      ?? 4.5
  const awayCorners = awayStats?.avg_corners      ?? 4.0
  const homeYellow  = homeStats?.avg_yellow_cards ?? 1.5
  const awayYellow  = awayStats?.avg_yellow_cards ?? 1.5

  const eloDiff  = (homeTeam?.elo_rating ?? 1500) - (awayTeam?.elo_rating ?? 1500)
  const homeName = homeTeam?.short_name ?? homeTeam?.name ?? 'Local'
  const awayName = awayTeam?.short_name ?? awayTeam?.name ?? 'Visitante'

  const homeInjury = injuries
    .filter((i: any) => i.team_id === homeTeam?.id)
    .reduce((s: number, i: any) => s + (i.impact_score ?? 0), 0)
  const awayInjury = injuries
    .filter((i: any) => i.team_id === awayTeam?.id)
    .reduce((s: number, i: any) => s + (i.impact_score ?? 0), 0)

  const results: SmartBetRecommendation[] = []

  function push(rec: Omit<SmartBetRecommendation, 'tier'>) {
    if (rec.confidence < 60) return
    results.push({ ...rec, tier: tier(rec.confidence) })
  }

  // ── VICTORIA LOCAL ─────────────────────────────────────────────────────────
  {
    const base = homeWin * 100
    const boost = eloDiff > 100 && homeXG > awayXGA * 1.2 ? 1.03 : 1.0
    const pen   = homeInjury > 15 ? 0.94 : 1.0
    const c = cap(base * boost * pen)
    const factorsFor: string[] = []
    const factorsAgainst: string[] = []
    if (eloDiff > 80) factorsFor.push(`Ventaja ELO significativa (+${eloDiff} puntos)`)
    if (homeXG > awayXGA * 1.2) factorsFor.push(`xG ofensivo superior a la defensa rival (${homeXG.toFixed(2)} vs ${awayXGA.toFixed(2)})`)
    if (homeGoals > 1.5) factorsFor.push(`${homeName} anota ${homeGoals.toFixed(1)} goles/partido`)
    if (awayConceded > 1.3) factorsFor.push(`${awayName} concede ${awayConceded.toFixed(1)} goles/partido`)
    if (Math.abs(eloDiff) < 60) factorsAgainst.push('ELO equilibrado — el resultado está abierto')
    if (awayXG > 1.4) factorsAgainst.push(`${awayName} genera ${awayXG.toFixed(2)} xG/partido — amenaza real`)
    if (homeInjury > 15) factorsAgainst.push(`${homeName} tiene bajas que afectan el rendimiento`)
    push({
      id: 'home_win',
      label: `${homeName} gana`,
      confidence: c,
      justification: `Con ${base.toFixed(0)}% de probabilidad, el motor favorece al local apoyado en su ventaja ELO y producción ofensiva medida en xG.`,
      factors: { for: factorsFor.slice(0, 3), against: factorsAgainst.slice(0, 2) },
    })
  }

  // ── EMPATE ────────────────────────────────────────────────────────────────
  {
    const base = draw * 100
    const eloBalance = Math.abs(eloDiff) < 60
    const c = cap(base * (eloBalance ? 1.04 : 0.97))
    const factorsFor: string[] = []
    const factorsAgainst: string[] = []
    if (eloBalance) factorsFor.push(`Equipos muy igualados por ELO (dif. ${Math.abs(eloDiff)} pts)`)
    if (Math.abs(homeXG - awayXG) < 0.35) factorsFor.push(`Potencial ofensivo similar (xG: ${homeXG.toFixed(2)} vs ${awayXG.toFixed(2)})`)
    if (homeGoals < 1.3 && awayGoals < 1.3) factorsFor.push('Baja producción ofensiva de ambos favorece empate')
    if (Math.abs(eloDiff) > 120) factorsAgainst.push('Diferencia de nivel considerable reduce la probabilidad de empate')
    if (homeWin > 0.5 || awayWin > 0.5) factorsAgainst.push('El motor favorece claramente a uno de los equipos')
    push({
      id: 'draw',
      label: 'Empate',
      confidence: c,
      justification: `El motor calcula ${base.toFixed(0)}% de probabilidad de empate, respaldado por el equilibrio de fuerzas y la producción ofensiva similar de ambos.`,
      factors: { for: factorsFor.slice(0, 3), against: factorsAgainst.slice(0, 2) },
    })
  }

  // ── VICTORIA VISITANTE ────────────────────────────────────────────────────
  {
    const base = awayWin * 100
    const boost = eloDiff < -100 && awayXG > homeXGA * 1.2 ? 1.03 : 1.0
    const pen   = awayInjury > 15 ? 0.94 : 1.0
    const c = cap(base * boost * pen)
    const factorsFor: string[] = []
    const factorsAgainst: string[] = []
    if (eloDiff < -80) factorsFor.push(`Ventaja ELO del visitante (${Math.abs(eloDiff)} puntos)`)
    if (awayXG > homeXGA * 1.2) factorsFor.push(`xG visitante supera la defensa local (${awayXG.toFixed(2)} vs ${homeXGA.toFixed(2)})`)
    if (awayGoals > 1.5) factorsFor.push(`${awayName} promedia ${awayGoals.toFixed(1)} goles/partido`)
    if (homeConceded > 1.3) factorsFor.push(`${homeName} concede ${homeConceded.toFixed(1)} goles/partido`)
    if (Math.abs(eloDiff) < 60) factorsAgainst.push('El factor local compensa el equilibrio de ELO')
    if (homeXG > 1.4) factorsAgainst.push(`${homeName} genera ${homeXG.toFixed(2)} xG en casa`)
    if (awayInjury > 15) factorsAgainst.push(`${awayName} llega con bajas significativas`)
    push({
      id: 'away_win',
      label: `${awayName} gana`,
      confidence: c,
      justification: `El motor asigna ${base.toFixed(0)}% al triunfo visitante, impulsado por su superioridad ELO y eficacia ofensiva demostrada.`,
      factors: { for: factorsFor.slice(0, 3), against: factorsAgainst.slice(0, 2) },
    })
  }

  // ── DOBLE OPORTUNIDAD 1X ─────────────────────────────────────────────────
  if (homeWin >= 0.35) {
    const prob = homeWin + draw
    const c = cap(prob * 100 * 0.98)
    push({
      id: 'dc_1x',
      label: `${homeName} o empate (1X)`,
      confidence: c,
      justification: `La doble oportunidad local cubre el ${(prob * 100).toFixed(0)}% de los escenarios: el motor favorece al local (${(homeWin*100).toFixed(0)}%) con empate como red de seguridad (${(draw*100).toFixed(0)}%).`,
      factors: {
        for: [
          `Cubre ${(prob * 100).toFixed(0)}% de los escenarios posibles`,
          eloDiff > 40 ? `${homeName} parte con ventaja ELO (+${eloDiff} pts)` : 'Partido equilibrado favorece no-derrota local',
        ],
        against: [
          awayWin > 0.35 ? `Riesgo real de victoria visitante (${(awayWin*100).toFixed(0)}%)` : '',
        ].filter(Boolean),
      },
    })
  }

  // ── DOBLE OPORTUNIDAD X2 ─────────────────────────────────────────────────
  if (awayWin >= 0.35) {
    const prob = draw + awayWin
    const c = cap(prob * 100 * 0.98)
    push({
      id: 'dc_x2',
      label: `${awayName} o empate (X2)`,
      confidence: c,
      justification: `La doble oportunidad visitante abarca el ${(prob * 100).toFixed(0)}% de los escenarios: victoria visitante (${(awayWin*100).toFixed(0)}%) más empate como cobertura (${(draw*100).toFixed(0)}%).`,
      factors: {
        for: [
          `Cubre ${(prob * 100).toFixed(0)}% de los escenarios posibles`,
          eloDiff < -40 ? `${awayName} parte con ventaja ELO (+${Math.abs(eloDiff)} pts)` : 'Partido equilibrado favorece no-derrota visitante',
        ],
        against: [
          homeWin > 0.35 ? `Riesgo real de victoria local (${(homeWin*100).toFixed(0)}%)` : '',
        ].filter(Boolean),
      },
    })
  }

  // ── LOCAL MARCA 1+ GOL ───────────────────────────────────────────────────
  {
    const prob = poissonAtLeastOne(predH)
    const c = cap(prob * 100)
    if (c >= 65) {
      push({
        id: 'home_scores',
        label: `${homeName} marca`,
        confidence: c,
        justification: `Con ${predH.toFixed(1)} goles proyectados y xG ofensivo de ${homeXG.toFixed(2)}, el motor estima ${(prob*100).toFixed(0)}% de probabilidad de que ${homeName} anote al menos un gol.`,
        factors: {
          for: [
            homeXG > 1.3 ? `Producción ofensiva alta (xG: ${homeXG.toFixed(2)})` : `xG ofensivo de ${homeXG.toFixed(2)}/partido`,
            awayXGA > 1.0 ? `Defensa rival permeable (xGA: ${awayXGA.toFixed(2)})` : '',
            homeGoals > 1.2 ? `${homeName} anota en la mayoría de sus partidos` : '',
          ].filter(Boolean).slice(0, 3),
          against: [
            awayXGA < 0.7 ? `${awayName} concede muy poco (xGA: ${awayXGA.toFixed(2)})` : '',
            homeInjury > 15 ? 'Bajas en el ataque local reducen la amenaza' : '',
          ].filter(Boolean).slice(0, 2),
        },
      })
    }
  }

  // ── VISITANTE MARCA 1+ GOL ───────────────────────────────────────────────
  {
    const prob = poissonAtLeastOne(predA)
    const c = cap(prob * 100)
    if (c >= 65) {
      push({
        id: 'away_scores',
        label: `${awayName} marca`,
        confidence: c,
        justification: `El motor proyecta ${predA.toFixed(1)} goles para ${awayName} con xG de ${awayXG.toFixed(2)}, estimando ${(prob*100).toFixed(0)}% de probabilidad de que el visitante anote.`,
        factors: {
          for: [
            `xG visitante de ${awayXG.toFixed(2)}/partido`,
            homeXGA > 1.0 ? `Defensa local permeable (xGA: ${homeXGA.toFixed(2)})` : '',
            awayGoals > 1.0 ? `${awayName} anota ${awayGoals.toFixed(1)} goles/partido` : '',
          ].filter(Boolean).slice(0, 3),
          against: [
            homeXGA < 0.7 ? `${homeName} defiende muy bien en casa (xGA: ${homeXGA.toFixed(2)})` : '',
            awayInjury > 15 ? 'Bajas en el ataque visitante' : '',
          ].filter(Boolean).slice(0, 2),
        },
      })
    }
  }

  // ── MÁS DE 1.5 GOLES ─────────────────────────────────────────────────────
  {
    const lambda = predH + predA
    const p0 = Math.exp(-lambda)
    const p1 = lambda * p0
    const prob = 1 - p0 - p1
    const totalXG = homeXG + awayXG
    const boost = totalXG > 2.8 ? 1.03 : 1.0
    const c = cap(prob * 100 * boost)
    const factorsFor: string[] = []
    const factorsAgainst: string[] = []
    if (totalXG > 2.5) factorsFor.push(`xG combinado alto (${totalXG.toFixed(2)}/partido)`)
    if (homeGoals > 1.3) factorsFor.push(`${homeName} anota ${homeGoals.toFixed(1)} goles/partido`)
    if (awayGoals > 1.0) factorsFor.push(`${awayName} genera ${awayGoals.toFixed(1)} goles/partido`)
    if (homeXGA > 1.2 || awayXGA > 1.2) factorsFor.push('Al menos una defensa con tendencia a encajar')
    if (homeGoals < 0.9 && awayGoals < 0.9) factorsAgainst.push('Baja producción ofensiva de ambos')
    if (homeXGA < 0.7 && awayXGA < 0.7) factorsAgainst.push('Defensas sólidas — partido cerrado esperado')
    push({
      id: 'over_1_5',
      label: 'Más de 1.5 goles',
      confidence: c,
      justification: `El motor proyecta ${lambda.toFixed(1)} goles totales (${predH.toFixed(1)}-${predA.toFixed(1)}) con xG combinado de ${(homeXG+awayXG).toFixed(2)}. Probabilidad de superar 1.5 goles: ${(prob*100).toFixed(0)}%.`,
      factors: { for: factorsFor.slice(0, 3), against: factorsAgainst.slice(0, 2) },
    })
  }

  // ── MÁS DE 2.5 GOLES ─────────────────────────────────────────────────────
  {
    const lambda = predH + predA
    const prob = poissonOver(lambda, 2)
    const totalXG = homeXG + awayXG
    const boost = totalXG > 3.0 ? 1.04 : totalXG < 2.0 ? 0.95 : 1.0
    const c = cap(prob * 100 * boost)
    const factorsFor: string[] = []
    const factorsAgainst: string[] = []
    if (totalXG > 3.0) factorsFor.push(`xG combinado muy alto (${totalXG.toFixed(2)})`)
    if (homeGoals + awayGoals > 2.8) factorsFor.push(`Media combinada de ${(homeGoals+awayGoals).toFixed(1)} goles/partido`)
    if (homeXGA > 1.3 && awayXGA > 1.3) factorsFor.push('Ambas defensas encajan con regularidad')
    if (totalXG < 2.2) factorsAgainst.push(`xG combinado moderado (${totalXG.toFixed(2)})`)
    if (homeXGA < 0.8 || awayXGA < 0.8) factorsAgainst.push('Al menos una defensa muy sólida limita el marcador')
    push({
      id: 'over_2_5',
      label: 'Más de 2.5 goles',
      confidence: c,
      justification: `Con ${lambda.toFixed(1)} goles proyectados y xG combinado de ${(homeXG+awayXG).toFixed(2)}, el motor estima ${(prob*100).toFixed(0)}% de probabilidad de superar 2.5 goles.`,
      factors: { for: factorsFor.slice(0, 3), against: factorsAgainst.slice(0, 2) },
    })
  }

  // ── MÁS DE 3.5 GOLES ─────────────────────────────────────────────────────
  {
    const lambda = predH + predA
    const prob = poissonOver(lambda, 3)
    const c = cap(prob * 100)
    const totalXG = homeXG + awayXG
    const factorsFor: string[] = []
    const factorsAgainst: string[] = []
    if (totalXG > 3.5) factorsFor.push(`xG combinado muy elevado (${totalXG.toFixed(2)})`)
    if (homeGoals + awayGoals > 3.2) factorsFor.push(`Media combinada de ${(homeGoals+awayGoals).toFixed(1)} goles/partido`)
    if (totalXG < 3.0) factorsAgainst.push(`xG combinado (${totalXG.toFixed(2)}) no sustenta 4+ goles`)
    push({
      id: 'over_3_5',
      label: 'Más de 3.5 goles',
      confidence: c,
      justification: `Con ${lambda.toFixed(1)} goles proyectados, el motor estima ${(prob*100).toFixed(0)}% de probabilidad de superar 3.5 goles en el partido.`,
      factors: { for: factorsFor.slice(0, 3), against: factorsAgainst.slice(0, 2) },
    })
  }

  // ── AMBOS MARCAN ─────────────────────────────────────────────────────────
  {
    const pH = poissonAtLeastOne(predH)
    const pA = poissonAtLeastOne(predA)
    const prob = pH * pA
    const boost = homeXG > 1.0 && awayXG > 0.8 ? 1.02 : 1.0
    const c = cap(prob * 100 * boost)
    const factorsFor: string[] = []
    const factorsAgainst: string[] = []
    if (homeXG > 1.2 && awayXG > 1.0) factorsFor.push(`Ambos generan xG elevado (${homeXG.toFixed(2)} y ${awayXG.toFixed(2)})`)
    if (homeGoals > 1.2) factorsFor.push(`${homeName} marca en casi todos sus partidos`)
    if (awayGoals > 1.0) factorsFor.push(`${awayName} también suele anotar (${awayGoals.toFixed(1)}/p)`)
    if (homeXGA > 1.0) factorsFor.push('La defensa local encaja con regularidad')
    if (predA < 0.7) factorsAgainst.push(`El motor proyecta solo ${predA.toFixed(1)} goles para el visitante`)
    if (awayXG < 0.8) factorsAgainst.push(`${awayName} genera pocas ocasiones (xG: ${awayXG.toFixed(2)})`)
    push({
      id: 'btts_yes',
      label: 'Ambos equipos marcan',
      confidence: c,
      justification: `Con marcador proyectado ${predH.toFixed(1)}-${predA.toFixed(1)}, el motor estima ${(prob*100).toFixed(0)}% de probabilidad de que ambos anoten (local ${(pH*100).toFixed(0)}% × visitante ${(pA*100).toFixed(0)}%).`,
      factors: { for: factorsFor.slice(0, 3), against: factorsAgainst.slice(0, 2) },
    })
  }

  // ── PORTERÍA A CERO LOCAL ────────────────────────────────────────────────
  {
    const prob = Math.exp(-predA)
    const boost = awayXG < 0.9 ? 1.04 : awayXG > 1.4 ? 0.93 : 1.0
    const c = cap(prob * 100 * boost)
    const factorsFor: string[] = []
    const factorsAgainst: string[] = []
    if (homeXGA < 0.8) factorsFor.push(`Defensa local muy sólida (xGA: ${homeXGA.toFixed(2)})`)
    if (awayXG < 1.0) factorsFor.push(`Ataque visitante limitado (xG: ${awayXG.toFixed(2)})`)
    if (homeConceded < 0.8) factorsFor.push(`${homeName} concede solo ${homeConceded.toFixed(1)} goles/partido`)
    if (awayXG > 1.3) factorsAgainst.push(`${awayName} genera ${awayXG.toFixed(2)} xG/partido — amenaza real`)
    if (awayGoals > 1.3) factorsAgainst.push(`${awayName} promedia ${awayGoals.toFixed(1)} goles/partido`)
    push({
      id: 'cs_home',
      label: `${homeName} portería a cero`,
      confidence: c,
      justification: `Con solo ${predA.toFixed(1)} goles proyectados para ${awayName}, el motor estima ${(prob*100).toFixed(0)}% de probabilidad de que ${homeName} mantenga la portería a cero.`,
      factors: { for: factorsFor.slice(0, 3), against: factorsAgainst.slice(0, 2) },
    })
  }

  // ── PORTERÍA A CERO VISITANTE ────────────────────────────────────────────
  {
    const prob = Math.exp(-predH)
    const boost = homeXG < 0.9 ? 1.04 : homeXG > 1.4 ? 0.93 : 1.0
    const c = cap(prob * 100 * boost)
    const factorsFor: string[] = []
    const factorsAgainst: string[] = []
    if (awayXGA < 0.8) factorsFor.push(`Defensa visitante compacta (xGA: ${awayXGA.toFixed(2)})`)
    if (homeXG < 1.0) factorsFor.push(`Ataque local moderado (xG: ${homeXG.toFixed(2)})`)
    if (awayConceded < 0.8) factorsFor.push(`${awayName} concede solo ${awayConceded.toFixed(1)} goles/partido`)
    if (homeXG > 1.3) factorsAgainst.push(`${homeName} genera ${homeXG.toFixed(2)} xG en casa`)
    if (homeGoals > 1.3) factorsAgainst.push(`${homeName} promedia ${homeGoals.toFixed(1)} goles de local`)
    push({
      id: 'cs_away',
      label: `${awayName} portería a cero`,
      confidence: c,
      justification: `Con ${predH.toFixed(1)} goles proyectados para ${homeName}, el motor estima ${(prob*100).toFixed(0)}% de probabilidad de portería a 0 para ${awayName}.`,
      factors: { for: factorsFor.slice(0, 3), against: factorsAgainst.slice(0, 2) },
    })
  }

  // ── CORNERS ──────────────────────────────────────────────────────────────
  const expectedCorners = homeCorners + awayCorners
  if (expectedCorners > 0) {
    // Más de 8.5
    {
      const prob = poissonOver(expectedCorners, 8)
      const c = cap(prob * 100)
      push({
        id: 'corners_8_5',
        label: 'Más de 8.5 corners',
        confidence: c,
        justification: `La media combinada de corners es ${expectedCorners.toFixed(1)}/partido (${homeName}: ${homeCorners.toFixed(1)}, ${awayName}: ${awayCorners.toFixed(1)}). Probabilidad de superar 8.5: ${(prob*100).toFixed(0)}%.`,
        factors: {
          for: [
            `Media combinada de ${expectedCorners.toFixed(1)} corners/partido`,
            expectedCorners > 10 ? 'Ambos equipos presionan y generan muchos corners' : '',
          ].filter(Boolean),
          against: [
            expectedCorners < 9.5 ? 'Media cerca del umbral — margen estrecho' : '',
          ].filter(Boolean),
        },
      })
    }
    // Más de 9.5
    {
      const prob = poissonOver(expectedCorners, 9)
      const c = cap(prob * 100)
      push({
        id: 'corners_9_5',
        label: 'Más de 9.5 corners',
        confidence: c,
        justification: `Con ${expectedCorners.toFixed(1)} corners esperados, el motor calcula ${(prob*100).toFixed(0)}% de probabilidad de superar 9.5 en el partido.`,
        factors: {
          for: [
            `Media combinada de ${expectedCorners.toFixed(1)} corners/partido`,
            homeCorners > 5 ? `${homeName} genera ${homeCorners.toFixed(1)} corners/partido` : '',
          ].filter(Boolean),
          against: [
            expectedCorners < 10.5 ? 'La media no garantiza superar 9.5 con seguridad' : '',
          ].filter(Boolean),
        },
      })
    }
  }

  // ── TARJETAS AMARILLAS ───────────────────────────────────────────────────
  const expectedYellow = homeYellow + awayYellow
  if (expectedYellow > 0) {
    // Más de 2.5
    {
      const prob = poissonOver(expectedYellow, 2)
      const c = cap(prob * 100)
      push({
        id: 'cards_2_5',
        label: 'Más de 2.5 amarillas',
        confidence: c,
        justification: `La media combinada de amarillas es ${expectedYellow.toFixed(1)}/partido. El motor calcula ${(prob*100).toFixed(0)}% de probabilidad de superar 2.5 tarjetas.`,
        factors: {
          for: [
            `Media combinada de ${expectedYellow.toFixed(1)} amarillas/partido`,
            expectedYellow > 3.5 ? 'Partido físico con alta intensidad esperada' : '',
          ].filter(Boolean),
          against: [expectedYellow < 2.8 ? 'Media cerca del umbral — poco margen' : ''].filter(Boolean),
        },
      })
    }
    // Más de 3.5
    {
      const prob = poissonOver(expectedYellow, 3)
      const c = cap(prob * 100)
      push({
        id: 'cards_3_5',
        label: 'Más de 3.5 amarillas',
        confidence: c,
        justification: `Con ${expectedYellow.toFixed(1)} amarillas esperadas, el motor estima ${(prob*100).toFixed(0)}% de probabilidad de superar 3.5 en el partido.`,
        factors: {
          for: [
            `Media combinada de ${expectedYellow.toFixed(1)} amarillas/partido`,
            expectedYellow > 4.0 ? 'Ambos equipos son muy intensos y físicos' : '',
          ].filter(Boolean),
          against: [expectedYellow < 4.0 ? 'Requiere partido muy intenso para superar 3.5' : ''].filter(Boolean),
        },
      })
    }
  }

  // ── COMBINADAS ───────────────────────────────────────────────────────────
  // Local gana + más de 1.5 goles
  if (homeWin >= 0.45) {
    const over15 = poissonOver(predH + predA, 1)
    const prob = homeWin * over15 * 0.88
    const c = cap(prob * 100)
    push({
      id: 'combo_hw_o15',
      label: `${homeName} gana y +1.5 goles`,
      confidence: c,
      justification: `Combinada: victoria local (${(homeWin*100).toFixed(0)}%) más partido con goles (${(over15*100).toFixed(0)}% de >1.5). Probabilidad conjunta estimada: ${(prob*100).toFixed(0)}%.`,
      factors: {
        for: [
          `${homeName} es favorito (${(homeWin*100).toFixed(0)}%)`,
          `${(over15*100).toFixed(0)}% de probabilidad de superar 1.5 goles`,
        ],
        against: [
          homeWin < 0.55 ? 'La victoria local no es segura (< 55%)' : '',
        ].filter(Boolean),
      },
    })
  }

  // Visitante gana + más de 1.5 goles
  if (awayWin >= 0.45) {
    const over15 = poissonOver(predH + predA, 1)
    const prob = awayWin * over15 * 0.88
    const c = cap(prob * 100)
    push({
      id: 'combo_aw_o15',
      label: `${awayName} gana y +1.5 goles`,
      confidence: c,
      justification: `Combinada: victoria visitante (${(awayWin*100).toFixed(0)}%) más partido con goles (${(over15*100).toFixed(0)}% de >1.5). Probabilidad conjunta: ${(prob*100).toFixed(0)}%.`,
      factors: {
        for: [
          `${awayName} es favorito (${(awayWin*100).toFixed(0)}%)`,
          `${(over15*100).toFixed(0)}% de probabilidad de superar 1.5 goles`,
        ],
        against: [
          awayWin < 0.55 ? 'La victoria visitante no es segura' : '',
        ].filter(Boolean),
      },
    })
  }

  return results
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxResults)
}
