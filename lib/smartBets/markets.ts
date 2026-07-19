/**
 * Smart Bets Engine · REGISTRO DE MERCADOS (extensible, multi-deporte).
 *
 * Cada mercado declara cómo DERIVA su probabilidad de la salida del Prediction
 * Engine — solo por álgebra sobre las probabilidades que el motor ya produjo
 * (nunca se calcula una probabilidad nueva aquí). Los mercados que requieren una
 * distribución que el motor aún no expone (goles, ambos anotan, córners…) quedan
 * REGISTRADOS pero inactivos: el motor de Smart Bets soporta añadirlos sin tocar
 * su arquitectura — solo se activa la entrada cuando el Prediction Engine exponga
 * esa distribución. Así queda preparado para nuevos mercados sin reescritura.
 *
 * Multi-deporte: cada entrada lleva su `sport`. Añadir un deporte = añadir sus
 * entradas aquí (o en un registro por deporte), sin lógica de deporte en el motor.
 */
import type { SportSlug } from '@/lib/sports'
import type { ModelProbabilities } from './types'

export interface MarketDef {
  id: string
  label: string
  sport: SportSlug
  family: string
  active: boolean
  /**
   * Deriva la probabilidad del modelo por ÁLGEBRA sobre las probabilidades del
   * Prediction Engine. `null` = pendiente de que el motor exponga esa
   * distribución (punto de extensión, no se inventa nada).
   */
  probabilityFrom: ((p: ModelProbabilities) => number) | null
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

// ── Fútbol: familia 1X2 (activa — álgebra pura sobre las probs del motor) ──
const FUTBOL_MARKETS: MarketDef[] = [
  { id: 'home_win', label: 'Victoria Local', sport: 'futbol', family: '1x2', active: true, probabilityFrom: (p) => p.home },
  { id: 'draw', label: 'Empate', sport: 'futbol', family: '1x2', active: true, probabilityFrom: (p) => p.draw },
  { id: 'away_win', label: 'Victoria Visitante', sport: 'futbol', family: '1x2', active: true, probabilityFrom: (p) => p.away },
  { id: 'dc_1x', label: 'Doble oportunidad 1X', sport: 'futbol', family: 'double_chance', active: true, probabilityFrom: (p) => clamp01(p.home + p.draw) },
  { id: 'dc_x2', label: 'Doble oportunidad X2', sport: 'futbol', family: 'double_chance', active: true, probabilityFrom: (p) => clamp01(p.draw + p.away) },
  { id: 'dc_12', label: 'Doble oportunidad 12', sport: 'futbol', family: 'double_chance', active: true, probabilityFrom: (p) => clamp01(p.home + p.away) },
  { id: 'dnb_home', label: 'Empate no acción — Local', sport: 'futbol', family: 'dnb', active: true, probabilityFrom: (p) => (p.home + p.away > 0 ? p.home / (p.home + p.away) : 0) },
  { id: 'dnb_away', label: 'Empate no acción — Visitante', sport: 'futbol', family: 'dnb', active: true, probabilityFrom: (p) => (p.home + p.away > 0 ? p.away / (p.home + p.away) : 0) },

  // ── Registrados pero INACTIVOS: requieren que el Prediction Engine exponga
  //    su distribución (rejilla de goles). Punto de extensión, sin inventar. ──
  { id: 'over_1_5', label: 'Más de 1.5 goles', sport: 'futbol', family: 'goals', active: false, probabilityFrom: null },
  { id: 'over_2_5', label: 'Más de 2.5 goles', sport: 'futbol', family: 'goals', active: false, probabilityFrom: null },
  { id: 'over_3_5', label: 'Más de 3.5 goles', sport: 'futbol', family: 'goals', active: false, probabilityFrom: null },
  { id: 'btts_yes', label: 'Ambos anotan: Sí', sport: 'futbol', family: 'btts', active: false, probabilityFrom: null },
  { id: 'btts_no', label: 'Ambos anotan: No', sport: 'futbol', family: 'btts', active: false, probabilityFrom: null },
  { id: 'correct_score', label: 'Marcador correcto', sport: 'futbol', family: 'correct_score', active: false, probabilityFrom: null },
  { id: 'corners_9_5', label: 'Córners +9.5', sport: 'futbol', family: 'corners', active: false, probabilityFrom: null },
  { id: 'cards_3_5', label: 'Tarjetas +3.5', sport: 'futbol', family: 'cards', active: false, probabilityFrom: null },
]

// ── Baloncesto (NBA) y Tenis: puntos de extensión (moneyline por álgebra sobre
//    las probs de SUS motores; se activan cuando se cablee cada deporte). ──
const BALONCESTO_MARKETS: MarketDef[] = [
  { id: 'nba_home', label: 'Moneyline Local', sport: 'baloncesto', family: 'moneyline', active: true, probabilityFrom: (p) => p.home },
  { id: 'nba_away', label: 'Moneyline Visitante', sport: 'baloncesto', family: 'moneyline', active: true, probabilityFrom: (p) => p.away },
]
const TENIS_MARKETS: MarketDef[] = [
  { id: 'tennis_p1', label: 'Ganador — Jugador 1', sport: 'tenis', family: 'moneyline', active: true, probabilityFrom: (p) => p.home },
  { id: 'tennis_p2', label: 'Ganador — Jugador 2', sport: 'tenis', family: 'moneyline', active: true, probabilityFrom: (p) => p.away },
]

export const MARKET_REGISTRY: MarketDef[] = [
  ...FUTBOL_MARKETS, ...BALONCESTO_MARKETS, ...TENIS_MARKETS,
]

export function marketsForSport(sport: SportSlug): MarketDef[] {
  return MARKET_REGISTRY.filter((m) => m.sport === sport)
}

export function getMarket(id: string): MarketDef | undefined {
  return MARKET_REGISTRY.find((m) => m.id === id)
}
