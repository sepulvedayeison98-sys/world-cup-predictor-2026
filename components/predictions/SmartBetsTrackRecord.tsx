import Link from 'next/link'
import { Check, X, Target, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

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

interface Props {
  totalAnalyzed: number
  totalCorrect: number
  byCategory: CategoryStat[]
  ungradedCount: number
  recent: ResolvedPickRow[]
  pending: PendingMatchRow[]
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
 * Historial de aciertos de Smart Bets AI: panel acumulativo (total
 * analizadas, aciertos, % de efectividad — global y por categoría),
 * el detalle de las resueltas (con su resultado real) y las que están
 * registradas esperando que su partido se juegue. Solo cuenta picks
 * anotados ANTES del partido — nunca reconstruidos con el resultado
 * ya conocido (misma honestidad que el resto de la plataforma).
 */
export function SmartBetsTrackRecord({ totalAnalyzed, totalCorrect, byCategory, ungradedCount, recent, pending }: Props) {
  const pct = totalAnalyzed > 0 ? (totalCorrect / totalAnalyzed) * 100 : null
  const pendingPickCount = pending.reduce((s, m) => s + m.picks.length, 0)
  const nothingYet = totalAnalyzed === 0 && pending.length === 0

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

          {/* Últimas resueltas */}
          {recent.length > 0 && (
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
          )}

          {/* Registradas esperando resultado */}
          {pending.length > 0 && (
            <div className="border-t border-zinc-800">
              <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <Clock className="h-3 w-3" /> Registradas · esperan resultado
              </div>
              <ul className="divide-y divide-zinc-800/60">
                {pending.map((m) => (
                  <li key={m.match_id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/matches/${m.match_id}`} className="text-sm font-medium text-zinc-200 hover:text-emerald-400">
                        {m.home_code} vs {m.away_code}
                      </Link>
                      <span className="shrink-0 text-[11px] text-zinc-600">
                        {new Date(m.kickoff_time).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
            </div>
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
