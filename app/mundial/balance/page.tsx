import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Check, X } from 'lucide-react'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { COMPETITION_ID, PHASE_LABELS } from '@/lib/constants'
import { computeMundialReport, type ReportPrediction } from '@/lib/mundialReport'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Balance del Mundial 2026 — cómo le fue al modelo',
  description:
    'El desempeño del modelo en el Mundial 2026: precisión frente al azar, calibración, mejores aciertos y fallos más sonados. Verificable, sin adornos.',
}

// ISR: se actualiza al resolverse cada partido
export const revalidate = 300

/**
 * Balance/Informe del Mundial (playbook Sofascore, mejora 12). Recap público
 * y honesto del desempeño del modelo. Mientras el torneo sigue es el balance
 * en curso; cuando la final se juega, se vuelve el informe final. Cero
 * adornos: cada cifra sale de predicciones resueltas reales.
 */
export default async function MundialBalancePage() {
  const supabase = createStaticSupabaseClient()

  const { data: raw } = await supabase
    .from('predictions')
    .select(`
      match_id, was_correct, home_win_probability, draw_probability, away_win_probability,
      confidence_score,
      match:matches!inner(
        competition_id, phase, home_score, away_score, kickoff_time,
        home_team:teams!matches_home_team_id_fkey(name, short_name),
        away_team:teams!matches_away_team_id_fkey(name, short_name)
      )
    `)
    .eq('match.competition_id', COMPETITION_ID)
    .not('was_correct', 'is', null)

  // ¿La final ya se jugó? → informe final; si no, balance en curso
  const { data: finalRow } = await supabase
    .from('matches')
    .select('status')
    .eq('competition_id', COMPETITION_ID)
    .eq('phase', 'final')
    .eq('status', 'finished')
    .maybeSingle()
  const isFinal = Boolean(finalRow)

  const preds: ReportPrediction[] = (raw ?? []).map((p: any) => ({
    match_id: p.match_id,
    was_correct: p.was_correct,
    home_win_probability: Number(p.home_win_probability),
    draw_probability: Number(p.draw_probability),
    away_win_probability: Number(p.away_win_probability),
    confidence_score: p.confidence_score,
    phase: p.match?.phase ?? null,
    home_name: p.match?.home_team?.short_name ?? p.match?.home_team?.name ?? 'Local',
    away_name: p.match?.away_team?.short_name ?? p.match?.away_team?.name ?? 'Visita',
    home_score: p.match?.home_score ?? null,
    away_score: p.match?.away_score ?? null,
    kickoff_time: p.match?.kickoff_time ?? '',
  }))

  const r = computeMundialReport(preds)
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`
  const outcomeLabel = (p: ReportPrediction) => {
    const h = p.home_win_probability, d = p.draw_probability, a = p.away_win_probability
    return h >= d && h >= a ? `${p.home_name} gana` : a >= d ? `${p.away_name} gana` : 'Empate'
  }

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <div>
        <Link href="/mundial" className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Mundial 2026
        </Link>
        <span className="block text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Mundial 2026 · {isFinal ? 'Informe final' : 'Balance en curso'}
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Cómo le fue al modelo</h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          {isFinal
            ? 'El torneo terminó. Este es el balance completo del modelo, con todo verificable.'
            : `El torneo sigue: balance hasta ahora sobre ${r.total} partidos resueltos. Se completará con la final.`}
        </p>
      </div>

      {r.total === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="text-sm text-zinc-400">Aún no hay partidos resueltos para reportar.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="kpi-card">
              <p className="text-[11px] text-zinc-500">Precisión 1X2</p>
              <p className="text-2xl font-bold mono text-emerald-400">{r.accuracy != null ? pct(r.accuracy) : '—'}</p>
            </div>
            <div className="kpi-card">
              <p className="text-[11px] text-zinc-500">Aciertos</p>
              <p className="text-2xl font-bold mono text-white">{r.correct}/{r.total}</p>
            </div>
            <div className="kpi-card">
              <p className="text-[11px] text-zinc-500">Azar 1X2</p>
              <p className="text-2xl font-bold mono text-zinc-400">{pct(r.chanceBaseline)}</p>
            </div>
            <div className="kpi-card">
              <p className="text-[11px] text-zinc-500">Ventaja vs azar</p>
              <p className="text-2xl font-bold mono text-emerald-400">
                {r.accuracy != null ? `+${((r.accuracy - r.chanceBaseline) * 100).toFixed(1)}` : '—'}
              </p>
            </div>
          </div>

          {/* Precisión por fase */}
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold text-white">Precisión por fase</h2>
            <div className="space-y-2">
              {r.byPhase.map((ph) => (
                <div key={ph.phase} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-xs text-zinc-400">{PHASE_LABELS[ph.phase] ?? ph.phase}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full bg-emerald-500" style={{ width: `${ph.accuracy * 100}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs mono text-zinc-300">
                    {(ph.accuracy * 100).toFixed(0)}% · {ph.correct}/{ph.total}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Mejores aciertos y peores fallos */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <Check className="h-4 w-4 text-emerald-400" /> Mejores aciertos
              </h2>
              <ul className="space-y-2">
                {r.bestCalls.map((p) => (
                  <li key={p.match_id}>
                    <Link href={`/matches/${p.match_id}`} className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs hover:bg-zinc-800/40 transition-colors">
                      <span className="truncate text-zinc-300">{p.home_name} {p.home_score}–{p.away_score} {p.away_name}</span>
                      <span className="shrink-0 text-[11px] text-emerald-400">{outcomeLabel(p)} · {pct(Math.max(p.home_win_probability, p.draw_probability, p.away_win_probability))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <X className="h-4 w-4 text-red-400" /> Fallos más sonados
              </h2>
              {r.worstMisses.length === 0 ? (
                <p className="text-xs text-zinc-500">Sin fallos de alta convicción todavía.</p>
              ) : (
                <ul className="space-y-2">
                  {r.worstMisses.map((p) => (
                    <li key={p.match_id}>
                      <Link href={`/matches/${p.match_id}`} className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs hover:bg-zinc-800/40 transition-colors">
                        <span className="truncate text-zinc-300">{p.home_name} {p.home_score}–{p.away_score} {p.away_name}</span>
                        <span className="shrink-0 text-[11px] text-red-400">dio {outcomeLabel(p)} · {pct(Math.max(p.home_win_probability, p.draw_probability, p.away_win_probability))}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Calibración */}
          <div className="card overflow-hidden">
            <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
              <h2 className="text-sm font-bold text-white">Calibración</h2>
              <p className="text-[11px] text-zinc-500">Un modelo calibrado acierta ~X% cuando dice X%.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left">Prob. del favorito</th>
                    <th className="text-center">Partidos</th>
                    <th className="text-center">Esperado</th>
                    <th className="text-center">Real</th>
                    <th className="text-right">Desviación</th>
                  </tr>
                </thead>
                <tbody>
                  {r.calibration.filter((b) => b.total > 0).map((b) => {
                    const dev = b.hitRate - b.expectedRate
                    return (
                      <tr key={b.label}>
                        <td className="text-zinc-300">{b.label}</td>
                        <td className="text-center mono text-zinc-400">{b.total}</td>
                        <td className="text-center mono text-zinc-500">{pct(b.expectedRate)}</td>
                        <td className="text-center mono text-zinc-200">{pct(b.hitRate)}</td>
                        <td className={cn('text-right mono', Math.abs(dev) <= 0.05 ? 'text-emerald-400' : 'text-amber-400')}>
                          {dev >= 0 ? '+' : ''}{(dev * 100).toFixed(1)}pts
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-zinc-600">
            Todas las cifras salen de predicciones resueltas del torneo, con su
            línea base (azar 1X2 = 33.3%). La misma metodología, verificable, en{' '}
            <Link href="/inteligencia" className="text-emerald-500 hover:text-emerald-400">Inteligencia</Link>.
          </p>
        </>
      )}
    </div>
  )
}
