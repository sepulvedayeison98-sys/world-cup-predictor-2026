/**
 * Data Integrity Agent.
 * Responsabilidades: validar información, detectar inconsistencias,
 * detectar datos faltantes, calcular calidad del dataset.
 */

import { assessDataQuality, type DataQualityResult } from '@/lib/intelligence/dataQuality'

export interface DataIntegrityInput {
  prediction: any | null
  homeStats: any | null
  awayStats: any | null
  match: any
  injuries: any[]
  odds: any[]
}

export interface DataIntegrityReport extends DataQualityResult {
  hasMinimumData: boolean
  inconsistencies: string[]
  recommendations: string[]
}

export function runDataIntegrityAgent(input: DataIntegrityInput): DataIntegrityReport {
  const { prediction, homeStats, awayStats, match, injuries, odds } = input

  const homeTeam = match?.home_team
  const awayTeam = match?.away_team

  const inconsistencies: string[] = []
  const recommendations: string[] = []

  // Detectar inconsistencias lógicas
  if (prediction) {
    const probSum = (prediction.home_win_probability ?? 0) +
                    (prediction.draw_probability ?? 0) +
                    (prediction.away_win_probability ?? 0)
    if (Math.abs(probSum - 1) > 0.05) {
      inconsistencies.push(`Probabilidades suman ${(probSum * 100).toFixed(1)}% (esperado ~100%)`)
    }
    if (prediction.confidence_score > 95) {
      inconsistencies.push('Confianza inusualmente alta (>95%) — revisar datos de entrada')
    }
    if ((prediction.predicted_home_score ?? 0) > 6 || (prediction.predicted_away_score ?? 0) > 6) {
      inconsistencies.push('Marcador predicho inusualmente alto — verificar lambdas Poisson')
    }
  }

  // ELO
  const homeElo = homeTeam?.elo_rating ?? 0
  const awayElo = awayTeam?.elo_rating ?? 0
  if (homeElo > 0 && awayElo > 0 && Math.abs(homeElo - awayElo) > 600) {
    inconsistencies.push(`Diferencial de ELO muy alto (${Math.abs(homeElo - awayElo)} pts) — revisar datos`)
  }

  // Recomendaciones
  if (!homeStats?.avg_xg && !awayStats?.avg_xg) {
    recommendations.push('Añadir datos xG mejoraría la precisión del modelo en un 20%')
  }
  if (odds.length < 2) {
    recommendations.push('Añadir cuotas de al menos 2 casas de apuestas para consenso de mercado')
  }
  if (injuries.length === 0) {
    recommendations.push('Verificar estado de lesiones del plantel antes del partido')
  }

  const quality = assessDataQuality({
    homeElo,
    awayElo,
    homeXg: homeStats?.avg_xg,
    awayXg: awayStats?.avg_xg,
    homeForm: homeStats?.form ?? homeTeam?.form,
    awayForm: awayStats?.form ?? awayTeam?.form,
    oddsCount: odds.length,
    injuriesChecked: true,
    homeCorners: homeStats?.avg_corners,
    awayCorners: awayStats?.avg_corners,
    sources: odds.length > 0 ? ['supabase', 'the_odds_api'] : ['supabase'],
  })

  const hasMinimumData = quality.score >= 40 && (homeElo > 0 || (homeStats?.avg_xg ?? 0) > 0)

  return {
    ...quality,
    hasMinimumData,
    inconsistencies,
    recommendations,
  }
}
