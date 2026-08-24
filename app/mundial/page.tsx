import type { Metadata } from 'next'
import Link from 'next/link'
import { Archive, Check, X } from 'lucide-react'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { COMPETITION_ID, PHASE_LABELS } from '@/lib/constants'
import { computeMundialReport, type ReportPrediction } from '@/lib/mundialReport'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Mundial 2026 — archivo',
  description:
    'Archivo del Mundial FIFA 2026: el balance congelado del modelo sobre las 91 predicciones resueltas del torneo. Competición retirada, datos conservados.',
  // El torneo sale del índice: no es contenido vivo y competía por atención
  // con las competiciones en curso.
  robots: { index: false, follow: false },
}

/**
 * Página de ARCHIVO del Mundial 2026 — el único lugar del sitio donde queda
 * rastro del torneo.
 *
 * ── Por qué existe una página y no cero ───────────────────────────────────
 * Archivar es dejar de mostrar y de actualizar, no borrar. Las 91
 * predicciones resueltas son historial verificable del motor y los enlaces
 * que ya circulan tienen que llegar a algo. Esta página los recibe, declara
 * que la competición está archivada y enseña el balance congelado.
 *
 * ── Qué absorbió ──────────────────────────────────────────────────────────
 * Antes el torneo ocupaba nueve rutas (/mundial, /mundial/balance,
 * /mundial/rankings, /bracket, /champion, /groups, /scorers, /players,
 * /simulation). Todas redirigen aquí (ver next.config.ts). El balance —lo
 * que estaba en /mundial/balance— se trajo íntegro porque es lo único que
 * sigue significando algo: el resto eran vistas de un torneo en marcha.
 *
 * ── Congelada a propósito ─────────────────────────────────────────────────
 * `revalidate = false`: los datos no cambian nunca más. Ningún cron escribe
 * en esta competición y `recalibrate` salta los partidos jugados desde el
 * commit que congeló las predicciones.
 */
export const revalidate = false

export default async function MundialArchivoPage() {
  const supabase = createStaticSupabaseClient()

  const [{ data: raw }, { count: played }] = await Promise.all([
    supabase
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
      .not('was_correct', 'is', null),
    supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', COMPETITION_ID)
      .eq('status', 'finished'),
  ])

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
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          <Archive className="h-3 w-3" /> Competición archivada
        </span>
        <h1 className="mt-2 text-2xl font-bold text-white">Mundial 2026</h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          El torneo terminó el 19 de julio de 2026 y quedó archivado: ya no se
          actualiza ni aparece en la navegación, el buscador ni los contadores
          de la plataforma. Sus datos se conservan intactos y este es su
          balance congelado.
        </p>
      </div>

      {r.total === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="text-sm text-zinc-400">No quedan predicciones resueltas del torneo.</p>
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
              <p className="text-[11px] text-zinc-500">Partidos jugados</p>
              <p className="text-2xl font-bold mono text-zinc-300">{played ?? 0}/104</p>
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
                  <li key={p.match_id} className="flex items-center justify-between gap-2 px-1.5 py-1 text-xs">
                    <span className="truncate text-zinc-300">{p.home_name} {p.home_score}–{p.away_score} {p.away_name}</span>
                    <span className="shrink-0 text-[11px] text-emerald-400">{outcomeLabel(p)} · {pct(Math.max(p.home_win_probability, p.draw_probability, p.away_win_probability))}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <X className="h-4 w-4 text-red-400" /> Fallos más sonados
              </h2>
              {r.worstMisses.length === 0 ? (
                <p className="text-xs text-zinc-500">Sin fallos de alta convicción.</p>
              ) : (
                <ul className="space-y-2">
                  {r.worstMisses.map((p) => (
                    <li key={p.match_id} className="flex items-center justify-between gap-2 px-1.5 py-1 text-xs">
                      <span className="truncate text-zinc-300">{p.home_name} {p.home_score}–{p.away_score} {p.away_name}</span>
                      <span className="shrink-0 text-[11px] text-red-400">dio {outcomeLabel(p)} · {pct(Math.max(p.home_win_probability, p.draw_probability, p.away_win_probability))}</span>
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

          <p className="text-[11px] leading-relaxed text-zinc-600">
            Cifras calificadas en su momento, con su línea base (azar 1X2 =
            33,3%). No cuentan en los contadores de la plataforma: esos miden
            solo lo que se cubre hoy. La metodología, aplicada a las
            competiciones en curso, está en{' '}
            <Link href="/inteligencia" className="text-emerald-500 hover:text-emerald-400">Inteligencia</Link>.
          </p>
        </>
      )}
    </div>
  )
}
