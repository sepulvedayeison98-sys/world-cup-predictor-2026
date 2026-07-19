/**
 * Métricas de calibración del modelo (vitrina de transparencia en /inteligencia).
 * Módulo puro, testeable. Trabaja sobre predicciones resueltas reales: la
 * probabilidad 1X2 publicada y el resultado real (`actual_outcome`). Cero
 * datos fabricados — si no hay resueltas, todo devuelve null/vacío.
 */

export type Outcome = 'home' | 'draw' | 'away'

export interface CalibPrediction {
  home: number
  draw: number
  away: number
  outcome: Outcome | null // resultado real; null = no resuelto (se ignora)
}

/**
 * Brier multiclase (1X2): promedio de Σ_c (p_c − y_c)² sobre las 3 clases,
 * con y one-hot del resultado real. 0 = perfecto; peor cuanto más alto.
 */
export function brierScore(preds: CalibPrediction[]): number | null {
  const resolved = preds.filter((p) => p.outcome)
  if (!resolved.length) return null
  let sum = 0
  for (const p of resolved) {
    const yh = p.outcome === 'home' ? 1 : 0
    const yd = p.outcome === 'draw' ? 1 : 0
    const ya = p.outcome === 'away' ? 1 : 0
    sum += (p.home - yh) ** 2 + (p.draw - yd) ** 2 + (p.away - ya) ** 2
  }
  return sum / resolved.length
}

/**
 * Línea base de Brier prediciendo siempre 1/3·1/3·1/3 (azar 1X2):
 * Σ = (1/3)²·2 + (2/3)² = 2/9 + 4/9 = 6/9 ≈ 0.667. Referencia a batir.
 */
export const BRIER_CHANCE_1X2 = 2 / 3

/** Log-loss multiclase (penaliza la sobreconfianza). Menor = mejor. */
export function logLoss(preds: CalibPrediction[]): number | null {
  const resolved = preds.filter((p) => p.outcome)
  if (!resolved.length) return null
  const eps = 1e-12
  let sum = 0
  for (const p of resolved) {
    const pc = p.outcome === 'home' ? p.home : p.outcome === 'away' ? p.away : p.draw
    sum += -Math.log(Math.min(1, Math.max(eps, pc)))
  }
  return sum / resolved.length
}

/** Precisión 1X2: acierta si el resultado más probable fue el real. */
export function accuracy(preds: CalibPrediction[]): { correct: number; total: number; pct: number | null } {
  const resolved = preds.filter((p) => p.outcome)
  let correct = 0
  for (const p of resolved) {
    const max = Math.max(p.home, p.draw, p.away)
    const pick: Outcome = max === p.home ? 'home' : max === p.away ? 'away' : 'draw'
    if (pick === p.outcome) correct++
  }
  return { correct, total: resolved.length, pct: resolved.length ? correct / resolved.length : null }
}

export interface CalibrationBucket {
  label: string
  from: number
  to: number
  midpoint: number    // probabilidad "prometida" (centro del tramo)
  total: number
  correct: number
  observed: number    // acierto real observado en el tramo
}

/**
 * Curva de calibración: agrupa por probabilidad del favorito y compara lo
 * prometido (centro del tramo) contra lo observado. Un modelo calibrado cae
 * sobre la diagonal (observado ≈ prometido).
 */
export function calibrationBuckets(preds: CalibPrediction[]): CalibrationBucket[] {
  const edges = [0.33, 0.45, 0.55, 0.65, 0.75, 1.0001]
  const buckets: CalibrationBucket[] = edges.slice(0, -1).map((from, i) => {
    const to = edges[i + 1]
    const isLast = i === edges.length - 2
    return {
      label: isLast ? `${Math.round(from * 100)}%+` : `${Math.round(from * 100)}–${Math.round(to * 100)}%`,
      from, to,
      midpoint: isLast ? (from + 0.9) / 2 : (from + to) / 2,
      total: 0, correct: 0, observed: 0,
    }
  })
  for (const p of preds) {
    if (!p.outcome) continue
    const max = Math.max(p.home, p.draw, p.away)
    const pick: Outcome = max === p.home ? 'home' : max === p.away ? 'away' : 'draw'
    const b = buckets.find((x) => max >= x.from && max < x.to)
    if (!b) continue
    b.total++
    if (pick === p.outcome) b.correct++
  }
  for (const b of buckets) b.observed = b.total ? b.correct / b.total : 0
  return buckets
}

/**
 * Expected Calibration Error (ECE): media —ponderada por tamaño de tramo— de la
 * brecha |observado − prometido| sobre la curva de calibración. 0 = perfectamente
 * calibrado. Es el diagnóstico de "cuando digo 60%, ¿pasa el 60%?". null si no
 * hay resueltos. (F1 de docs/WEIGHT_TUNING_DESIGN.md.)
 */
export function expectedCalibrationError(preds: CalibPrediction[]): number | null {
  const buckets = calibrationBuckets(preds)
  const n = buckets.reduce((s, b) => s + b.total, 0)
  if (n === 0) return null
  let ece = 0
  for (const b of buckets) {
    if (!b.total) continue
    ece += (b.total / n) * Math.abs(b.observed - b.midpoint)
  }
  return ece
}

export interface CalibrationReport {
  n: number                 // predicciones resueltas evaluadas
  brier: number | null
  logLoss: number | null
  accuracyPct: number | null
  ece: number | null
}

/**
 * Reporte de calibración de una tanda de predicciones resueltas — la función
 * objetivo del tuner (F1/F2) y la vitrina de /inteligencia en un solo objeto.
 * Módulo puro; cero datos fabricados (todo null si no hay resueltos).
 */
export function calibrationReport(preds: CalibPrediction[]): CalibrationReport {
  const a = accuracy(preds)
  return {
    n: a.total,
    brier: brierScore(preds),
    logLoss: logLoss(preds),
    accuracyPct: a.pct,
    ece: expectedCalibrationError(preds),
  }
}
