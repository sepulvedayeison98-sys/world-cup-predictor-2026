import { analyzeMatchTactics, type MatchTacticalAnalysis } from '@/lib/intelligence/tacticalAnalysis'

export interface TacticalIntelligenceReport {
  tactics: MatchTacticalAnalysis
  keyNarratives: string[]
  tacticalEdge: 'home' | 'away' | 'balanced'
  tacticalEdgeNote: string
  pressureAlert: boolean
  pressureAlertNote: string
}

interface TacticalInput {
  homeStats: any | null
  awayStats: any | null
  match: any
}

export function runTacticalIntelligenceAgent({ homeStats, awayStats, match }: TacticalInput): TacticalIntelligenceReport {
  const tactics = analyzeMatchTactics(
    homeStats,
    awayStats,
    match?.home_team?.formation,
    match?.away_team?.formation,
  )

  const { home, away } = tactics

  // Derive key narratives
  const narratives: string[] = []

  // Dominance narrative
  if (tactics.dominantTeam === 'home') {
    narratives.push(`${match?.home_team?.code ?? 'Local'} domina tácticamente: mayor intensidad de ataque y control de zonas clave.`)
  } else if (tactics.dominantTeam === 'away') {
    narratives.push(`${match?.away_team?.code ?? 'Visitante'} tiene ventaja táctica a pesar de jugar fuera.`)
  } else {
    narratives.push('Equilibrio táctico: ningún equipo muestra dominancia clara. El partido puede decidirse en detalles.')
  }

  // Press narrative
  if (home.pressureHigh && !away.pressureHigh) {
    narratives.push(`${match?.home_team?.code ?? 'Local'} aplica presión alta — puede forzar errores del rival en salida.`)
  } else if (away.pressureHigh && !home.pressureHigh) {
    narratives.push(`${match?.away_team?.code ?? 'Visitante'} presiona alto — peligroso para el bloque bajo del local.`)
  } else if (home.pressureHigh && away.pressureHigh) {
    narratives.push('Ambos equipos presionan alto — esperar un partido intenso con pocas fases de posesión tranquila.')
  }

  // Set piece narrative
  if (home.setpieceThreat > 0.65 || away.setpieceThreat > 0.65) {
    const team = home.setpieceThreat >= away.setpieceThreat ? (match?.home_team?.code ?? 'Local') : (match?.away_team?.code ?? 'Visitante')
    narratives.push(`${team} tiene amenaza seria a balón parado — importante en partidos de pocas ocasiones abiertas.`)
  }

  // Form narrative
  const formDiff = Math.abs(home.formScore - away.formScore)
  if (formDiff > 0.2) {
    const better = home.formScore > away.formScore ? (match?.home_team?.code ?? 'Local') : (match?.away_team?.code ?? 'Visitante')
    narratives.push(`${better} llega en mejor forma reciente, lo que puede marcar la diferencia en la intensidad inicial.`)
  }

  // Key battle zone
  if (tactics.keyBattleZone) {
    narratives.push(`Batalla clave: ${tactics.keyBattleZone}`)
  }

  // Tactical edge
  let tacticalEdge: TacticalIntelligenceReport['tacticalEdge']
  let tacticalEdgeNote: string

  const homeScore = home.attackIntensity * 0.4 + home.formScore * 0.3 + (home.pressureHigh ? 0.15 : 0) + home.setpieceThreat * 0.15
  const awayScore = away.attackIntensity * 0.4 + away.formScore * 0.3 + (away.pressureHigh ? 0.15 : 0) + away.setpieceThreat * 0.15
  const diff = homeScore - awayScore

  if (diff > 0.1) {
    tacticalEdge = 'home'
    tacticalEdgeNote = `${match?.home_team?.code ?? 'Local'} tiene ventaja táctica combinada (+${(diff * 100).toFixed(0)}pp).`
  } else if (diff < -0.1) {
    tacticalEdge = 'away'
    tacticalEdgeNote = `${match?.away_team?.code ?? 'Visitante'} tiene ventaja táctica combinada (+${(Math.abs(diff) * 100).toFixed(0)}pp).`
  } else {
    tacticalEdge = 'balanced'
    tacticalEdgeNote = 'Equilibrio táctico — el resultado dependerá más de la ejecución que del plan.'
  }

  // Pressure alert: high press from both sides = chaotic game
  const pressureAlert = !!(home.pressureHigh && away.pressureHigh && home.defensiveBlock < 0.5 && away.defensiveBlock < 0.5)
  const pressureAlertNote = pressureAlert
    ? 'Ambos equipos presionan alto con bloque defensivo bajo — elevada probabilidad de goles y errores.'
    : ''

  return {
    tactics,
    keyNarratives: narratives.slice(0, 4),
    tacticalEdge,
    tacticalEdgeNote,
    pressureAlert,
    pressureAlertNote,
  }
}
