import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { KPICardsRealtime } from '@/components/dashboard/KPICardsRealtime'
import { UpcomingMatchesWidgetRealtime } from '@/components/dashboard/UpcomingMatchesWidgetRealtime'
import { ValueBetsWidgetRealtime } from '@/components/dashboard/ValueBetsWidgetRealtime'
import { GroupStandingsWidget } from '@/components/dashboard/GroupStandingsWidget'
import { SimulationResultsWidget } from '@/components/dashboard/SimulationResultsWidget'
import { MODEL_VERSION } from '@/lib/constants'
import { TournamentPathTracker } from '@/components/dashboard/TournamentPathTracker'

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
    { count: activeBetsCount },
    { data: predictions },
    { data: settledBets },
  ] = await Promise.all([
    supabase.from('matches').select('*', { count: 'exact', head: true }),
    supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true),
    supabase
      .from('value_bets')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('predictions')
      .select('was_correct')
      .not('was_correct', 'is', null),
    supabase
      .from('value_bets')
      .select('result, odds_value')
      .in('result', ['won', 'lost']),
  ])

  const resolved = predictions ?? []
  const correctPredictions = resolved.filter((p) => p.was_correct === true).length
  const totalResolved = resolved.length
  // null = aún no hay predicciones resueltas (no inventamos un 0%)
  const accuracy = totalResolved > 0 ? correctPredictions / totalResolved : null

  // ROI real con stake plano de 1u; null mientras no haya apuestas resueltas
  // (antes era un 8.4% fabricado).
  const settled = settledBets ?? []
  const betsWon = settled.filter((b: any) => b.result === 'won').length
  const profit = settled.reduce(
    (acc: number, b: any) => acc + (b.result === 'won' ? Number(b.odds_value) - 1 : -1),
    0
  )
  const roi = settled.length > 0 ? (profit / settled.length) * 100 : null

  const activeBets = activeBetsCount ?? 0
  const initialKPIs = {
    total_matches: totalMatches ?? 0,
    analyzed_matches: analyzedMatches ?? 0,
    active_picks: activeBets,
    historical_accuracy: accuracy,
    roi,
    correct_predictions: correctPredictions,
    total_predictions: totalResolved,
    value_bets_detected: activeBets,
    value_bets_won: betsWon,
    value_bets_pending: activeBets,
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
          Motor de predicción activo · Modelo v{MODEL_VERSION} · Última actualización:{' '}
          {new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
        </p>
      </div>

      {/* KPI Cards */}
      <KPICardsRealtime initialKPIs={initialKPIs} />
      <TournamentPathTracker />

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — 2/3 width */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <UpcomingMatchesWidgetRealtime />
        </div>

        {/* Right column — 1/3 width */}
        <div className="flex flex-col gap-6">
          <ValueBetsWidgetRealtime />
          <GroupStandingsWidget competitionId="a1b2c3d4-e5f6-7890-abcd-ef1234567890" groupLetter="C" />
        </div>
      </div>

      {/* Simulación Monte Carlo a todo el ancho (reemplaza las gráficas fabricadas) */}
      <SimulationResultsWidget />
    </div>
  )
}
