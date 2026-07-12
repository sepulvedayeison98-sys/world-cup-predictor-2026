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

export const TENNIS_MODEL_VERSION = 'tennis-1.0'

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
