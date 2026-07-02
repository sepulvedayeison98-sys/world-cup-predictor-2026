/**
 * Constantes globales de la app.
 */

// Versión del motor de predicción. Fuente única de verdad: se muestra en
// el sidebar, dashboard y predicciones para evitar desincronización.
export const MODEL_VERSION = '1.1.0'

// Etiquetas en español de cada fase del torneo.
export const PHASE_LABELS: Record<string, string> = {
  group:         'Fase de Grupos',
  round_of_32:   'Dieciseisavos de Final',
  round_of_16:   'Octavos de Final',
  quarter_final: 'Cuartos de Final',
  semi_final:    'Semifinales',
  third_place:   'Tercer Puesto',
  final:         'Final',
}
