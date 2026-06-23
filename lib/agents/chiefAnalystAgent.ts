/**
 * Chief Analyst Agent.
 * Coordina todos los agentes, resuelve conflictos entre modelos
 * y consolida el análisis final del partido.
 */

import { runDataIntegrityAgent, type DataIntegrityReport } from './dataIntegrityAgent'
import { runPredictionEngineAgent, type PredictionEngineReport } from './predictionEngineAgent'
import { runRiskAssessmentAgent, type RiskReport } from './riskAssessmentAgent'

export interface ChiefAnalystInput {
  prediction: any | null
  homeStats: any | null
  awayStats: any | null
  match: any
  injuries: any[]
  odds: any[]
}

export interface ChiefAnalystReport {
  dataIntegrity: DataIntegrityReport
  predictionEngine: PredictionEngineReport
  riskAssessment: RiskReport
  executiveSummary: string
  topInsights: string[]
  canPublish: boolean   // true si la calidad de datos es suficiente para publicar
}

export function runChiefAnalystAgent(input: ChiefAnalystInput): ChiefAnalystReport {
  const { prediction, homeStats, awayStats, match, injuries, odds } = input

  const homeTeam = match?.home_team
  const awayTeam = match?.away_team
  const homeCode  = homeTeam?.code ?? 'LOC'
  const awayCode  = awayTeam?.code ?? 'VIS'

  // 1. Data Integrity
  const dataIntegrity = runDataIntegrityAgent({ prediction, homeStats, awayStats, match, injuries, odds })

  // 2. Prediction Engine (todos los modelos)
  const predictionEngine = runPredictionEngineAgent(homeStats, awayStats, homeTeam, awayTeam, odds, injuries)

  // 3. Risk Assessment
  const riskAssessment = runRiskAssessmentAgent({
    prediction, homeStats, awayStats, injuries, odds, match,
    modelAgreement: predictionEngine.agreement,
  })

  // 4. Resumen ejecutivo
  const ep = predictionEngine.ensemble.probabilities
  const outcomeLabel =
    predictionEngine.dominantOutcome === 'home' ? `victoria de ${homeCode}` :
    predictionEngine.dominantOutcome === 'away' ? `victoria de ${awayCode}` : 'empate'

  const executiveSummary = [
    `Análisis consolidado: el escenario más probable es ${outcomeLabel}`,
    `(${(Math.max(ep.home, ep.draw, ep.away) * 100).toFixed(0)}% de probabilidad ensemble).`,
    dataIntegrity.score >= 80
      ? `Dataset de calidad ${dataIntegrity.tier} (${dataIntegrity.score.toFixed(0)}/100).`
      : `Dataset incompleto (${dataIntegrity.score.toFixed(0)}/100) — predicción provisional.`,
    riskAssessment.level !== 'bajo'
      ? `Riesgo ${riskAssessment.level} detectado — interpretar con cautela.`
      : 'Condiciones favorables para una predicción confiable.',
  ].join(' ')

  // 5. Top insights
  const topInsights: string[] = []

  if (predictionEngine.agreement > 0.8) {
    topInsights.push(`Alta convergencia entre modelos (${(predictionEngine.agreement * 100).toFixed(0)}%) — señal sólida`)
  }
  if (dataIntegrity.missingFields.includes('xg')) {
    topInsights.push('Sin datos xG: el modelo ELO tiene mayor peso del habitual')
  }
  const criticalInjuries = injuries.filter((i: any) => (i.impact_score ?? 0) >= 7)
  if (criticalInjuries.length > 0) {
    topInsights.push(`${criticalInjuries.length} baja(s) crítica(s) — el modelo puede estar desactualizado`)
  }
  if (riskAssessment.anomalies.length > 0) {
    topInsights.push(riskAssessment.anomalies[0])
  }
  if (dataIntegrity.score >= 90) {
    topInsights.push('Todos los factores clave disponibles — máxima confiabilidad del sistema')
  }

  const canPublish = dataIntegrity.hasMinimumData && riskAssessment.level !== 'crítico'

  return {
    dataIntegrity,
    predictionEngine,
    riskAssessment,
    executiveSummary,
    topInsights: topInsights.slice(0, 4),
    canPublish,
  }
}
