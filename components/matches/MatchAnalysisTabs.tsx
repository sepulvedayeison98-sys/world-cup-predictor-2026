'use client'

import { useState } from 'react'
import { TrendingUp, BarChart2, DollarSign, Users, Sparkles, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MatchPredictionPanel } from './MatchPredictionPanel'
import { ExactScoresTable } from './ExactScoresTable'
import { MatchStatsComparison } from './MatchStatsComparison'
import { TeamAvgStats } from './TeamAvgStats'
import { OddsComparisonTable } from './OddsComparisonTable'
import { LineupDisplay } from './LineupDisplay'
import { InjuriesPanel } from './InjuriesPanel'
import { SmartBetsPanel } from './SmartBetsPanel'
import { TeamComparisonRadar } from '@/components/charts/TeamComparisonRadar'
import { ProbabilityHistoryChart } from '@/components/charts/ProbabilityHistoryChart'
import { DataIntegrityPanel } from '@/components/intelligence/DataIntegrityPanel'

const TABS = [
  { id: 'prediccion',   label: 'Predicción',    icon: TrendingUp  },
  { id: 'estadisticas', label: 'Estadísticas',  icon: BarChart2   },
  { id: 'cuotas',       label: 'Cuotas',        icon: DollarSign  },
  { id: 'alineaciones', label: 'Alineaciones',  icon: Users       },
  { id: 'smart-bets',   label: 'Smart Bets AI', icon: Sparkles    },
  { id: 'auditoria',    label: 'Auditoría AI',  icon: ShieldCheck },
] as const

type TabId = typeof TABS[number]['id']

interface Props {
  match: any
  prediction: any | null
  matchStats: any[]
  homeStats: any | null
  awayStats: any | null
  injuries: any[]
  odds: any[]
}

export function MatchAnalysisTabs({
  match,
  prediction,
  matchStats,
  homeStats,
  awayStats,
  injuries,
  odds,
}: Props) {
  const [active, setActive] = useState<TabId>('prediccion')

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-zinc-800 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="mt-6">

        {/* ── Predicción ── */}
        {active === 'prediccion' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-6">
              {prediction ? (
                <>
                  <MatchPredictionPanel prediction={prediction} match={match} />
                  {(prediction.exact_score_predictions?.length ?? 0) > 0 && (
                    <ExactScoresTable scores={prediction.exact_score_predictions} />
                  )}
                </>
              ) : (
                <div className="card p-8 text-center text-zinc-500 text-sm">
                  Sin predicción disponible para este partido.
                </div>
              )}
            </div>
            <div className="lg:col-span-2">
              <ProbabilityHistoryChart matchId={match.id} />
            </div>
          </div>
        )}

        {/* ── Estadísticas ── */}
        {active === 'estadisticas' && (
          <div className="space-y-6">
            {matchStats.length > 0 && (
              <MatchStatsComparison
                stats={matchStats}
                homeTeam={match.home_team}
                awayTeam={match.away_team}
              />
            )}

            {homeStats && awayStats ? (
              <>
                <TeamAvgStats
                  homeTeam={match.home_team}
                  awayTeam={match.away_team}
                  homeStats={homeStats}
                  awayStats={awayStats}
                />
                <TeamComparisonRadar
                  homeTeam={match.home_team}
                  awayTeam={match.away_team}
                  homeStats={homeStats}
                  awayStats={awayStats}
                />
              </>
            ) : matchStats.length === 0 ? (
              <div className="card p-8 text-center text-zinc-500 text-sm">
                Sin estadísticas disponibles para este partido.
              </div>
            ) : null}
          </div>
        )}

        {/* ── Cuotas ── */}
        {active === 'cuotas' && (
          <OddsComparisonTable
            odds={odds}
            prediction={prediction}
            homeTeam={match.home_team}
            awayTeam={match.away_team}
          />
        )}

        {/* ── Alineaciones ── */}
        {active === 'alineaciones' && (
          <div className="space-y-6">
            <LineupDisplay
              matchId={match.id}
              homeTeam={match.home_team}
              awayTeam={match.away_team}
            />
            <InjuriesPanel
              injuries={injuries}
              homeTeamId={match.home_team_id}
              awayTeamId={match.away_team_id}
              homeTeam={match.home_team}
              awayTeam={match.away_team}
            />
          </div>
        )}

        {/* ── Smart Bets AI ── */}
        {active === 'smart-bets' && (
          <SmartBetsPanel
            prediction={prediction}
            homeStats={homeStats}
            awayStats={awayStats}
            match={match}
            injuries={injuries}
          />
        )}

        {/* ── Auditoría AI ── */}
        {active === 'auditoria' && (
          <DataIntegrityPanel
            prediction={prediction}
            homeStats={homeStats}
            awayStats={awayStats}
            match={match}
            injuries={injuries}
            odds={odds}
          />
        )}
      </div>
    </div>
  )
}
