/**
 * Balance/Informe del Mundial (playbook Sofascore, mejora 12) — módulo puro.
 *
 * Recap del desempeño del modelo en el torneo, calculado de predicciones
 * resueltas reales (`was_correct` no nulo). Nada fabricado: si no hay
 * predicciones resueltas, los agregados son 0/—. Se vuelve el "informe
 * final" cuando la final ya se jugó; hasta entonces es el balance en curso.
 */

export interface ReportPrediction {
  match_id: string
  was_correct: boolean | null
  home_win_probability: number
  draw_probability: number
  away_win_probability: number
  confidence_score: number | null
  phase: string | null
  home_name: string
  away_name: string
  home_score: number | null
  away_score: number | null
  kickoff_time: string
}

export interface CalibrationBucket {
  label: string
  from: number
  to: number
  total: number
  correct: number
  hitRate: number
  expectedRate: number
}

export interface MundialReport {
  total: number
  correct: number
  accuracy: number | null
  /** Línea base: acertar siempre al favorito por probabilidad no es trivial;
   *  se reporta el azar 1X2 (33.3%) como referencia mínima */
  chanceBaseline: number
  /** Aciertos de alta convicción (was_correct y mayor probabilidad de favorito) */
  bestCalls: ReportPrediction[]
  /** Fallos de alta convicción (el modelo estaba seguro y falló) */
  worstMisses: ReportPrediction[]
  /** Precisión por fase del torneo */
  byPhase: { phase: string; total: number; correct: number; accuracy: number }[]
  calibration: CalibrationBucket[]
}

function favProb(p: ReportPrediction): number {
  return Math.max(Number(p.home_win_probability), Number(p.draw_probability), Number(p.away_win_probability))
}

export function computeMundialReport(preds: ReportPrediction[]): MundialReport {
  const resolved = preds.filter((p) => p.was_correct != null)
  const correct = resolved.filter((p) => p.was_correct === true).length

  // Ordenar por convicción (probabilidad del favorito) para los destacados
  const byConviction = [...resolved].sort((a, b) => favProb(b) - favProb(a))
  const bestCalls = byConviction.filter((p) => p.was_correct === true).slice(0, 5)
  const worstMisses = byConviction.filter((p) => p.was_correct === false).slice(0, 5)

  // Precisión por fase
  const phaseMap = new Map<string, { total: number; correct: number }>()
  for (const p of resolved) {
    const key = p.phase ?? 'group'
    const e = phaseMap.get(key) ?? { total: 0, correct: 0 }
    e.total++
    if (p.was_correct === true) e.correct++
    phaseMap.set(key, e)
  }
  const byPhase = [...phaseMap.entries()].map(([phase, e]) => ({
    phase, total: e.total, correct: e.correct, accuracy: e.total ? e.correct / e.total : 0,
  }))

  // Calibración por probabilidad del favorito
  const edges = [0.33, 0.5, 0.6, 0.7, 0.8, 1.0001]
  const calibration: CalibrationBucket[] = []
  for (let i = 0; i < edges.length - 1; i++) {
    const isLast = i === edges.length - 2
    calibration.push({
      label: isLast ? `${Math.round(edges[i] * 100)}%+` : `${Math.round(edges[i] * 100)}–${Math.round(edges[i + 1] * 100)}%`,
      from: edges[i], to: edges[i + 1], total: 0, correct: 0, hitRate: 0,
      expectedRate: isLast ? (edges[i] + 0.9) / 2 : (edges[i] + edges[i + 1]) / 2,
    })
  }
  for (const p of resolved) {
    const f = favProb(p)
    const b = calibration.find((x) => f >= x.from && f < x.to)
    if (!b) continue
    b.total++
    if (p.was_correct === true) b.correct++
  }
  for (const b of calibration) b.hitRate = b.total ? b.correct / b.total : 0

  return {
    total: resolved.length,
    correct,
    accuracy: resolved.length ? correct / resolved.length : null,
    chanceBaseline: 1 / 3,
    bestCalls,
    worstMisses,
    byPhase,
    calibration,
  }
}
