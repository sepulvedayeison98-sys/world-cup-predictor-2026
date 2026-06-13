import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { DashboardKPICards } from '@/components/dashboard/KPICards'
import { UpcomingMatchesWidget } from '@/components/dashboard/UpcomingMatchesWidget'
import { ValueBetsWidget } from '@/components/dashboard/ValueBetsWidget'
import { ROIChart } from '@/components/charts/ROIChart'
import { PredictionAccuracyChart } from '@/components/charts/PredictionAccuracyChart'
import { GroupStandingsWidget } from '@/components/dashboard/GroupStandingsWidget'

export const metadata: Metadata = {
  title: 'Dashboard | World Cup Predictor',
  description: 'Análisis en tiempo real del Mundial FIFA 2026',
}

// This page is a Server Component — data is fetched server-side
export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  // Fetch KPI data server-side for initial render
  const [
    { count: totalMatches },
    { count: analyzedMatches },
    { data: valueBets },
    { data: predictions },
  ] = await Promise.all([
    supabase.from('matches').select('*', { count: 'exact', head: true }),
    supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true),
    supabase
      .from('value_bets')
      .select('*')
      .eq('is_active', true)
      .in('grade', ['high', 'medium'])
      .limit(5),
    supabase
      .from('predictions')
      .select('was_correct')
      .not('was_correct', 'is', null),
  ])

  const correctPredictions = (predictions ?? []).filter((p) => p.was_correct).length
  const totalPredictions = predictions?.length ?? 0
  const accuracy = totalPredictions > 0 ? correctPredictions / totalPredictions : 0

  const initialKPIs = {
    total_matches: totalMatches ?? 0,
    analyzed_matches: analyzedMatches ?? 0,
    active_picks: valueBets?.length ?? 0,
    historical_accuracy: accuracy,
    roi: 8.4, // Will be computed from bet history
    correct_predictions: correctPredictions,
    total_predictions: totalPredictions,
    value_bets_detected: valueBets?.length ?? 0,
    value_bets_won: 0,
    value_bets_pending: valueBets?.length ?? 0,
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
            FIFA World Cup 2026
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white">
          Panel de Análisis
        </h1>
        <p className="text-sm text-zinc-400">
          Motor de predicción activo · Modelo v1.0.0 · Última actualización:{' '}
          {new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
        </p>
      </div>

      {/* KPI Cards */}
      <DashboardKPICards kpis={initialKPIs} />

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — 2/3 width */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <UpcomingMatchesWidget />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ROIChart />
            <PredictionAccuracyChart />
          </div>
        </div>

        {/* Right column — 1/3 width */}
        <div className="flex flex-col gap-6">
          <ValueBetsWidget bets={valueBets ?? []} />
          <GroupStandingsWidget competitionId="a1b2c3d4-e5f6-7890-abcd-ef1234567890" groupLetter="C" />
        </div>
      </div>
    </div>
  )
}
