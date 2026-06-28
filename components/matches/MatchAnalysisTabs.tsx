'use client'

import { useState } from 'react'
import { TrendingUp, BarChart2, DollarSign, Users, Sparkles, ShieldCheck, FlaskConical, Crosshair } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MatchPredictionPanel } from './MatchPredictionPanel'
import { ExactScoresTable } from './ExactScoresTable'
import { MatchStatsComparison } from './MatchStatsComparison'
import { TeamAvgStats } from './TeamAvgStats'
import { OddsComparisonTable } from './OddsComparisonTable'
import { LineupDisplay } from './LineupDisplay'
import { InjuriesPanel } from './InjuriesPanel'
import { SmartBetsPanel } from './SmartBetsPanel'
import { AISmartBetsPanel } from './AISmartBetsPanel'
import type { MatchFormEntry } from '@/lib/smartBetsEngine'
import { TeamComparisonRadar } from '@/components/charts/TeamComparisonRadar'
import { ProbabilityHistoryChart } from '@/components/charts/ProbabilityHistoryChart'
import { DataIntegrityPanel } from '@/components/intelligence/DataIntegrityPanel'
import { MonteCarloPanel } from '@/components/intelligence/MonteCarloPanel'
import { MatchDigitalTwin } from '@/components/digital-twin/MatchDigitalTwin'

const TABS = [
  { id: 'prediccion',   label: 'Predicción',    icon: TrendingUp    },
  { id: 'estadisticas', label: 'Estadísticas',  icon: BarChart2     },
  { id: 'cuotas',       label: 'Cuotas',        icon: DollarSign    },
  { id: 'alineaciones', label: 'Alineaciones',  icon: Users         },
  { id: 'smart-bets',   label: 'Smart Bets AI', icon: Sparkles      },
  { id: 'digital-twin', label: 'Digital Twin',  icon: Crosshair     },
  { id: 'montecarlo',   label: 'Monte Carlo',   icon: FlaskConical  },
  { id: 'auditoria',    label: 'Auditoría AI',  icon: ShieldCheck   },
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
  homeRecentMatches?: MatchFormEntry[]
  awayRecentMatches?: MatchFormEntry[]
  homeGroupContext?: import('@/app/api/analysis/match/[id]/route').GroupContext
  awayGroupContext?: import('@/app/api/analysis/match/[id]/route').GroupContext
}

function computeStatsFromForm(form: MatchFormEntry[]): Record<string, number | null> | null {
  if (!form || form.length === 0) return null
  const n = form.length
  function avg(key: keyof MatchFormEntry): number | null {
    const vals = form.map(m => m[key] as number | null | undefined).filter((v): v is number => v != null)
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }
  return {
    avg_goals_scored:    form.reduce((s, m) => s + m.goals_scored, 0) / n,
    avg_goals_conceded:  form.reduce((s, m) => s + m.goals_conceded, 0) / n,
    avg_xg:              avg('xg'),
    avg_xga:             avg('xga'),
    avg_corners:         avg('corners'),
    avg_yellow_cards:    avg('yellow_cards'),
    avg_red_cards:       avg('red_cards'),
    avg_possession:      avg('possession'),
    avg_shots:           avg('shots'),
    avg_shots_on_target: avg('shots_on_target'),
  }
}

export function MatchAnalysisTabs({
  match,
  prediction,
  matchStats,
  homeStats,
  awayStats,
  injuries,
  odds,
  homeRecentMatches,
  awayRecentMatches,
  homeGroupContext,
  awayGroupContext,
}: Props) {
  const [active, setActive] = useState<TabId>('prediccion')

  // Fallback: derive team stats from recent form when team_statistics table is empty
  const effectiveHomeStats = homeStats ?? computeStatsFromForm(homeRecentMatches ?? [])
  const effectiveAwayStats = awayStats ?? computeStatsFromForm(awayRecentMatches ?? [])

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

            {effectiveHomeStats && effectiveAwayStats ? (
              <>
                {!homeStats && (
                  <p className="text-[10px] text-zinc-600 text-center -mb-2">
                    Medias calculadas a partir de los últimos partidos registrados
                  </p>
                )}
                <TeamAvgStats
                  homeTeam={match.home_team}
                  awayTeam={match.away_team}
                  homeStats={effectiveHomeStats}
                  awayStats={effectiveAwayStats}
                />
                <TeamComparisonRadar
                  homeTeam={match.home_team}
                  awayTeam={match.away_team}
                  homeStats={effectiveHomeStats}
                  awayStats={effectiveAwayStats}
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
          <AISmartBetsPanel
            prediction={prediction}
            homeStats={effectiveHomeStats}
            awayStats={effectiveAwayStats}
            match={match}
            injuries={injuries}
            odds={odds}
            homeRecentMatches={homeRecentMatches}
            awayRecentMatches={awayRecentMatches}
            homeGroupContext={homeGroupContext}
            awayGroupContext={awayGroupContext}
          />
        )}

        {/* ── Digital Twin ── */}
        {active === 'digital-twin' && (
          <MatchDigitalTwin
            homeStats={effectiveHomeStats}
            awayStats={effectiveAwayStats}
            match={match}
          />
        )}

        {/* ── Monte Carlo ── */}
        {active === 'montecarlo' && (
          <MonteCarloPanel
            prediction={prediction}
            homeStats={effectiveHomeStats}
            awayStats={effectiveAwayStats}
            match={match}
            injuries={injuries}
          />
        )}

        {/* ── Auditoría AI ── */}
        {active === 'auditoria' && (
          <DataIntegrityPanel
            prediction={prediction}
            homeStats={effectiveHomeStats}
            awayStats={effectiveAwayStats}
            match={match}
            injuries={injuries}
            odds={odds}
          />
        )}
      </div>
    </div>
  )
}
