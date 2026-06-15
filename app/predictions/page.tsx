import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PredictionsTable } from '@/components/predictions/PredictionsTable'
import { MODEL_VERSION } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Predicciones | World Cup Predictor',
}

const COMPETITION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default async function PredictionsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: predictions } = await supabase
    .from('predictions')
    .select(`
      *,
      match:matches(
        kickoff_time, venue, city, status, phase,
        home_team:teams!matches_home_team_id_fkey(name, short_name, code, fifa_ranking),
        away_team:teams!matches_away_team_id_fkey(name, short_name, code, fifa_ranking)
      ),
      exact_score_predictions(home_score, away_score, probability, rank)
    `)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  // Stats
  const resolved = (predictions ?? []).filter((p: any) => p.was_correct !== null)
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
      </div>

      {/* Accuracy summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total predicciones', value: (predictions ?? []).length.toString(), color: 'text-white' },
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

      <PredictionsTable predictions={predictions ?? []} />
    </div>
  )
}
