import type { Metadata } from 'next'
import Link from 'next/link'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { computeNbaCalibration } from '@/lib/nba/stats'
import { fetchNbaResolvedPredictions } from '@/services/nba.service'
import { NBA_COMPETITION_ID, NBA_MODEL_VERSION } from '@/lib/nba/constants'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Predicciones NBA | Veredicto',
  description: 'Rendimiento verificable del modelo nba-1.0: precisión, calibración por franjas y metodología.',
}

export const revalidate = 300

/**
 * La vitrina de confianza del modelo NBA: precisión global, calibración
 * (¿acierta X% cuando dice X%?) y próximos partidos con predicción.
 * Sin partidos programados se muestra el estado honesto, nunca un relleno.
 */
export default async function NbaPrediccionesPage() {
  const supabase = createStaticSupabaseClient()

  const [resolved, { data: upcoming }] = await Promise.all([
    fetchNbaResolvedPredictions(supabase),
    supabase
      .from('matches')
      .select('id, kickoff_time, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code), predictions(home_win_probability, away_win_probability)')
      .eq('competition_id', NBA_COMPETITION_ID)
      .eq('status', 'scheduled')
      .order('kickoff_time', { ascending: true })
      .limit(10),
  ])

  const correct = resolved.filter((p) => p.was_correct === true).length
  const accuracy = resolved.length ? (correct / resolved.length) * 100 : null
  const calibration = computeNbaCalibration(resolved)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href="/nba" className="text-xs font-semibold uppercase tracking-widest text-emerald-500 hover:text-emerald-400">← NBA</Link>
        <h1 className="mt-1 text-2xl font-bold text-white">Predicciones del modelo</h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Cada predicción del modelo {NBA_MODEL_VERSION} quedó registrada y
          resuelta contra el resultado real. Esta página muestra lo que el
          modelo promete y lo que de verdad cumple.
        </p>
      </div>

      {/* Precisión global */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/30 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Precisión (ganador)</p>
          <p className="mt-1 text-3xl font-bold text-emerald-400 mono">{accuracy != null ? accuracy.toFixed(1) + '%' : '—'}</p>
          <p className="text-xs text-zinc-500">{correct}/{resolved.length} · azar 50%</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Método</p>
          <p className="mt-1 text-lg font-bold text-white">Walk-forward</p>
          <p className="text-xs text-zinc-500">cada partido se predijo solo con lo anterior</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Modelo</p>
          <p className="mt-1 text-lg font-bold text-white mono">{NBA_MODEL_VERSION}</p>
          <p className="text-xs text-zinc-500">ELO sin empates · local +60 ELO</p>
        </div>
      </div>

      {/* Calibración */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-bold text-white">Calibración: lo prometido vs lo cumplido</h2>
          <p className="text-[11px] text-zinc-500">
            Un modelo honesto acierta ~65% de las veces que asigna 65% al
            favorito. Franjas por probabilidad del favorito.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2 text-left">Confianza del modelo</th>
                <th className="px-3 py-2 text-center">Picks</th>
                <th className="px-3 py-2 text-center">Aciertos</th>
                <th className="px-3 py-2 text-center">Acierto real</th>
                <th className="px-3 py-2 text-center hidden sm:table-cell">Desviación</th>
              </tr>
            </thead>
            <tbody>
              {calibration.map((b) => {
                const dev = b.total ? (b.hitRate - b.expectedRate) * 100 : null
                return (
                  <tr key={b.label} className="border-b border-zinc-800/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-zinc-200 mono">{b.label}</td>
                    <td className="px-3 py-2.5 text-center text-zinc-400 mono">{b.total}</td>
                    <td className="px-3 py-2.5 text-center text-zinc-400 mono">{b.correct}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-white mono">
                      {b.total ? (b.hitRate * 100).toFixed(1) + '%' : '—'}
                    </td>
                    <td className={cn(
                      'px-3 py-2.5 text-center mono hidden sm:table-cell',
                      dev == null ? 'text-zinc-600' : Math.abs(dev) <= 5 ? 'text-emerald-400' : 'text-amber-400',
                    )}>
                      {dev == null ? '—' : `${dev > 0 ? '+' : ''}${dev.toFixed(1)} pts`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-zinc-800 px-4 py-2.5 text-[11px] text-zinc-600">
          Desviación = acierto real − punto medio de la franja. Dentro de ±5
          puntos se considera bien calibrado para el tamaño de muestra.
        </p>
      </div>

      {/* Próximos partidos */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-bold text-white">Próximos partidos con predicción</h2>
        </div>
        {(upcoming ?? []).length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm font-medium text-zinc-300">La temporada 2024-25 terminó</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
              El modelo queda calibrado y listo. Cuando arranque la 2025-26
              (octubre), cada partido tendrá su predicción pre-partido aquí
              y en el calendario del hub.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {(upcoming as any[]).map((m) => {
              const p = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
              return (
                <li key={m.id}>
                  <Link href={`/matches/${m.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/40 transition-colors">
                    <span className="text-sm font-medium text-zinc-200">{m.home_team?.code} vs {m.away_team?.code}</span>
                    <span className="flex items-center gap-3 text-xs text-zinc-400 mono">
                      {p && <span>{Math.round(Number(p.home_win_probability) * 100)}%–{Math.round(Number(p.away_win_probability) * 100)}%</span>}
                      <span className="text-zinc-500">
                        {new Date(m.kickoff_time).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-zinc-600">
        Las probabilidades son estimaciones estadísticas, no certezas. La
        metodología completa vive en <Link href="/inteligencia" className="text-emerald-500 hover:text-emerald-400">Inteligencia</Link>.
      </p>
    </div>
  )
}
