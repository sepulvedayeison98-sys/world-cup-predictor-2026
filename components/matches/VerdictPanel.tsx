'use client'

import { useEffect, useState } from 'react'
import { Scale } from 'lucide-react'

interface Verdict {
  summary: string
  factors: { title: string; text: string }[]
  prediction_review: string
  model_lesson: string
  generator: string
}

/**
 * Veredicto del partido (solo finalizados): qué ocurrió, qué factores
 * pesaron, cómo le fue a la predicción y qué registra el modelo.
 * La primera visita al partido lo genera (una vez, cacheado en BD).
 */
export function VerdictPanel({ matchId }: { matchId: string }) {
  const [verdict, setVerdict] = useState<Verdict | null | 'loading'>('loading')

  useEffect(() => {
    let alive = true
    fetch(`/api/matches/${matchId}/verdict`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (alive) setVerdict(d.verdict ?? null) })
      .catch(() => { if (alive) setVerdict(null) })
    return () => { alive = false }
  }, [matchId])

  if (verdict === null) return null

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Veredicto del partido</h2>
        </div>
        {verdict !== 'loading' && (
          <span className="text-[10px] uppercase tracking-wider text-zinc-600">
            {verdict.generator === 'deterministic' ? 'Generado por el motor' : 'Redacción IA · hechos del motor'}
          </span>
        )}
      </div>

      {verdict === 'loading' ? (
        <div className="space-y-2 px-4 py-5">
          <div className="h-3.5 w-4/5 animate-pulse rounded bg-zinc-800" />
          <div className="h-3.5 w-3/5 animate-pulse rounded bg-zinc-800" />
          <p className="pt-1 text-[11px] text-zinc-600">
            El motor está redactando el veredicto de este partido (solo ocurre la primera vez)…
          </p>
        </div>
      ) : (
        <div className="space-y-4 px-4 py-4">
          <p className="text-sm leading-relaxed text-zinc-200">{verdict.summary}</p>

          {verdict.factors.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {verdict.factors.map((f, idx) => (
                <div key={idx} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">{f.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">{f.text}</p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2.5 border-t border-zinc-800 pt-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Predicción vs realidad</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-300">{verdict.prediction_review}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Lo que registra el modelo</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{verdict.model_lesson}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
