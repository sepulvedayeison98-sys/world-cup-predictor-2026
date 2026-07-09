import type { Metadata } from 'next'
import Link from 'next/link'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { COMPETITION_ID, LEAGUE_DISPLAY_ORDER, LEAGUE_SLUGS, LEAGUE_NAMES, MODEL_VERSION } from '@/lib/constants'
import { NBA_COMPETITION_ID } from '@/lib/nba'

export const metadata: Metadata = {
  title: 'Inteligencia | Veredicto',
  description: 'Rendimiento verificable del motor de predicción: precisión, metodología y versiones.',
}

export const revalidate = 300

/**
 * Centro de inteligencia (auditoría F2): la vitrina de confianza.
 * Toda cifra de precisión de la plataforma enlaza aquí — la página que
 * explica cómo se mide, contra qué línea base y con qué método.
 */
export default async function InteligenciaPage() {
  const supabase = createStaticSupabaseClient()

  // Rendimiento del Mundial (resueltas)
  const { data: wcPreds } = await supabase
    .from('predictions')
    .select('was_correct, match:matches!inner(competition_id)')
    .eq('match.competition_id', COMPETITION_ID)
    .not('was_correct', 'is', null)
  const wcResolved = wcPreds ?? []
  const wcCorrect = wcResolved.filter((p: any) => p.was_correct === true).length

  // Rendimiento NBA (backtest nba-1.0, moneyline — línea base 50%)
  const { data: nbaPreds } = await supabase
    .from('predictions')
    .select('was_correct, match:matches!inner(competition_id)')
    .eq('match.competition_id', NBA_COMPETITION_ID)
    .not('was_correct', 'is', null)
  const nbaResolved = nbaPreds ?? []
  const nbaCorrect = nbaResolved.filter((p: any) => p.was_correct === true).length

  // Rendimiento por liga (backtest liga-1.0)
  const slugById = Object.fromEntries(Object.entries(LEAGUE_SLUGS).map(([slug, id]) => [id, slug]))
  const leagues: { name: string; slug: string; correct: number; total: number }[] = []
  for (const compId of LEAGUE_DISPLAY_ORDER) {
    const { data, error } = await supabase
      .from('predictions')
      .select('was_correct, match:matches!inner(competition_id)')
      .eq('match.competition_id', compId)
      .not('was_correct', 'is', null)
    if (error) console.error('[inteligencia] precisión de liga:', error.message)
    const rows = data ?? []
    const slug = slugById[compId]
    leagues.push({
      name: LEAGUE_NAMES[slug] ?? slug,
      slug,
      correct: rows.filter((p: any) => p.was_correct === true).length,
      total: rows.length,
    })
  }
  const ligaTotals = leagues.reduce((s, l) => ({ c: s.c + l.correct, t: s.t + l.total }), { c: 0, t: 0 })

  const pct = (c: number, t: number) => (t > 0 ? ((c / t) * 100).toFixed(1) : '—')

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Rendimiento verificable del motor
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Inteligencia</h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Cada predicción publicada queda registrada y se resuelve contra el
          resultado real. Esta página no maquilla nada: es el historial del
          motor, con sus líneas base y su método.
        </p>
      </div>

      {/* Precisión viva */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/30 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Mundial 2026 · v{MODEL_VERSION}</p>
          <p className="mt-1 text-3xl font-bold text-emerald-400 mono">{pct(wcCorrect, wcResolved.length)}%</p>
          <p className="text-xs text-zinc-500">{wcCorrect}/{wcResolved.length} · azar 33%</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Ligas · liga-1.0</p>
          <p className="mt-1 text-3xl font-bold text-white mono">{pct(ligaTotals.c, ligaTotals.t)}%</p>
          <p className="text-xs text-zinc-500">{ligaTotals.c}/{ligaTotals.t} · azar 33%</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">NBA · nba-1.0</p>
          <p className="mt-1 text-3xl font-bold text-white mono">{pct(nbaCorrect, nbaResolved.length)}%</p>
          <p className="text-xs text-zinc-500">{nbaCorrect}/{nbaResolved.length} · azar 50%</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Líneas base</p>
          <p className="mt-1 text-lg font-bold text-zinc-300 mono">33% / 50%</p>
          <p className="text-xs text-zinc-500">azar en fútbol / baloncesto</p>
        </div>
      </div>

      {/* Por liga */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-bold text-white">Precisión por competición</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2 text-left">Competición</th>
                <th className="px-3 py-2 text-center">Picks evaluados</th>
                <th className="px-3 py-2 text-center">Aciertos</th>
                <th className="px-3 py-2 text-center">Precisión 1X2</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/60">
                <td className="px-4 py-2.5 font-medium text-zinc-200">
                  <Link href="/mundial" className="hover:text-emerald-400">Mundial 2026</Link>
                </td>
                <td className="px-3 py-2.5 text-center text-zinc-400 mono">{wcResolved.length}</td>
                <td className="px-3 py-2.5 text-center text-zinc-400 mono">{wcCorrect}</td>
                <td className="px-3 py-2.5 text-center font-bold text-emerald-400 mono">{pct(wcCorrect, wcResolved.length)}%</td>
              </tr>
              {leagues.map((l) => (
                <tr key={l.slug} className="border-b border-zinc-800/60">
                  <td className="px-4 py-2.5 font-medium text-zinc-200">
                    <Link href={`/ligas/${l.slug}`} className="hover:text-emerald-400">{l.name}</Link>
                  </td>
                  <td className="px-3 py-2.5 text-center text-zinc-400 mono">{l.total}</td>
                  <td className="px-3 py-2.5 text-center text-zinc-400 mono">{l.correct}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-white mono">{pct(l.correct, l.total)}%</td>
                </tr>
              ))}
              {/* NBA — línea base 50% (moneyline, sin empate) */}
              <tr className="border-b border-zinc-800/60 last:border-0">
                <td className="px-4 py-2.5 font-medium text-zinc-200">
                  <Link href="/nba" className="hover:text-emerald-400">NBA</Link>
                  <span className="ml-2 text-[10px] text-zinc-600">baloncesto · azar 50%</span>
                </td>
                <td className="px-3 py-2.5 text-center text-zinc-400 mono">{nbaResolved.length}</td>
                <td className="px-3 py-2.5 text-center text-zinc-400 mono">{nbaCorrect}</td>
                <td className="px-3 py-2.5 text-center font-bold text-white mono">{pct(nbaCorrect, nbaResolved.length)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="border-t border-zinc-800 px-4 py-2.5 text-[11px] text-zinc-600">
          Un acierto = el resultado con mayor probabilidad del modelo coincidió con
          el real (fútbol: 1X2 a 90&apos;; NBA: ganador). Líneas base: azar 33% y
          siempre-local ≈44% en fútbol; azar 50% en baloncesto.
        </p>
      </div>

      {/* Metodología */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-bold text-white">Cómo predice el motor</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-400">
            <p>
              <span className="font-semibold text-zinc-200">Mundial (v{MODEL_VERSION}):</span>{' '}
              modelo híbrido de 5 factores — xG y capacidad ofensiva/defensiva (40%),
              ELO (25%), forma reciente (15%), mercado de cuotas de-vigueado (10%) y
              noticias/lesiones (10%). Las probabilidades 1X2 y los marcadores salen
              de una rejilla de Poisson con corrección Dixon-Coles.
            </p>
            <p>
              <span className="font-semibold text-zinc-200">Ligas (liga-1.0):</span>{' '}
              ELO de clubes + fuerzas de ataque/defensa con promedios móviles,
              sobre la misma rejilla de Poisson. Calibrado con backtest
              <em> walk-forward</em>: cada partido se predice solo con información
              anterior a su disputa — sin mirar el futuro.
            </p>
            <p>
              <span className="font-semibold text-zinc-200">Datos primero:</span>{' '}
              cada estadística declara su procedencia (oficial vs estimación del
              modelo) y no se fabrican datos sintéticos.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-bold text-white">Versiones del motor</h2>
          <ul className="mt-3 space-y-3 text-sm text-zinc-400">
            <li className="flex gap-3">
              <span className="shrink-0 rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400 mono h-fit">v{MODEL_VERSION}</span>
              <span>Corrección Dixon-Coles, pesos de 5 factores recalibrados, resolución de llaves con prórroga y penales, recalibración automática post-resultado.</span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 rounded bg-zinc-500/10 border border-zinc-700 px-2 py-0.5 text-[11px] font-bold text-zinc-300 mono h-fit">liga-1.0</span>
              <span>Motor de clubes con backtest walk-forward sobre la temporada 2024-25 completa de las 5 grandes ligas (1,512 partidos evaluados). Predicción pre-partido lista para la 2026-27.</span>
            </li>
          </ul>
          <p className="mt-4 border-t border-zinc-800 pt-3 text-[11px] leading-relaxed text-zinc-600">
            Las probabilidades son estimaciones estadísticas, no certezas ni
            asesoramiento financiero. Si apuestas, hazlo con moderación. +18.
          </p>
        </div>
      </div>
    </div>
  )
}
