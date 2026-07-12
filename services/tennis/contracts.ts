/**
 * DOMINIO TENNIS — contratos de los servicios de sincronización (Fase 4).
 *
 * Este archivo DEFINE las interfaces de ingesta ATP/WTA; las
 * implementaciones llegan en la Fase 4 cuando la fuente de datos esté
 * confirmada y con clave. Data First: no hay fetches simulados ni datos
 * de ejemplo — un contrato tipado no es un mock, es la especificación
 * que la implementación real debe cumplir.
 *
 * ── Decisión de fuente (documentada en docs/TENNIS_ARCHITECTURE.md) ──
 * · Base histórica (jugadores, rankings, resultados): datasets públicos
 *   de Jeff Sackmann (github.com/JeffSackmann/tennis_atp y tennis_wta),
 *   CSV reales y verificables, actualizados por la comunidad. Gratis.
 * · Calendario/vivo/cuotas: requiere API comercial (api-sports NO cubre
 *   tenis en el plan actual). Decisión de compra pendiente del dueño —
 *   candidatas: API-Tennis, Sportradar, Tennis-Data. Hasta entonces, el
 *   dominio opera con datos históricos verificables (backtesting).
 */
import type { Tour } from '@/lib/tennis/constants'
import type {
  TennisPlayer, TennisRanking, TennisTournament, TennisMatch,
} from '@/lib/tennis/types'

/** Resultado estándar de una corrida de sync (se registra en sync_logs). */
export interface TennisSyncResult {
  ok: boolean
  source: string          // p. ej. 'sackmann_github' | 'api_tennis'
  entity: 'players' | 'rankings' | 'tournaments' | 'matches' | 'stats'
  tour: Tour
  processed: number
  inserted: number
  updated: number
  failed: number
  duration_ms: number
}

/** Contrato del importador de jugadores (upsert por (tour, external_id)). */
export type SyncPlayers = (tour: Tour) => Promise<TennisSyncResult>

/** Contrato del importador de rankings (serie temporal, append-only por fecha). */
export type SyncRankings = (tour: Tour, rankingDate?: string) => Promise<TennisSyncResult>

/** Contrato del importador de torneos de una temporada. */
export type SyncTournaments = (tour: Tour, season: string) => Promise<TennisSyncResult>

/** Contrato del importador de partidos/resultados (idempotente por external_id). */
export type SyncMatches = (tour: Tour, season: string) => Promise<TennisSyncResult>

/**
 * Validación de integridad post-ingesta (Fase 4): toda corrida debe
 * verificar estos invariantes ANTES de dar el sync por bueno.
 */
export interface IntegrityReport {
  orphanRankings: number       // rankings sin jugador
  orphanMatches: number        // partidos sin torneo o sin jugadores
  duplicatePlayers: number     // mismo (tour, external_id) repetido
  matchesWithoutWinnerFinished: number // finished sin winner_id
  ok: boolean
}
export type ValidateIntegrity = () => Promise<IntegrityReport>

/** Filas tal como las produce el parser de la fuente (pre-upsert). */
export interface ParsedPlayerRow extends Omit<TennisPlayer, 'id' | 'elo_rating'> {}
export interface ParsedRankingRow extends Omit<TennisRanking, 'id' | 'player_id'> {
  player_external_id: string
}
export interface ParsedTournamentRow extends Omit<TennisTournament, 'id'> {}
export interface ParsedMatchRow extends Omit<TennisMatch, 'id' | 'tournament_id' | 'p1_id' | 'p2_id' | 'winner_id'> {
  tournament_external_id: string | null
  p1_external_id: string | null
  p2_external_id: string | null
  winner_external_id: string | null
}
