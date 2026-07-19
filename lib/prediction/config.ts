/**
 * Prediction Engine · CONFIGURACIÓN (fútbol).
 *
 * Responsabilidad: única fuente de los parámetros del motor. Separar el "qué
 * valores" del "cómo se calcula" deja el motor preparado para recalibraciones y
 * para el futuro Learning Engine (que ajustará estos números) SIN reescribir la
 * lógica. Todos los valores son los de la versión v1.2.0 — este módulo no cambia
 * ningún resultado, solo los nombra y centraliza.
 *
 * Módulo puro, sin dependencias.
 */

/** Versión del motor. Estrategia de versionado: ver docs/PREDICTION_ENGINE.md.
 *  La persistencia usa `lib/constants.MODEL_VERSION`; ambos deben ir en sincronía
 *  al subir versión. */
export const ENGINE_VERSION = '1.2.0'

/** Pesos del modelo híbrido de 5 factores (suman 1). */
export interface Weights {
  xg: number
  elo: number
  form: number
  market: number
  news: number
}

export const DEFAULT_WEIGHTS: Weights = {
  xg: 0.40,
  elo: 0.25,
  form: 0.15,
  market: 0.10,
  news: 0.10,
}

/**
 * Parámetros del motor. Son las "perillas" tunables; el Learning Engine podrá
 * proponer nuevos valores contra el backtest sin tocar el código de cálculo.
 */
export const ENGINE_PARAMS = {
  /** Correlación de marcadores bajos (Dixon-Coles 1997). Estándar selecciones. */
  dixonColesRho: -0.11,
  /** Cota superior de la rejilla de goles (0..maxGoals por equipo). */
  maxGoals: 8,
  /** Amortiguación de goles en eliminatoria directa (juego más conservador). */
  knockoutDamping: 0.90,
  /** Ventana de "forma reciente" (nº de partidos). */
  formLookback: 10,
  /** Escala del impacto de lesiones → aptitud (fitness = 1 - impacto/escala). */
  injuryScale: 50,
  /** Piso de goles esperados base por equipo. */
  minBaseGoals: 0.2,
  /** Fuerza local combinada acotada a este rango. */
  homeStrengthClamp: [0.05, 0.95] as const,
  /** Goles totales esperados acotados a este rango. */
  totalGoalsClamp: [1, 6] as const,
  /** Lambda (goles esperados por equipo) acotada a este rango. */
  lambdaClamp: [0.15, 5] as const,
  /** Mezcla a nivel de probabilidad. Pesos EXPLÍCITOS (no derivar market como
   *  1 - model: en IEEE-754, 1 - 0.8 = 0.199999…, alteraría el resultado). */
  marketBlend: { model: 0.8, market: 0.2 },
  /** Confianza del resultado (0-100). */
  confidence: {
    base: 60,
    decisivenessCoef: 90,
    injuryPenalty: 0.5,
    clamp: [40, 95] as const,
  },
  /** Umbrales del nivel de confianza 1-5. */
  confidenceLevels: { l5: 85, l4: 75, l3: 65, l2: 55 },
  /** Cruce eliminatorio: la ventaja ELO opera amortiguada en prórroga. */
  knockoutExtraTimeDamping: 0.6,
} as const
