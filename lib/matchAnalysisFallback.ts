/**
 * Análisis de fallback determinístico — FUENTE ÚNICA DE VERDAD.
 * Lo usan el servidor (app/api/analysis/match/[id]/route.ts cuando la API
 * de IA no está disponible o se supera el rate limit) y el cliente
 * (AISmartBetsPanel mientras carga o si la petición falla).
 * Lógica pura sin dependencias de red: no duplicar en otros archivos.
 */

export interface GroupContext {
  groupLetter: string   // 'A', 'B', …
  groupName: string     // 'Group A'
  position: number      // 1 = primero, 2 = segundo
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
  otherTeams: string[]  // short_name del resto de equipos del grupo (excl. este)
}

export interface AnalysisContext {
  matchId: string
  homeTeam: { name: string; code: string; fifa_ranking: number; elo_rating: number }
  awayTeam: { name: string; code: string; fifa_ranking: number; elo_rating: number }
  phase: string
  venue: string
  city: string
  weather_condition: string
  weather_temp_celsius: number
  home_rest_days: number
  away_rest_days: number
  homeStats: { avg_xg?: number; avg_xga?: number; avg_goals_scored?: number; avg_goals_conceded?: number; avg_corners?: number; avg_shots?: number }
  awayStats: { avg_xg?: number; avg_xga?: number; avg_goals_scored?: number; avg_goals_conceded?: number; avg_corners?: number; avg_shots?: number }
  homeForm: { result: string; goals_scored: number; goals_conceded: number; opponent_name: string; xg?: number | null }[]
  awayForm: { result: string; goals_scored: number; goals_conceded: number; opponent_name: string; xg?: number | null }[]
  homeInjuries: { name: string; position: string; impact: number }[]
  awayInjuries: { name: string; position: string; impact: number }[]
  prediction: {
    home_win_probability: number
    draw_probability: number
    away_win_probability: number
    predicted_home_score: number
    predicted_away_score: number
    confidence_score: number
  }
  bets: { id: string; label: string; confidence: number; tier: string }[]
  homeGroupContext?: GroupContext
  awayGroupContext?: GroupContext
}

export interface MatchAnalysis {
  tactical: {
    homeStyle: string
    awayStyle: string
    homeStrengths: string
    awayStrengths: string
    homeWeaknesses: string
    awayWeaknesses: string
    keyBattleground: string
    possessionEdge: 'home' | 'away' | 'balanced'
    possessionReason: string
    transitionEdge: 'home' | 'away' | 'balanced'
    transitionReason: string
    firstHalf: string
    secondHalf: string
  }
  context: {
    homeNeed: string
    awayNeed: string
    intensityLevel: 'Muy Alta' | 'Alta' | 'Media' | 'Baja' | 'Muy Baja'
    intensityReason: string
    competitiveDescription: string
  }
  betExplanations: Record<string, string>
  risks: string[]
  conclusion: string
  is_fallback?: boolean
}

export function generateFallbackAnalysis(ctx: Partial<AnalysisContext>): MatchAnalysis {
  const home = ctx.homeTeam?.name ?? 'Local'
  const away = ctx.awayTeam?.name ?? 'Visitante'
  const hw   = Math.round((ctx.prediction?.home_win_probability ?? 0.40) * 100)
  const aw   = Math.round((ctx.prediction?.away_win_probability ?? 0.30) * 100)
  const dr   = Math.round((ctx.prediction?.draw_probability    ?? 0.30) * 100)
  const hXg  = ctx.homeStats?.avg_xg  ?? 1.1
  const aXg  = ctx.awayStats?.avg_xg  ?? 1.1
  const hXga = ctx.homeStats?.avg_xga ?? 1.1
  const aXga = ctx.awayStats?.avg_xga ?? 1.1
  const hCorners = ctx.homeStats?.avg_corners ?? null
  const aCorners = ctx.awayStats?.avg_corners ?? null
  const hShots   = ctx.homeStats?.avg_shots   ?? null
  const aShots   = ctx.awayStats?.avg_shots   ?? null
  const hGoalsAvg = ctx.homeStats?.avg_goals_scored ?? hXg
  const aGoalsAvg = ctx.awayStats?.avg_goals_scored ?? aXg
  const hElo = ctx.homeTeam?.elo_rating ?? 1500
  const aElo = ctx.awayTeam?.elo_rating ?? 1500
  const hRank = ctx.homeTeam?.fifa_ranking ?? 0
  const aRank = ctx.awayTeam?.fifa_ranking ?? 0
  const bets  = ctx.bets ?? []

  // Form
  const hForm = ctx.homeForm ?? []
  const aForm = ctx.awayForm ?? []
  const hN = hForm.length || 1
  const aN = aForm.length || 1
  const hWins   = hForm.filter(m => m.result === 'W').length
  const hDraws  = hForm.filter(m => m.result === 'D').length
  const hLosses = hForm.filter(m => m.result === 'L').length
  const hCS     = hForm.filter(m => m.goals_conceded === 0).length
  const aWins   = aForm.filter(m => m.result === 'W').length
  const aDraws  = aForm.filter(m => m.result === 'D').length
  const aLosses = aForm.filter(m => m.result === 'L').length
  const aCS     = aForm.filter(m => m.goals_conceded === 0).length
  const hCSRate = hCS / hN
  const aCSRate = aCS / aN
  const hAvgG   = hForm.length > 0 ? hForm.reduce((s, m) => s + m.goals_scored, 0) / hN : hGoalsAvg
  const aAvgG   = aForm.length > 0 ? aForm.reduce((s, m) => s + m.goals_scored, 0) / aN : aGoalsAvg

  // Profiles
  const hIsOff  = hXg > 1.55 || (hShots !== null && hShots > 14)
  const hIsDef  = hXga < 1.0 || hCSRate > 0.45
  const hIsCntr = !hIsOff && (hWins / hN) > 0.5
  const hInForm = hWins >= 4 && hN >= 5
  const aIsOff  = aXg > 1.55 || (aShots !== null && aShots > 14)
  const aIsDef  = aXga < 1.0 || aCSRate > 0.45
  const aIsCntr = !aIsOff && (aWins / aN) > 0.5
  const aInForm = aWins >= 4 && aN >= 5

  const eloDiff  = hElo - aElo
  const hFavored = eloDiff > 60
  const aFavored = eloDiff < -60

  // Phase
  const KNOCKOUT = new Set(['round_of_32','round_of_16','quarter_final','semi_final','final','third_place'])
  const phase = ctx.phase ?? 'group'
  const isKnockout = KNOCKOUT.has(phase)
  const phaseLabel: Record<string, string> = {
    group: 'fase de grupos', round_of_32: 'dieciseisavos de final',
    round_of_16: 'octavos de final', quarter_final: 'cuartos de final',
    semi_final: 'semifinal', third_place: 'partido por el tercer puesto', final: 'gran final',
  }
  const phaseName = phaseLabel[phase] ?? phase
  const nextRound: Record<string, string> = {
    round_of_32: 'los octavos de final', round_of_16: 'los cuartos de final',
    quarter_final: 'las semifinales', semi_final: 'la final',
    third_place: 'el tercer puesto del mundo', final: 'el título mundial',
  }
  const nextRoundName = nextRound[phase] ?? 'la siguiente fase'

  // Styles
  const hSB: string[] = []
  if (hIsOff) hSB.push(`ataque prolífico (${hXg.toFixed(2)} xG/pdo${hShots ? `, ${hShots.toFixed(0)} disparos/pdo` : ''})`)
  else if (hIsDef) hSB.push(`solidez defensiva (${hXga.toFixed(2)} xGA/pdo, ${hCS}/${hN} porterías a cero)`)
  if (hIsCntr) hSB.push('transición vertical letal')
  if (hCorners && hCorners > 6) hSB.push(`presión alta con ${hCorners.toFixed(1)} córners/pdo`)
  if (hInForm) hSB.push(`forma exceptional (${hWins}V en ${hN}pj)`)
  const homeStyle = hSB.length > 0
    ? `${home} sustenta su juego en ${hSB.join(', ')}. ${hFavored ? `El diferencial ELO (+${eloDiff} pts) lo convierte en favorito estadístico.` : aFavored ? `Llega como underdog (ELO ${hElo}) con capacidad de sorprender.` : `Equilibrio ELO con ${away} (${hElo} vs ${aElo}).`}`
    : `${home} desarrolla un juego de presión alta con ${hXg.toFixed(2)} xG/pdo, priorizando el control posesional. ${hFavored ? `Su ventaja ELO (${hElo}) refuerza su condición de favorito.` : ''}`

  const aSB: string[] = []
  if (aIsOff) aSB.push(`potencia ofensiva (${aXg.toFixed(2)} xG/pdo${aShots ? `, ${aShots.toFixed(0)} disparos/pdo` : ''})`)
  else if (aIsDef) aSB.push(`estructura defensiva sólida (${aXga.toFixed(2)} xGA/pdo, ${aCS}/${aN} porterías imbatidas)`)
  if (aIsCntr) aSB.push('contragolpe efectivo y transiciones rápidas')
  if (aCorners && aCorners > 6) aSB.push(`presencia en córners (${aCorners.toFixed(1)}/pdo)`)
  if (aInForm) aSB.push(`sólida forma reciente (${aWins}/${aN} victorias)`)
  const awayStyle = aSB.length > 0
    ? `${away} se caracteriza por ${aSB.join(', ')}. ${aFavored ? `Su ventaja ELO (${aElo}) lo sitúa como favorito del modelo.` : `Buscará aprovechar cualquier descuido del local.`}`
    : `${away} apuesta por una estructura compacta concediendo ${aXga.toFixed(2)} xGA/pdo, buscando daño en el contragolpe y la pelota parada.`

  // Strengths
  const hStr: string[] = []
  if (hXg >= 1.7)      hStr.push(`poder ofensivo (${hXg.toFixed(2)} xG/pdo)`)
  else if (hXg >= 1.3) hStr.push(`generación de ocasiones solvente (${hXg.toFixed(2)} xG/pdo)`)
  if (hXga <= 0.9)     hStr.push(`defensa de primer nivel (${hXga.toFixed(2)} xGA/pdo)`)
  if (hCSRate > 0.4)   hStr.push(`portería a cero en ${Math.round(hCSRate * 100)}% de partidos`)
  if (hInForm)         hStr.push(`racha ganadora (${hWins}V en ${hN}pj)`)
  if (hFavored)        hStr.push(`superioridad ELO (+${eloDiff} pts sobre ${away})`)
  if (hRank > 0 && aRank > 0 && hRank < aRank) hStr.push(`mejor rankeado FIFA (#${hRank} vs #${aRank})`)
  if (hStr.length === 0) hStr.push(`equilibrio ofensivo-defensivo (${hXg.toFixed(2)} xG / ${hXga.toFixed(2)} xGA)`)
  const homeStrengths = hStr.slice(0, 3).join('; ') + '.'

  const aStr: string[] = []
  if (aXg >= 1.7)      aStr.push(`producción ofensiva elevada (${aXg.toFixed(2)} xG/pdo)`)
  else if (aXg >= 1.3) aStr.push(`generación de ocasiones solvente (${aXg.toFixed(2)} xG/pdo)`)
  if (aXga <= 0.9)     aStr.push(`solidez defensiva de primer nivel (${aXga.toFixed(2)} xGA/pdo)`)
  if (aCSRate > 0.4)   aStr.push(`portería imbatida en ${Math.round(aCSRate * 100)}% de partidos`)
  if (aInForm)         aStr.push(`excelente forma reciente (${aWins}/${aN} victorias)`)
  if (aFavored)        aStr.push(`ventaja ELO (${Math.abs(eloDiff)} pts sobre ${home})`)
  if (aRank > 0 && hRank > 0 && aRank < hRank) aStr.push(`mejor posición FIFA (#${aRank} vs #${hRank})`)
  if (aIsCntr)         aStr.push('efectividad letal en el contragolpe')
  if (aStr.length === 0) aStr.push(`capacidad de absorber presión y golpear en el momento oportuno`)
  const awayStrengths = aStr.slice(0, 3).join('; ') + '.'

  // Weaknesses
  const hWeak: string[] = []
  if (hXga > 1.5)      hWeak.push(`vulnerabilidad defensiva (${hXga.toFixed(2)} xGA/pdo)`)
  else if (hXga > 1.2) hWeak.push(`defensa mejorable (${hXga.toFixed(2)} xGA/pdo)`)
  if (hXg < 1.0)       hWeak.push(`creación de ocasiones escasa (${hXg.toFixed(2)} xG/pdo)`)
  if (hLosses >= 3)    hWeak.push(`inestabilidad reciente (${hLosses} derrotas en ${hN}pj)`)
  if (hWeak.length === 0) hWeak.push(`puede sufrir si ${away} logra cerrar espacios y explotar el contragolpe`)
  const homeWeaknesses = hWeak.slice(0, 2).join('; ') + '.'

  const aWeak: string[] = []
  if (aXga > 1.5)      aWeak.push(`defensa expuesta (${aXga.toFixed(2)} xGA/pdo)`)
  else if (aXga > 1.2) aWeak.push(`defensa permeable (${aXga.toFixed(2)} xGA/pdo)`)
  if (aXg < 1.0)       aWeak.push(`producción ofensiva insuficiente (${aXg.toFixed(2)} xG/pdo)`)
  if (aLosses >= 3)    aWeak.push(`racha negativa reciente (${aLosses} derrotas en ${aN}pj)`)
  if (aWeak.length === 0) aWeak.push(`depende de errores del rival para crear peligro real`)
  const awayWeaknesses = aWeak.slice(0, 2).join('; ') + '.'

  // Key battleground
  let keyBattleground: string
  if (hIsOff && aIsOff) {
    keyBattleground = `Duelo de ataques: ambos equipos generan más de 1.5 xG/pdo. Con ${(hXg + aXg).toFixed(2)} xG combinados, el primero en marcar tendrá ventaja psicológica decisiva.`
  } else if (hIsDef && aIsDef) {
    keyBattleground = `Máxima contención: ambos equipos conceden menos de 1.0 xGA/pdo. Con ${hCS + aCS} porterías a cero combinadas, un error o córner puede definirlo todo.`
  } else if (hIsOff && !aIsOff) {
    keyBattleground = `El ataque de ${home} (${hXg.toFixed(2)} xG/pdo) contra la resistencia de ${away} (${aXga.toFixed(2)} xGA/pdo). Si ${away} aguanta la primera media hora, el contragolpe puede igualar.`
  } else if (aIsOff && !hIsOff) {
    keyBattleground = `La propuesta ofensiva de ${away} (${aXg.toFixed(2)} xG/pdo) desafía a ${home} (${hXga.toFixed(2)} xGA/pdo). La gestión del marcador en los primeros 30 minutos será determinante.`
  } else if (Math.abs(eloDiff) > 100) {
    const fav2 = hFavored ? home : away
    const dog  = hFavored ? away : home
    keyBattleground = `La diferencia de nivel (${Math.abs(eloDiff)} puntos ELO) favorece a ${fav2}. ${dog} buscará el orden defensivo y el balón parado para el golpe de efecto.`
  } else {
    const cornSum = ((hCorners ?? 5) + (aCorners ?? 5)).toFixed(0)
    keyBattleground = `Partido equilibrado estadísticamente. El mediocampo y las segundas jugadas serán el eje de la disputa. ${Number(cornSum) > 12 ? `El juego de córners (${cornSum} promedio combinado) puede ser el detonante.` : 'La fortaleza mental y la gestión del marcador marcarán la diferencia.'}`
  }

  const possEdge: 'home' | 'away' | 'balanced' = hXg > aXg + 0.35 ? 'home' : aXg > hXg + 0.35 ? 'away' : 'balanced'
  const transEdge: 'home' | 'away' | 'balanced' = hIsCntr ? 'home' : aIsCntr ? 'away' : 'balanced'

  const firstHalf = isKnockout
    ? `Inicio tenso bajo la presión de la eliminación directa. ${hIsOff ? `${home} buscará dominar con su ataque (${hXg.toFixed(2)} xG/pdo).` : 'Los primeros 25 minutos serán de máximo estudio táctico.'} La mentalidad y gestión nerviosa serán clave.`
    : `Arranque dinámico con ${home} intentando imponer su juego. ${hIsDef ? 'El local priorizará la solidez antes de arriesgar.' : `Con ${hXg.toFixed(2)} xG/pdo, ${home} puede hacer daño temprano.`}`
  const secondHalf = `Mayor apertura de espacios${isKnockout ? ' ante la urgencia de decidir la eliminatoria' : ''}. ${hXg + aXg > 2.8 ? `El potencial ofensivo combinado (${(hXg + aXg).toFixed(2)} xG/pdo) sugiere gol en cualquier momento.` : 'Los cambios tácticos y el desgaste físico definirán el ritmo final.'} Los últimos 20 minutos pueden ser decisivos.`

  // Context
  let homeNeed: string, awayNeed: string
  let intensityLevel: 'Muy Alta' | 'Alta' | 'Media' | 'Baja' | 'Muy Baja'
  let intensityReason: string, competitiveDescription: string

  // Group journey narrative helpers
  const homeGrp = ctx.homeGroupContext
  const awayGrp = ctx.awayGroupContext
  function groupJourney(team: string, grp?: GroupContext, xg?: number, xga?: number): string {
    if (!grp) return ''
    const pos = grp.position === 1 ? 'primero' : grp.position === 2 ? 'segundo' : `${grp.position}º`
    const rivals = grp.otherTeams.slice(0, 2).join(' y ')
    const profile = xg !== undefined && xga !== undefined
      ? xg > 1.6 ? ' mostrando un ataque potente' : xga < 1.0 ? ' con una sólida defensa' : xg < 1.0 ? ' pero con dudas en ataque' : xga > 1.4 ? ' aunque con algunas dudas defensivas' : ''
      : ''
    return `${team} llega tras terminar ${pos} en el ${grp.groupName} por delante de ${rivals}${profile} (${grp.won}V-${grp.drawn}E-${grp.lost}D, ${grp.goalsFor}:${grp.goalsAgainst}).`
  }

  if (isKnockout) {
    const hGrpText = groupJourney(home, homeGrp, hXg, hXga)
    const aGrpText = groupJourney(away, awayGrp, aXg, aXga)
    homeNeed = `${home} necesita ganar para avanzar a ${nextRoundName}. La eliminación directa convierte cada acción en un evento de máxima trascendencia.`
    awayNeed = `${away} no tiene margen de error: perder significa la eliminación del Mundial 2026. Todo el torneo se juega en estos 90 minutos.`
    intensityLevel = 'Muy Alta'
    intensityReason = `Eliminatoria directa en ${phaseName} del Mundial 2026: el perdedor queda eliminado sin segunda oportunidad.`
    const grpCtx = [hGrpText, aGrpText].filter(Boolean).join(' ')
    competitiveDescription = `${grpCtx ? grpCtx + ' ' : ''}Es el primer choque eliminatorio: la presión suele reducir el número de goles y aumentar el valor de la experiencia táctica. ${home} vs ${away} en ${phaseName}${ctx.city ? ` (${ctx.city})` : ''}: la fortaleza mental pesa tanto como las estadísticas.`
  } else {
    homeNeed = hw > 60
      ? `${home} necesita la victoria para consolidar su posición en la ${phaseName} y mantener las aspiraciones de clasificación.`
      : `${home} busca sumar en la ${phaseName}; un empate puede ser suficiente según la dinámica del grupo.`
    awayNeed = aw > 60
      ? `${away} requiere los tres puntos para mantener opciones de clasificación en su grupo.`
      : `${away} intentará rescatar al menos un empate que mantenga viva su participación en el Mundial 2026.`
    intensityLevel = hw > 70 || aw > 70 ? 'Alta' : 'Media'
    intensityReason = `La posición en la tabla y las aspiraciones clasificatorias elevan la intensidad de este encuentro de ${phaseName}.`
    competitiveDescription = `Encuentro de ${phaseName} del Mundial 2026${ctx.city ? ` en ${ctx.city}` : ''}. El resultado impactará directamente en las posiciones del grupo y puede definir la clasificación al siguiente ronda.`
  }

  // Bets
  const hFormStr = `${hWins}V-${hDraws}E-${hLosses}D`
  const aFormStr = `${aWins}V-${aDraws}E-${aLosses}D`
  const betExplanations: Record<string, string> = Object.fromEntries(
    bets.map(b => {
      let expl: string
      if (b.id === 'home_win') {
        expl = `${home} genera ${hXg.toFixed(2)} xG/pdo frente a ${aXga.toFixed(2)} xGA de ${away}. ELO ${hElo}${hFavored ? ` (+${eloDiff} pts)` : ''}. Forma: ${hFormStr}. Probabilidad: ${b.confidence}%.`
      } else if (b.id === 'away_win') {
        expl = `${away} genera ${aXg.toFixed(2)} xG/pdo vs ${hXga.toFixed(2)} xGA de ${home}. ELO ${aElo}${aFavored ? ` (+${Math.abs(eloDiff)} pts)` : ''}. Forma: ${aFormStr}. Probabilidad: ${b.confidence}%.`
      } else if (b.id === 'draw') {
        expl = `Probabilidades equilibradas (${hw}%-${dr}%-${aw}%). xG combinado ${(hXg + aXg).toFixed(2)}/pdo sin dominancia clara. Confianza: ${b.confidence}%.`
      } else if (b.id.startsWith('over')) {
        const line = b.id === 'over_1_5' ? '1.5' : b.id === 'over_2_5' ? '2.5' : '3.5'
        expl = `xG combinado ${(hXg + aXg).toFixed(2)}/pdo. ${home}: ${hAvgG.toFixed(1)} goles/pdo (${hN}pj), ${away}: ${aAvgG.toFixed(1)} goles/pdo. Línea: +${line} goles. Confianza: ${b.confidence}%.`
      } else if (b.id === 'btts_yes') {
        const hSR = hForm.length > 0 ? Math.round((hForm.filter(m => m.goals_scored > 0).length / hN) * 100) : 60
        const aSR = aForm.length > 0 ? Math.round((aForm.filter(m => m.goals_scored > 0).length / aN) * 100) : 50
        expl = `${home} marca en ${hSR}% de sus partidos, ${away} en ${aSR}%. xG combinado: ${(hXg + aXg).toFixed(2)}/pdo. Confianza: ${b.confidence}%.`
      } else {
        expl = `xG ${hXg.toFixed(2)} vs ${aXg.toFixed(2)}, ELO ${hElo} vs ${aElo}, forma ${hFormStr} vs ${aFormStr}. Confianza modelo: ${b.confidence}% (tier: ${b.tier}).`
      }
      return [b.id, expl]
    })
  )

  const risks: string[] = []
  if ((ctx.homeInjuries?.length ?? 0) > 0) {
    const names = (ctx.homeInjuries ?? []).slice(0, 2).map(i => i.name).join(', ')
    risks.push(`${home} reporta ${ctx.homeInjuries!.length} baja${ctx.homeInjuries!.length > 1 ? 's' : ''}: ${names}. Puede alterar la estructura táctica.`)
  }
  if ((ctx.awayInjuries?.length ?? 0) > 0) {
    const names = (ctx.awayInjuries ?? []).slice(0, 2).map(i => i.name).join(', ')
    risks.push(`${away} llega con ${ctx.awayInjuries!.length} baja${ctx.awayInjuries!.length > 1 ? 's' : ''}: ${names}.`)
  }
  if (isKnockout) {
    risks.push('La presión psicológica de la eliminación directa puede provocar rendimientos atípicos y decisiones tácticas no habituales.')
  }
  if (risks.length < 3) {
    risks.push('Posibles rotaciones o cambios de alineación no reflejados en las estadísticas pueden alterar los perfiles tácticos proyectados.')
  }

  const favorStr = hw > aw
    ? `${home} emerge como favorito estadístico con ${hw}% de probabilidad, sustentado en ${hXg > aXg ? `mayor xG (${hXg.toFixed(2)} vs ${aXg.toFixed(2)})` : `ventaja ELO (${hElo})`}`
    : aw > hw
      ? `${away} es el favorito del modelo con ${aw}% de probabilidad, apoyado en ${aXg > hXg ? `xG superior (${aXg.toFixed(2)} vs ${hXg.toFixed(2)})` : `ventaja ELO (${aElo})`}`
      : `El modelo ve un partido muy equilibrado (${hw}%-${dr}%-${aw}%) entre ${home} y ${away}`
  const betStr = bets[0]
    ? ` La apuesta de mayor valor detectada es "${bets[0].label}" con ${bets[0].confidence}% de confianza.`
    : ' El modelo no detecta apuestas con valor diferencial claro en este partido.'
  const riskStr = isKnockout
    ? ' Los partidos eliminatorios del Mundial generan variaciones estadísticas difíciles de predecir; la fortaleza mental puede superar las métricas.'
    : ' La variabilidad inherente al fútbol de Mundial recomienda un enfoque conservador en la gestión del riesgo.'

  return {
    tactical: {
      homeStyle, awayStyle,
      homeStrengths, awayStrengths,
      homeWeaknesses, awayWeaknesses,
      keyBattleground,
      possessionEdge: possEdge,
      possessionReason: possEdge === 'home'
        ? `${home} domina el juego posicional con mayor xG (${hXg.toFixed(2)}) y estilo orientado al control.`
        : possEdge === 'away'
          ? `${away} genera más peligro (${aXg.toFixed(2)} xG/pdo) y tiene ventaja en la circulación.`
          : 'Los equipos están equilibrados en la disputa del balón según sus métricas.',
      transitionEdge: transEdge,
      transitionReason: transEdge === 'home'
        ? `${home} es más peligroso en transición rápida, especialmente con espacios abiertos.`
        : transEdge === 'away'
          ? `${away} busca el contragolpe vertical como arma principal ante una defensa comprometida.`
          : 'Ambos equipos presentan capacidades de transición similares.',
      firstHalf, secondHalf,
    },
    context: { homeNeed, awayNeed, intensityLevel, intensityReason, competitiveDescription },
    betExplanations,
    risks: risks.slice(0, 4),
    conclusion: `${favorStr}. ${betStr}${riskStr}`,
    is_fallback: true,
  }
}
