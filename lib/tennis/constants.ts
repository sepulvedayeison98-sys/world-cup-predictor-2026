/**
 * DOMINIO TENNIS — constantes del dominio.
 *
 * Tercer dominio de la plataforma (Fútbol · NBA · Tennis), aislado con el
 * mismo patrón probado de la NBA: lib/tennis/ + components/tennis/ +
 * app/tennis/ + services/tennis/. La barrera ESLint (.eslintrc.json)
 * PROHÍBE importar motores/componentes de fútbol o NBA desde aquí, y
 * viceversa. Ver docs/TENNIS_ARCHITECTURE.md.
 */

// Ids deterministas de las competiciones contenedor (migración 053),
// mismo esquema que NBA (12000000-…-000000000012).
export const ATP_COMPETITION_ID = '20000000-0000-4000-8000-000000000020'
export const WTA_COMPETITION_ID = '21000000-0000-4000-8000-000000000021'

/**
 * Versión del motor en producción. tennis-2.0 (2026-07-17): ancla
 * ranking+ELO 40% + superficie 15% + forma 15% + saque/devolución 15% +
 * H2H 10% (+mercado 5% cuando exista fuente). Elegida por ablación medida:
 * 64,00% de precisión, Brier 0,4375, log-loss 0,6264 — mejora a 1.1 en las
 * tres métricas y BATE al ranking puro por primera vez (64,26% vs 64,19%).
 * La espec original (superficie 30% dominante + fatiga) midió peor y se
 * descartó con números; la fatiga (proxy fecha-de-torneo) midió dañina y
 * quedó fuera. 1.1 se conserva para comparación.
 */
export const TENNIS_MODEL_VERSION = 'tennis-2.0'
export const TENNIS_MODEL_VERSION_PREV = 'tennis-1.1'

/**
 * Config del motor por versión (fuente única). Cada versión es un cambio
 * principiado sobre la anterior, medido por backtest walk-forward:
 * · 1.0: base (ELO desde 1500, ranking ratio).
 * · 1.1: + siembra de ELO por ranking (cold-start). ← PRODUCCIÓN.
 * · 1.2: probó el mapeo ranking→prob logarítmico. RECHAZADO por medición:
 *   empeoró 1.1 en las tres métricas (prec 63,95→63,43 %, Brier 0,4400→0,4427,
 *   log-loss 0,6293→0,6324). Se conserva solo para reproducir la comparación;
 *   NO es candidato de producción.
 */
export type TennisRankMapping = 'ratio' | 'logElo'
export const TENNIS_ENGINE_CONFIG: Record<string, { seedFromRanking: boolean; rankMapping: TennisRankMapping }> = {
  'tennis-1.0': { seedFromRanking: false, rankMapping: 'ratio' },
  'tennis-1.1': { seedFromRanking: true, rankMapping: 'ratio' },
  'tennis-1.2': { seedFromRanking: true, rankMapping: 'logElo' },
  // 2.0 usa el motor de factores TENNIS2_WEIGHTS (engine2); la siembra aplica
  // igual y el mapeo de ranking vive en la jerarquía del factor superficie.
  'tennis-2.0': { seedFromRanking: true, rankMapping: 'logElo' },
}

/** Identidad visual del dominio (Fase 2 del plan: icono + color). */
export const TENNIS_ACCENT = '#a3e635' // lima — distinto del esmeralda global y del ámbar NBA
export const TENNIS_ICON = 'Activity'  // lucide; se usa al activar la navegación

export type Tour = 'ATP' | 'WTA'
export type Surface = 'hard' | 'clay' | 'grass' | 'carpet'

export const SURFACE_LABELS: Record<Surface, string> = {
  hard: 'Dura',
  clay: 'Arcilla',
  grass: 'Hierba',
  carpet: 'Moqueta',
}

export const ROUND_LABELS: Record<string, string> = {
  R128: 'Primera ronda', R64: 'Segunda ronda', R32: 'Tercera ronda',
  R16: 'Octavos', QF: 'Cuartos', SF: 'Semifinal', F: 'Final', RR: 'Round Robin',
}

/**
 * Pesos del motor tennis-1.0 (Fase 7 del plan). Definidos aquí como la
 * especificación aprobada; el motor (lib/tennis/engine.ts) los consumirá
 * cuando exista. Suman 1.
 */
export const TENNIS_WEIGHTS = {
  rankingElo: 0.35,
  form: 0.25,
  surface: 0.20,
  headToHead: 0.10,
  market: 0.10,
} as const

/**
 * Pesos del motor tennis-2.0 FINALES, elegidos por ablación medida (ver
 * TENNIS_ARCHITECTURE §motor): la especificación original (superficie 30%
 * dominante + fatiga) midió PEOR que 1.1 y se descartó; ganó la composición
 * "ancla de ranking+ELO + saque/devolución". La fatiga (proxy con fecha de
 * torneo) midió dañina y quedó fuera — al backlog hasta tener fechas/minutos
 * reales por partido. market hoy no tiene fuente → null y renormaliza (las
 * proporciones entre los presentes son exactamente las medidas). Suman 1.
 */
export const TENNIS2_WEIGHTS = {
  rankingElo: 0.40,
  surfaceElo: 0.15,
  form: 0.15,
  serveReturn: 0.15,
  headToHead: 0.10,
  market: 0.05,
} as const
