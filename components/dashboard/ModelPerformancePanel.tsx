import { Target, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PHASE_LABELS } from '@/lib/constants'

interface ResolvedPrediction {
  was_correct: boolean
  home_win_probability: number
  draw_probability: number
  away_win_probability: number
  match: {
    phase: string
    home_score: number | null
    away_score: number | null
    home_team: { code: string } | null
    away_team: { code: string } | null
  } | null
}

interface Props {
  resolved: ResolvedPrediction[]
}

/**
 * Rendimiento del modelo: mide SOLO predicciones resueltas (partidos que ya
 * tenían pronóstico guardado antes de jugarse). Honesto por diseño — los
 * partidos sin predicción previa no cuentan. Muestra acierto global, desglose
 * por fase y las últimas resoluciones como evidencia.
 */
export function ModelPerformancePanel({ resolved }: Props) {
  const total = resolved.length
  const hits = resolved.filter(r => r.was_correct).length
  const acc = total > 0 ? hits / total : null

  // Desglose por fase
  const byPhase = new Map<string, { total: number; hits: number }>()
  for (const r of resolved) {
    const ph = r.match?.phase ?? 'group'
    const e = byPhase.get(ph) ?? { total: 0, hits: 0 }
    e.total++
    if (r.was_correct) e.hits++
    byPhase.set(ph, e)
  }

  // Predicción declarada (argmax del 1X2) para mostrar en la evidencia
  function pick(r: ResolvedPrediction): string {
    const h = r.home_win_probability, d = r.draw_probability, a = r.away_win_probability
    const m = Math.max(h, d, a)
    return m === h ? (r.match?.home_team?.code ?? '1') : m === a ? (r.match?.away_team?.code ?? '2') : 'X'
  }

  const recent = resolved.slice(0, 8)

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Rendimiento del Modelo
          </span>
        </div>
        <span className="text-[10px] text-zinc-600">predicciones resueltas</span>
      </div>

      <div className="p-4 space-y-4">
        {total === 0 ? (
          <p className="text-sm text-zinc-500">Aún no hay predicciones resueltas para medir.</p>
        ) : (
          <>
            {/* Acierto global */}
            <div className="flex items-end gap-3">
              <span className="text-4xl font-black mono text-emerald-400">
                {(acc! * 100).toFixed(1)}%
              </span>
              <div className="pb-1">
                <p className="text-xs text-zinc-300 font-semibold">{hits} de {total} aciertos</p>
                <p className="text-[10px] text-zinc-600">resultado 1X2 en 90 minutos</p>
              </div>
            </div>

            {/* Barra global */}
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="bg-emerald-500 transition-all" style={{ width: `${acc! * 100}%` }} />
            </div>

            {/* Desglose por fase */}
            <div className="space-y-2 pt-1">
              {[...byPhase.entries()].map(([ph, e]) => (
                <div key={ph} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">{PHASE_LABELS[ph] ?? ph}</span>
                  <div className="flex items-center gap-2">
                    <span className="mono text-zinc-400">{e.hits}/{e.total}</span>
                    <span className={cn('mono font-semibold w-12 text-right',
                      e.hits / e.total >= 0.6 ? 'text-emerald-400' : 'text-amber-400')}>
                      {((e.hits / e.total) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Evidencia: últimas resoluciones */}
            <div className="pt-2 border-t border-zinc-800/60">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">
                Últimas resoluciones
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-1 rounded px-1.5 py-1 text-[10px] mono',
                      r.was_correct
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400',
                    )}
                    title={`Predicción: ${pick(r)}`}
                  >
                    {r.was_correct ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                    {r.match?.home_team?.code}{r.match?.home_score}-{r.match?.away_score}{r.match?.away_team?.code}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
