'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, X, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatColDateTime } from '@/lib/datetime'

export interface ResolvedPickRow {
  id: string
  match_id: string
  market_id: string
  category: string
  label: string
  rank: number
  confidence: number
  gradable: boolean
  correct: boolean | null
  actual_detail: string | null
  resolved_at: string
  home_code: string
  away_code: string
  home_name: string
  away_name: string
}

export interface PendingMatchRow {
  match_id: string
  home_code: string
  away_code: string
  kickoff_time: string
  picks: { id: string; label: string; category: string; confidence: number }[]
}

export interface CategoryStat {
  category: string
  analyzed: number
  correct: number
}

/**
 * Categoría que aparece mucho entre las recomendaciones y mide mal.
 * Un umbral por confianza no protege de esto: hoy «portería» pone 695
 * recomendaciones por encima del 75% con confianza media de 85 y un acierto
 * histórico del 20%. Filtrar por confianza CONCENTRA la peor categoría en vez
 * de descartarla, así que el aviso tiene que estar donde se leen los picks.
 */
export interface CategoryWarning {
  category: string
  analyzed: number
  /** Acierto medido, en %. */
  pct: number
  /** Confianza media que declara en las recomendaciones listadas, en %. */
  claimed: number
  pending: number
}

/** Rendimiento histórico del tramo de confianza que se está mostrando. */
export interface HighBandStat {
  threshold: number
  analyzed: number
  correct: number
}

interface Props {
  totalAnalyzed: number
  totalCorrect: number
  byCategory: CategoryStat[]
  ungradedCount: number
  recent: ResolvedPickRow[]
  pending: PendingMatchRow[]
  highBand: HighBandStat
  categoryWarnings: CategoryWarning[]
}

const CATEGORY_LABEL: Record<string, string> = {
  resultado: 'Resultado',
  goles: 'Goles',
  porteria: 'Portería',
  corners: 'Córners',
  tarjetas: 'Tarjetas',
  combinada: 'Combinada',
}

function EffectivenessBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
      <div
        className={cn('h-full rounded-full', pct >= 50 ? 'bg-emerald-500' : 'bg-red-500/70')}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  )
}

/**
 * Historial de aciertos de Smart Bets AI.
 *
 * Arriba, el panel acumulativo (analizadas, aciertos, % global y por
 * categoría). Debajo, dos pestañas.
 *
 * ── Por qué pestañas, y por qué «Pendientes» primero ─────────────────────
 * Antes las resueltas iban arriba y las pendientes al fondo de la tarjeta.
 * Con los datos reales eso deja lo útil enterrado: hay 781 recomendaciones
 * esperando en 234 partidos frente a 61 ya resueltas en 14. Quien abre esta
 * página viene a ver en qué apostar, no a repasar lo de la semana pasada.
 *
 * Lo resuelto no se esconde —es la prueba de que el track record es real—
 * pero pasa a su propia pestaña. Si aún no hay nada pendiente, la pestaña
 * de resultados se abre sola: una pestaña vacía por defecto sería absurda.
 *
 * Solo cuenta picks anotados ANTES del partido — nunca reconstruidos con el
 * resultado ya conocido (misma honestidad que el resto de la plataforma).
 */
/** Partidos pendientes que se listan antes de plegar el resto en un contador. */
const PENDING_VISIBLE = 25

export function SmartBetsTrackRecord({ totalAnalyzed, totalCorrect, byCategory, ungradedCount, recent, pending, highBand, categoryWarnings }: Props) {
  const pct = totalAnalyzed > 0 ? (totalCorrect / totalAnalyzed) * 100 : null
  const pendingPickCount = pending.reduce((s, m) => s + m.picks.length, 0)
  const nothingYet = totalAnalyzed === 0 && pending.length === 0

  // Pendientes por defecto; si no hay ninguno, abrir directamente resultados.
  const [tab, setTab] = useState<'pendientes' | 'resultados'>(
    pending.length > 0 ? 'pendientes' : 'resultados',
  )
  const pendingShown = pending.slice(0, PENDING_VISIBLE)
  const pendingHidden = pending.length - pendingShown.length

  const TabButton = ({ id, label, count }: { id: typeof tab; label: string; count: number }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      aria-current={tab === id ? 'page' : undefined}
      className={cn(
        'flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors',
        tab === id
          ? 'border-emerald-500 text-emerald-400'
          : 'border-transparent text-zinc-500 hover:text-zinc-300',
      )}
    >
      {label}
      <span className={cn('mono text-[10px]', tab === id ? 'text-emerald-500/70' : 'text-zinc-600')}>
        {count}
      </span>
    </button>
  )

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Historial de aciertos</h2>
        </div>
        <span className="text-[10px] text-zinc-600">Top-5 por partido, registrado antes de jugarse</span>
      </div>

      {nothingYet ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-zinc-300">Aún no hay recomendaciones registradas</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
            En cuanto haya partidos programados con predicción, el motor
            registrará su top-5 aquí y lo resolverá al terminar cada partido.
          </p>
        </div>
      ) : (
        <>
          {/* Panel acumulativo */}
          <div className="grid grid-cols-2 gap-3 border-b border-zinc-800 p-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] text-zinc-500">Analizadas</p>
              <p className="text-2xl font-bold mono text-white">{totalAnalyzed}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Acertadas</p>
              <p className="text-2xl font-bold mono text-emerald-400">{totalCorrect}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Falladas</p>
              <p className="text-2xl font-bold mono text-red-400">{totalAnalyzed - totalCorrect}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Efectividad</p>
              <p className={cn('text-2xl font-bold mono',
                pct === null ? 'text-zinc-600' : pct >= 50 ? 'text-emerald-400' : 'text-red-400')}>
                {pct === null ? '—' : `${pct.toFixed(1)}%`}
              </p>
            </div>
          </div>

          {/* Aviso cuando aún no hay resueltas pero sí registradas */}
          {totalAnalyzed === 0 && pendingPickCount > 0 && (
            <div className="border-b border-zinc-800 bg-zinc-950/50 px-4 py-2.5">
              <p className="text-xs text-zinc-400">
                <span className="font-semibold text-emerald-400">{pendingPickCount} recomendaciones</span> ya
                registradas para {pending.length} {pending.length === 1 ? 'partido' : 'partidos'} por jugarse.
                El % de efectividad aparece en cuanto termine el primero.
              </p>
            </div>
          )}

          {/* Desglose por categoría (solo con resueltas) */}
          {byCategory.length > 0 && (
            <div className="grid grid-cols-1 gap-3 border-b border-zinc-800 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {byCategory.map((c) => {
                const cPct = c.analyzed > 0 ? (c.correct / c.analyzed) * 100 : 0
                return (
                  <div key={c.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-300">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                      <span className="mono text-zinc-500">{c.correct}/{c.analyzed} · {cPct.toFixed(0)}%</span>
                    </div>
                    <EffectivenessBar pct={cPct} />
                  </div>
                )
              })}
            </div>
          )}

          {/* Pestañas: lo accionable primero, lo ya jugado a su propio sitio */}
          <div className="flex border-b border-zinc-800" role="tablist">
            <TabButton id="pendientes" label="Pendientes" count={pending.length} />
            <TabButton id="resultados" label="Resultados" count={recent.length} />
          </div>

          {tab === 'pendientes' && (
            <div className="border-b border-zinc-800 bg-zinc-950/40 px-4 py-2">
              <p className="text-[11px] text-zinc-400">
                Solo recomendaciones con más del{' '}
                <span className="font-semibold text-emerald-400">{highBand.threshold}%</span> de probabilidad
                según el motor.
              </p>
              {/* El umbral se publica junto a lo que ha rendido ESE tramo. Un
                  filtro por confianza sugiere que lo filtrado acierta más; con
                  la muestra que hay, eso está por demostrar y callarlo sería
                  vender una selectividad que los datos aún no respaldan. */}
              <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-600">
                {highBand.analyzed > 0 ? (
                  <>
                    De las {highBand.analyzed} ya resueltas en este tramo acertaron{' '}
                    {highBand.correct} ({((highBand.correct / highBand.analyzed) * 100).toFixed(0)}%).
                    Muestra aún pequeña: no está demostrado que una confianza más alta
                    acierte más.
                  </>
                ) : (
                  <>Todavía no hay resueltas en este tramo con las que medir su acierto.</>
                )}
              </p>
              {categoryWarnings.map((c) => (
                <p key={c.category} className="mt-1.5 text-[11px] leading-relaxed text-amber-400/90">
                  ⚠ <span className="font-semibold">{CATEGORY_LABEL[c.category] ?? c.category}</span>:{' '}
                  {c.pending} de las listadas. Prometen{' '}
                  <span className="mono">{c.claimed}%</span> de media y esta categoría
                  acierta el <span className="mono font-semibold">{c.pct}%</span>{' '}
                  ({c.analyzed} resueltas). Filtrar por confianza no lo corrige.
                </p>
              ))}
            </div>
          )}

          {tab === 'pendientes' && (
            pending.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-zinc-500">
                Ninguna recomendación supera el {highBand.threshold}% de probabilidad
                para los partidos por jugarse.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-zinc-800/60">
                  {pendingShown.map((m) => (
                    <li key={m.match_id} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <Link href={`/matches/${m.match_id}`} className="text-sm font-medium text-zinc-200 hover:text-emerald-400">
                          {m.home_code} vs {m.away_code}
                        </Link>
                        <span className="shrink-0 text-[11px] text-zinc-600">
                          {formatColDateTime(m.kickoff_time)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {m.picks.map((pk) => (
                          <span key={pk.id} className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-400">
                            {pk.label} <span className="text-zinc-600">· {Math.round(pk.confidence)}%</span>
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
                {/* El recorte se declara: 234 partidos en una sola lista no
                    se leen, pero ocultarlos sin decirlo daría una idea falsa
                    de cuánto hay registrado. */}
                {pendingHidden > 0 && (
                  <p className="border-t border-zinc-800 px-4 py-2 text-[11px] text-zinc-600">
                    Se muestran los {PENDING_VISIBLE} partidos más próximos ·
                    {' '}{pendingHidden} más registrados por delante.
                  </p>
                )}
              </>
            )
          )}

          {tab === 'resultados' && (
            recent.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-zinc-500">
                Todavía no hay recomendaciones resueltas. Aparecerán aquí en
                cuanto terminen los primeros partidos.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-800/60">
                {recent.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/matches/${p.match_id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-zinc-800/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-200">
                          <span className="font-medium">{p.label}</span>
                          <span className="ml-2 text-xs text-zinc-500">{p.home_code} vs {p.away_code}</span>
                        </p>
                        <p className="text-[11px] text-zinc-600">
                          {CATEGORY_LABEL[p.category] ?? p.category} · confianza {Math.round(p.confidence)}% · {p.actual_detail}
                        </p>
                      </div>
                      {p.gradable ? (
                        p.correct ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-400">
                            <Check className="h-4 w-4" /> Acertó
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-red-400">
                            <X className="h-4 w-4" /> Falló
                          </span>
                        )
                      ) : (
                        <span className="shrink-0 text-[11px] text-zinc-600">sin datos</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )
          )}

          <p className="border-t border-zinc-800 px-4 py-2.5 text-[11px] text-zinc-600">
            {ungradedCount > 0 && `${ungradedCount} recomendaciones de córners/tarjetas sin estadísticas oficiales quedan fuera del % (no se pueden verificar). `}
            El % de efectividad crece con cada partido que termina — es el mismo criterio de honestidad de Inteligencia.
          </p>
        </>
      )}
    </div>
  )
}
