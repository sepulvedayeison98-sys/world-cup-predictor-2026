/**
 * Risk Assessment Agent.
 * Mide incertidumbre, detecta anomalías y riesgos ocultos en los datos
 * y en la predicción antes de publicarla.
 */

export interface RiskInput {
  prediction: any | null
  homeStats: any | null
  awayStats: any | null
  injuries: any[]
  odds: any[]
  match: any
  modelAgreement?: number   // 0..1 del ensemble
}

export type RiskLevel = 'bajo' | 'medio' | 'alto' | 'crítico'

export interface RiskReport {
  level: RiskLevel
  uncertaintyScore: number   // 0..100 (100 = máxima incertidumbre)
  anomalies: string[]
  hiddenRisks: string[]
  summary: string
}

export function runRiskAssessmentAgent(input: RiskInput): RiskReport {
  const { prediction, homeStats, awayStats, injuries, odds, match, modelAgreement = 1 } = input
  const anomalies: string[] = []
  const hiddenRisks: string[] = []
  let riskPoints = 0

  // Acuerdo entre modelos bajo
  if (modelAgreement < 0.5) {
    riskPoints += 25
    anomalies.push('Los modelos predictivos divergen significativamente entre sí')
  } else if (modelAgreement < 0.7) {
    riskPoints += 10
    hiddenRisks.push('Acuerdo moderado entre modelos — predicción con incertidumbre media')
  }

  // Confianza de predicción baja
  const confScore = prediction?.confidence_score ?? 50
  if (confScore < 55) {
    riskPoints += 20
    anomalies.push(`Confianza del modelo baja (${confScore.toFixed(0)}%)`)
  }

  // Probabilidades muy distribuidas (partido muy igualado)
  if (prediction) {
    const maxProb = Math.max(
      prediction.home_win_probability ?? 0,
      prediction.draw_probability ?? 0,
      prediction.away_win_probability ?? 0
    )
    if (maxProb < 0.40) {
      riskPoints += 15
      hiddenRisks.push('Partido muy igualado — ningún resultado supera el 40% de probabilidad')
    }
  }

  // Lesiones de alto impacto
  const criticalInjuries = injuries.filter((inj: any) => (inj.impact_score ?? 0) >= 7)
  if (criticalInjuries.length >= 2) {
    riskPoints += 20
    anomalies.push(`${criticalInjuries.length} bajas críticas (impacto ≥7) pueden alterar el modelo`)
  } else if (criticalInjuries.length === 1) {
    riskPoints += 8
    hiddenRisks.push(`Baja de impacto alto: ${criticalInjuries[0]?.player?.name ?? 'jugador clave'}`)
  }

  // Poco descanso
  const homeRest = match?.home_rest_days
  const awayRest = match?.away_rest_days
  if (homeRest != null && homeRest < 3) {
    riskPoints += 10
    hiddenRisks.push(`Local con solo ${homeRest}d de descanso — fatiga física elevada`)
  }
  if (awayRest != null && awayRest < 3) {
    riskPoints += 10
    hiddenRisks.push(`Visitante con solo ${awayRest}d de descanso — fatiga física elevada`)
  }

  // Clima adverso
  const weather = (match?.weather_condition ?? '').toLowerCase()
  if (/storm|hurricane|tornado/i.test(weather)) {
    riskPoints += 20
    anomalies.push('Condiciones climáticas extremas pueden anular los modelos estadísticos')
  } else if (/rain|wind|drizzle|wet/i.test(weather)) {
    riskPoints += 5
    hiddenRisks.push('Lluvia/viento puede afectar el estilo de juego y reducir goles')
  }

  // Sin cuotas de mercado
  if (odds.length === 0) {
    riskPoints += 10
    hiddenRisks.push('Sin datos de cuotas — factor mercado ausente del modelo')
  }

  // Sin estadísticas avanzadas
  if (!homeStats?.avg_xg && !awayStats?.avg_xg) {
    riskPoints += 15
    hiddenRisks.push('Sin datos xG — modelo Poisson usa valores por defecto')
  }

  const uncertaintyScore = Math.min(100, riskPoints)

  let level: RiskLevel
  if (uncertaintyScore >= 60) level = 'crítico'
  else if (uncertaintyScore >= 40) level = 'alto'
  else if (uncertaintyScore >= 20) level = 'medio'
  else level = 'bajo'

  const summary =
    level === 'bajo'    ? 'Predicción confiable — datos sólidos y modelos alineados.' :
    level === 'medio'   ? 'Riesgo moderado — algunos factores pueden afectar la precisión.' :
    level === 'alto'    ? 'Riesgo elevado — múltiples incertidumbres detectadas. Interpretar con cautela.' :
                          'Riesgo crítico — datos insuficientes o contradictorios. No recomendar apuestas.'

  return { level, uncertaintyScore, anomalies, hiddenRisks, summary }
}

export const RISK_COLOR: Record<RiskLevel, { text: string; bg: string; border: string }> = {
  bajo:    { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  medio:   { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   },
  alto:    { text: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30'  },
  crítico: { text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30'     },
}
