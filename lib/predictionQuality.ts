/**
 * Honestidad de la predicción: distinguir una lectura del equipo de un
 * prior de arranque.
 *
 * El motor de ligas necesita un calentamiento (`LEAGUE_WARMUP_MATCHES`)
 * antes de que sus números signifiquen algo. Cuando una temporada acaba de
 * empezar, todos los equipos están en el ELO base y sin historial de goles:
 * el motor emite igualmente una predicción, pero es el prior de la liga, no
 * una lectura de esos dos equipos. Medido el 2026-08-17: Premier, Serie A,
 * Bundesliga y Ligue 1 devolvían **la misma probabilidad (44/28/28) en sus
 * 380/306 partidos programados**, con "45 % de confianza" al lado.
 *
 * Mostrar eso con la misma cara que una predicción real incumple la regla
 * #1 (Data First: lo que no se sabe se declara). Este módulo es el criterio
 * único para decidir cuándo hay que declararlo.
 *
 * NO cambia el motor ni las probabilidades: solo etiqueta lo que ya se
 * calcula. Cambiar el motor exigiría un backtest que lo justifique, y la
 * siembra de ELO —el candidato natural— fue medida y RECHAZADA (ver
 * lib/leagueEngine.ts).
 *
 * Módulo puro sin I/O — ver tests/predictionQuality.test.ts.
 */
import { LEAGUE_WARMUP_MATCHES } from '@/lib/leagueEngine'

/** Partidos que necesita un equipo antes de que su predicción diga algo. */
export const PREDICTION_WARMUP = LEAGUE_WARMUP_MATCHES

export interface PredictionWarmup {
  /** true si los dos equipos superaron el calentamiento. */
  warmedUp: boolean
  /** Partidos jugados del que menos tiene: lo que limita la predicción. */
  matchesPlayed: number
}

/**
 * ¿Tiene el modelo base suficiente para este partido?
 *
 * Basta con que UNO de los dos equipos no haya calentado para que la
 * predicción no se sostenga: es el mismo criterio con el que el backtest
 * decide qué partidos NO evalúa (`runLeagueBacktest`), así que la UI y la
 * medición hablan de lo mismo.
 *
 * `null`/`undefined` se tratan como cero partidos: la ausencia de fila en
 * `team_statistics` es exactamente lo que pasa en una temporada recién
 * empezada, y no debe leerse como "sin límite".
 */
export function predictionWarmup(
  homePlayed: number | null | undefined,
  awayPlayed: number | null | undefined,
): PredictionWarmup {
  const home = homePlayed ?? 0
  const away = awayPlayed ?? 0
  const matchesPlayed = Math.min(home, away)
  return { warmedUp: matchesPlayed >= PREDICTION_WARMUP, matchesPlayed }
}

/** Aviso corto para la UI. `null` cuando la predicción sí está respaldada. */
export function coldStartNote(warmup: PredictionWarmup): string | null {
  if (warmup.warmedUp) return null
  return warmup.matchesPlayed === 0
    ? 'Sin partidos jugados esta temporada: el modelo muestra su probabilidad de base, no una lectura de estos equipos.'
    : `Solo ${warmup.matchesPlayed} ${warmup.matchesPlayed === 1 ? 'partido jugado' : 'partidos jugados'} esta temporada: el modelo aún no tiene base suficiente y tira del prior de la liga.`
}

/** Etiqueta breve para tablas, donde no cabe la frase entera. */
export function coldStartBadge(warmup: PredictionWarmup): string | null {
  return warmup.warmedUp ? null : 'Prior de arranque'
}
