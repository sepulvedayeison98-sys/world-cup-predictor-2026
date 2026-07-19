/**
 * Prediction Engine · TUNER DE PESOS (Learning Engine, modo "propone").
 *
 * F2 de docs/WEIGHT_TUNING_DESIGN.md. Optimiza los 5 pesos del motor de fútbol
 * para MINIMIZAR el Brier multiclase sobre predicciones resueltas, mediante una
 * búsqueda por coordenadas sobre el símplex (interpretable, sin redes, 100%
 * determinista → repetible).
 *
 * IMPORTANTE — modo "propone": este módulo NO publica nada ni cambia ninguna
 * predicción en vivo. Devuelve un CANDIDATO con su evidencia; la adopción es una
 * decisión versionada y aprobada (F3+). Guardarraíles del diseño incluidos:
 *   · cada peso ∈ [0.05, 0.60], Σ = 1
 *   · ningún peso se mueve > maxStepPerRun (0.05) respecto al actual
 *   · regularización λ·‖w − w_actual‖² (cambios graduales)
 *   · masa mínima y mejora ≥ 2% para marcar el candidato como adoptable
 *   · walk-forward: el llamador pasa solo ejemplos de entrenamiento anteriores
 *     a la ventana de evaluación (este módulo no mira fechas → sin fuga posible)
 *
 * Módulo puro: usa el motor (fachada) y no toca Supabase.
 */
import { computeModelPrediction, DEFAULT_WEIGHTS, type ModelInput, type Weights } from '@/lib/predictionEngine'
import { brierScore, type CalibPrediction, type Outcome } from '@/lib/calibration'

export interface TrainingExample {
  input: ModelInput
  outcome: Outcome // resultado real 1X2
}

export interface TunerOptions {
  /** Masa mínima de resueltos para proponer (diseño: ~80-100). */
  minMass: number
  /** Mejora relativa de Brier para marcar adoptable (diseño: 0.02 = 2%). */
  minImprovement: number
  /** Cota de movimiento por corrida respecto al peso actual (diseño: 0.05). */
  maxStepPerRun: number
  /** Rango admisible de cada peso (diseño: [0.05, 0.60]). */
  bounds: readonly [number, number]
  /** Regularización hacia los pesos actuales (λ·‖w − w0‖²). */
  lambda: number
  /** Paso de la búsqueda por coordenadas. */
  gridStep: number
  /** Tope de pasadas de la búsqueda (determinismo/rendimiento). */
  maxPasses: number
}

export const DEFAULT_TUNER_OPTIONS: TunerOptions = {
  minMass: 80,
  minImprovement: 0.02,
  maxStepPerRun: 0.05,
  bounds: [0.05, 0.60],
  lambda: 0.5,
  gridStep: 0.01,
  maxPasses: 50,
}

export interface WeightCandidate {
  weights: Weights
  brierCurrent: number | null
  brierCandidate: number | null
  improvement: number      // (brierCurrent − brierCandidate) / brierCurrent
  sampleSize: number
  accepted: boolean        // cumple masa mínima y mejora ≥ umbral
  reason: string
}

const KEYS: (keyof Weights)[] = ['xg', 'elo', 'form', 'market', 'news']

function toCalib(examples: TrainingExample[], w: Weights): CalibPrediction[] {
  return examples.map((e) => {
    const r = computeModelPrediction(e.input, w)
    return { home: r.home, draw: r.draw, away: r.away, outcome: e.outcome }
  })
}

/** Brier del motor con un vector de pesos sobre los ejemplos resueltos. */
export function evaluateWeights(examples: TrainingExample[], w: Weights): number | null {
  return brierScore(toCalib(examples, w))
}

function within(w: Weights, base: Weights, o: TunerOptions): boolean {
  for (const k of KEYS) {
    if (w[k] < o.bounds[0] - 1e-9 || w[k] > o.bounds[1] + 1e-9) return false
    if (Math.abs(w[k] - base[k]) > o.maxStepPerRun + 1e-9) return false
  }
  return true
}

function dist2(a: Weights, b: Weights): number {
  return KEYS.reduce((s, k) => s + (a[k] - b[k]) ** 2, 0)
}

/**
 * Propone un vector de pesos ajustado por calibración (modo "propone").
 * Determinista: misma entrada → mismo candidato. No publica nada.
 */
export function tuneWeights(
  examples: TrainingExample[],
  current: Weights = DEFAULT_WEIGHTS,
  options: Partial<TunerOptions> = {},
): WeightCandidate {
  const o = { ...DEFAULT_TUNER_OPTIONS, ...options }
  const brierCurrent = evaluateWeights(examples, current)

  if (examples.length < o.minMass || brierCurrent == null) {
    return {
      weights: current, brierCurrent, brierCandidate: brierCurrent,
      improvement: 0, sampleSize: examples.length, accepted: false,
      reason: examples.length < o.minMass ? 'masa_insuficiente' : 'sin_resueltos',
    }
  }

  // Objetivo regularizado: Brier + λ·‖w − actual‖²
  const objective = (w: Weights): number => {
    const b = evaluateWeights(examples, w)
    return b == null ? Infinity : b + o.lambda * dist2(w, current)
  }

  let best: Weights = { ...current }
  let bestObj = objective(best)

  // Búsqueda por coordenadas: transferir gridStep entre pares de pesos
  // (mantiene Σ = 1 exactamente). Orden fijo → determinista.
  for (let pass = 0; pass < o.maxPasses; pass++) {
    let improved = false
    for (const i of KEYS) {
      for (const j of KEYS) {
        if (i === j) continue
        const cand: Weights = { ...best }
        cand[i] = Math.round((cand[i] + o.gridStep) * 1e6) / 1e6
        cand[j] = Math.round((cand[j] - o.gridStep) * 1e6) / 1e6
        if (!within(cand, current, o)) continue
        const obj = objective(cand)
        if (obj < bestObj - 1e-12) {
          best = cand; bestObj = obj; improved = true
        }
      }
    }
    if (!improved) break
  }

  const brierCandidate = evaluateWeights(examples, best)
  const improvement = brierCurrent > 0 && brierCandidate != null
    ? (brierCurrent - brierCandidate) / brierCurrent
    : 0
  const accepted = improvement >= o.minImprovement

  return {
    weights: best,
    brierCurrent,
    brierCandidate,
    improvement,
    sampleSize: examples.length,
    accepted,
    reason: accepted ? 'candidato_adoptable' : 'mejora_insuficiente',
  }
}
