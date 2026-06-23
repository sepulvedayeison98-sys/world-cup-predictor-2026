/**
 * Motor de calidad de datos.
 * Evalúa la completitud, frescura y fiabilidad de los datos disponibles
 * para un partido antes de generar predicciones.
 */

export type ReliabilityTier = 'excelente' | 'alta' | 'media' | 'baja'

export interface DataQualityInput {
  homeElo?: number | null
  awayElo?: number | null
  homeXg?: number | null
  awayXg?: number | null
  homeForm?: string[] | null
  awayForm?: string[] | null
  oddsCount?: number        // cuántas cuotas disponibles
  injuriesChecked?: boolean
  homeCorners?: number | null
  awayCorners?: number | null
  oddsAgeHours?: number     // antigüedad de las últimas cuotas en horas
  statsAgeHours?: number    // antigüedad de estadísticas en horas
  injuriesAgeHours?: number // antigüedad de datos de lesiones en horas
  sources?: string[]
}

export interface DataQualityResult {
  score: number              // 0..100
  tier: ReliabilityTier
  fieldsPresent: Record<string, boolean>
  dataAgeHours: Record<string, number>
  sourcesUsed: string[]
  missingFields: string[]
  warnings: string[]
}

function r(x: number): number { return Math.round(x * 10) / 10 }

export function assessDataQuality(input: DataQualityInput): DataQualityResult {
  let score = 0
  const fieldsPresent: Record<string, boolean> = {}
  const dataAgeHours: Record<string, number> = {}
  const missingFields: string[] = []
  const warnings: string[] = []

  // ELO — 20 pts
  const hasElo = (input.homeElo ?? 0) > 0 && (input.awayElo ?? 0) > 0
  fieldsPresent.elo = hasElo
  if (hasElo) score += 20
  else missingFields.push('elo')

  // xG — 20 pts
  const hasXg = (input.homeXg ?? 0) > 0 && (input.awayXg ?? 0) > 0
  fieldsPresent.xg = hasXg
  if (hasXg) score += 20
  else missingFields.push('xg')

  // Forma reciente — 15 pts (bonus por profundidad)
  const homeFormLen = input.homeForm?.length ?? 0
  const awayFormLen = input.awayForm?.length ?? 0
  const hasForm = homeFormLen >= 3 && awayFormLen >= 3
  fieldsPresent.form = hasForm
  if (hasForm) {
    score += homeFormLen >= 8 && awayFormLen >= 8 ? 15 : 10
  } else {
    missingFields.push('form')
  }

  // Cuotas / Mercado — 15 pts
  const oddsCount = input.oddsCount ?? 0
  fieldsPresent.odds = oddsCount > 0
  if (oddsCount >= 3) score += 15
  else if (oddsCount > 0) score += 8
  else missingFields.push('odds')
  if (oddsCount > 0 && input.oddsAgeHours != null) {
    dataAgeHours.odds = r(input.oddsAgeHours)
    if (input.oddsAgeHours > 48) warnings.push('Cuotas con más de 48h de antigüedad')
  }

  // Lesiones revisadas — 10 pts
  fieldsPresent.injuries = input.injuriesChecked ?? false
  if (input.injuriesChecked) score += 10
  else missingFields.push('injuries')
  if (input.injuriesAgeHours != null) dataAgeHours.injuries = r(input.injuriesAgeHours)

  // Estadísticas avanzadas (corners, tarjetas) — 10 pts
  const hasAdvStats = (input.homeCorners ?? 0) > 0 && (input.awayCorners ?? 0) > 0
  fieldsPresent.advanced_stats = hasAdvStats
  if (hasAdvStats) score += 10
  if (input.statsAgeHours != null) {
    dataAgeHours.stats = r(input.statsAgeHours)
    if (input.statsAgeHours > 72) warnings.push('Estadísticas con más de 72h de antigüedad')
  }

  // Bonus por múltiples fuentes — hasta +10
  const sourcesUsed = input.sources ?? ['supabase']
  if (sourcesUsed.length >= 2) score += 5
  if (sourcesUsed.length >= 3) score += 5

  const finalScore = Math.min(100, Math.max(0, score))

  let tier: ReliabilityTier
  if (finalScore >= 95) tier = 'excelente'
  else if (finalScore >= 90) tier = 'alta'
  else if (finalScore >= 80) tier = 'media'
  else tier = 'baja'

  return {
    score: finalScore,
    tier,
    fieldsPresent,
    dataAgeHours,
    sourcesUsed,
    missingFields,
    warnings,
  }
}

export const TIER_LABEL: Record<ReliabilityTier, string> = {
  excelente: 'Excelente',
  alta:      'Alta',
  media:     'Media',
  baja:      'Baja',
}

export const TIER_COLOR: Record<ReliabilityTier, { text: string; bg: string; border: string }> = {
  excelente: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  alta:      { text: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30'    },
  media:     { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   },
  baja:      { text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30'     },
}
