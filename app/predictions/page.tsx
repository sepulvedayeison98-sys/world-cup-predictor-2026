import type { Metadata } from 'next'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { PredictionsTable } from '@/components/predictions/PredictionsTable'
import { MODEL_VERSION, COMPETITION_ID } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Predicciones | World Cup Predictor',
}


// ISR: cacheado y revalidado cada 120s (sin cookies → renderizado estático)
export const revalidate = 120

export default async function PredictionsPage() {
  const supabase = createStaticSupabaseClient()
  const { data: predictions } = await supabase
    .from('predictions')
    .select(`
      *,
      match:matches!inner(
        competition_id, kickoff_time, venue, city, status, phase, home_score, away_score,
        home_team:teams!matches_home_team_id_fkey(name, short_name, code, fifa_ranking),
        away_team:teams!matches_away_team_id_fkey(name, short_name, code, fifa_ranking)
      ),
      exact_score_predictions(home_score, away_score, probability, rank)
    `)
    .eq('is_published', true)
    // Esta página es del Mundial; las predicciones de ligas viven en /ligas
    .eq('match.competition_id', COMPETITION_ID)

  // Orden cronológico por fecha y hora del partido (el `.order` de PostgREST no
  // ordena el nivel superior por una columna de la tabla embebida, así que se
  // ordena aquí). Descendente = del más reciente al más antiguo; los partidos
  // sin fecha caen al final.
  const ordered = (predictions ?? []).slice().sort((a: any, b: any) => {
    const ta = a.match?.kickoff_time ? new Date(a.match.kickoff_time).getTime() : Number.MIN_SAFE_INTEGER
    const tb = b.match?.kickoff_time ? new Date(b.match.kickoff_time).getTime() : Number.MIN_SAFE_INTEGER
    return tb - ta
  })

  // Stats
  const resolved = ordered.filter((p: any) => p.was_correct !== null)
  const correct  = resolved.filter((p: any) => p.was_correct === true).length
  const accuracy = resolved.length > 0 ? ((correct / resolved.length) * 100).toFixed(1) : '—'

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Modelo v{MODEL_VERSION} · Activo
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Predicciones</h1>
        <p className="text-sm text-zinc-400">
          Todas las predicciones del motor ordenadas por fecha
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          El acierto se mide por el resultado (gana local / empate / gana visitante), no por el marcador exacto.
          El &quot;Pronóstico&quot; es el marcador estimado; en los partidos finalizados se muestra también el marcador real.
        </p>
      </div>

      {/* Accuracy summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total predicciones', value: ordered.length.toString(), color: 'text-white' },
          { label: 'Resueltas',          value: resolved.length.toString(), color: 'text-zinc-300' },
          { label: 'Correctas',          value: correct.toString(), color: 'text-emerald-400' },
          { label: 'Precisión',          value: `${accuracy}%`, color: accuracy !== '—' && parseFloat(accuracy as string) >= 65 ? 'text-emerald-400' : 'text-amber-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <p className="text-[11px] text-zinc-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mono ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Q9: la precisión sin líneas base no dice nada — con ellas, demuestra habilidad */}
      <p className="-mt-3 text-[11px] text-zinc-600">
        Referencias: elegir al azar acierta ~33% · apostar siempre por el local ~44%.
      </p>

      <PredictionsTable predictions={ordered} />
    </div>
  )
}
