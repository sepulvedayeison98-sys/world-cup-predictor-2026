'use client'

/**
 * Smart Bets Dashboard — panel presentacional (Fase 7).
 *
 * Renderiza las recomendaciones del Smart Bets Engine (lib/smartBets) con todo
 * lo exigido: recomendación, confianza (score), valor esperado, riesgo, mercado,
 * probabilidad, cuota, justificación y estado (tier) + filtros y ordenamiento.
 *
 * COMPONENTE PURO: recibe las recomendaciones por props; no hace fetch, no
 * calcula probabilidades, no toca el Prediction Engine ni el Smart Bets Engine.
 * Listo para cablear a datos reales en un entorno con render (ver docs/DASHBOARD.md).
 */
import { useMemo, useState } from 'react'
import type { SmartBetRecommendation } from '@/lib/smartBets'
import {
  filterAndSort, formatPct, formatSignedPct, formatOdds,
  RISK_LABEL, TIER_LABEL, RISK_TONE, TIER_TONE, DEFAULT_FILTERS,
  type BoardFilters, type SortKey, type RiskFilter,
} from './present'

const RISK_OPTIONS: { value: RiskFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'bajo', label: 'Bajo' },
  { value: 'medio', label: 'Medio' },
  { value: 'alto', label: 'Alto' },
]
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'score', label: 'Score' },
  { value: 'ev', label: 'Valor esperado' },
  { value: 'odds', label: 'Cuota' },
]

export interface SmartBetsBoardProps {
  recommendations: SmartBetRecommendation[]
  title?: string
}

export function SmartBetsBoard({ recommendations, title = 'Smart Bets' }: SmartBetsBoardProps) {
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS)
  const rows = useMemo(() => filterAndSort(recommendations, filters), [recommendations, filters])

  return (
    <section aria-label={title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{title}</h2>
        <span className="text-[10px] text-zinc-600">{rows.length} de {recommendations.length}</span>
      </div>

      {/* Filtros por riesgo */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Filtrar por riesgo" className="flex items-center gap-1.5">
          {RISK_OPTIONS.map((o) => {
            const active = filters.risk === o.value
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilters((f) => ({ ...f, risk: o.value }))}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  active ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-500">
          Ordenar
          <select
            aria-label="Ordenar recomendaciones"
            value={filters.sort}
            onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as SortKey }))}
            className="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-[11px] text-zinc-200"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {/* Lista */}
      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-6 text-center text-sm text-zinc-500">
          No hay recomendaciones que cumplan el filtro. El motor solo recomienda
          cuando el valor esperado es positivo — mejor nada que una apuesta sin base.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <li
              key={`${r.matchId}-${r.market}`}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-zinc-100">{r.marketLabel}</p>
                  <p className="mono text-[11px] text-zinc-500">
                    {r.bookmaker} · cuota {formatOdds(r.oddsValue)} · modelo {formatPct(r.modelProbability)} vs mercado {formatPct(r.impliedProbability)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${TIER_TONE[r.tier]}`}>
                    {TIER_LABEL[r.tier]}
                  </span>
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${RISK_TONE[r.riskTier]}`}>
                    {RISK_LABEL[r.riskTier]}
                  </span>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 mono text-[11px]">
                <span className="text-emerald-400" title="Valor esperado">EV {formatSignedPct(r.expectedValue)}</span>
                <span className="text-emerald-400" title="Ventaja sobre el mercado">edge {formatSignedPct(r.edge)}</span>
                <span className="text-zinc-400" title="Score compuesto 0-100">score {r.score.toFixed(0)}</span>
                <span className="text-zinc-500" title="Fracción de Kelly sugerida">Kelly {r.kellyStakePct.toFixed(1)}%</span>
              </div>

              {r.reason && <p className="mt-2 text-xs leading-relaxed text-zinc-400">{r.reason}</p>}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[10px] text-zinc-600">
        Probabilidades del Prediction Engine · comparación vs línea de mercado · no es asesoría financiera.
      </p>
    </section>
  )
}
