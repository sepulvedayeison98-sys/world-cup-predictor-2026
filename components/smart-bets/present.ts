/**
 * Smart Bets · capa de PRESENTACIÓN (lógica pura, sin JSX).
 *
 * Filtra, ordena y formatea las recomendaciones que produce el Smart Bets Engine
 * (lib/smartBets) para el Dashboard. Determinista y testeable: no calcula nada
 * del dominio (no genera probabilidades ni EV) — solo presenta lo que el motor
 * ya decidió. Ver docs/DASHBOARD.md y docs/SMART_BETS_ENGINE.md.
 */
import type { SmartBetRecommendation, RiskTier, RecommendationTier } from '@/lib/smartBets'

export type SortKey = 'score' | 'ev' | 'odds'
export type RiskFilter = RiskTier | 'todos'

export interface BoardFilters {
  risk: RiskFilter
  sort: SortKey
}

export const DEFAULT_FILTERS: BoardFilters = { risk: 'todos', sort: 'score' }

/** Orden determinista según la clave elegida; desempate estable por mercado. */
export function filterAndSort(
  recs: SmartBetRecommendation[],
  filters: BoardFilters = DEFAULT_FILTERS,
): SmartBetRecommendation[] {
  const filtered = filters.risk === 'todos'
    ? recs
    : recs.filter((r) => r.riskTier === filters.risk)

  const key = filters.sort
  const value = (r: SmartBetRecommendation) =>
    key === 'ev' ? r.expectedValue : key === 'odds' ? r.oddsValue : r.score

  return [...filtered].sort((a, b) =>
    (value(b) - value(a)) || (a.market < b.market ? -1 : a.market > b.market ? 1 : 0),
  )
}

// ── Formateo (presentación pura) ──────────────────────────────────────────────
export const formatPct = (x: number): string => `${(x * 100).toFixed(1)}%`
export const formatSignedPct = (x: number): string => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`
export const formatOdds = (x: number): string => x.toFixed(2)

export const RISK_LABEL: Record<RiskTier, string> = {
  bajo: 'Riesgo bajo', medio: 'Riesgo medio', alto: 'Riesgo alto',
}
export const TIER_LABEL: Record<RecommendationTier, string> = {
  premium: 'Premium', fuerte: 'Fuerte', moderada: 'Moderada', descartada: 'Descartada',
}

/** Tokens Tailwind del tema oscuro/esmeralda (consistencia visual centralizada). */
export const RISK_TONE: Record<RiskTier, string> = {
  bajo: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  medio: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  alto: 'text-red-400 border-red-500/30 bg-red-500/10',
}
export const TIER_TONE: Record<RecommendationTier, string> = {
  premium: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  fuerte: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/5',
  moderada: 'text-zinc-300 border-zinc-700 bg-zinc-800/60',
  descartada: 'text-zinc-500 border-zinc-800 bg-zinc-900',
}
