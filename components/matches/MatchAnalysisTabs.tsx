'use client'

import { useState } from 'react'
import { TrendingUp, BarChart2, DollarSign, Users, Sparkles, ShieldCheck, FlaskConical, Crosshair, Swords, Star, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GroupContext } from '@/app/api/analysis/match/[id]/route'
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
import { ResponsibleGamingNotice } from '@/components/ui/ResponsibleGamingNotice'
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

// ─── Always-available comparison panel using ELO + Rankings + Group ──────────
function ComparisonBar({ label, homeVal, awayVal, higherIsBetter = true, format }: {
  label: string; homeVal: number; awayVal: number; higherIsBetter?: boolean; format?: (v: number) => string
}) {
  const total = homeVal + awayVal || 1
  const homeWins = higherIsBetter ? homeVal > awayVal : homeVal < awayVal
  const awayWins = higherIsBetter ? awayVal > homeVal : awayVal < homeVal
  const fmt = format ?? ((v: number) => v.toString())
  const homePct = (homeVal / total) * 100
  const awayPct = (awayVal / total) * 100
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-bold mono w-14', homeWins ? 'text-emerald-400' : 'text-zinc-300')}>{fmt(homeVal)}</span>
        <span className="text-[10px] text-zinc-500 text-center flex-1">{label}</span>
        <span className={cn('font-bold mono w-14 text-right', awayWins ? 'text-blue-400' : 'text-zinc-300')}>{fmt(awayVal)}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800">
        <div className={cn('transition-all duration-700', homeWins ? 'bg-emerald-500' : 'bg-zinc-600')} style={{ width: `${homePct}%` }} />
        <div className={cn('transition-all duration-700', awayWins ? 'bg-blue-500' : 'bg-zinc-700')} style={{ width: `${awayPct}%` }} />
      </div>
    </div>
  )
}

function TeamPowerComparison({ match, homeGroupCtx, awayGroupCtx, homeFormStats, awayFormStats }: {
  match: any
  homeGroupCtx?: GroupContext
  awayGroupCtx?: GroupContext
  homeFormStats: Record<string, number | null> | null
  awayFormStats: Record<string, number | null> | null
}) {
  const home = match.home_team
  const away = match.away_team
  const hElo  = home?.elo_rating  ?? 1500
  const aElo  = away?.elo_rating  ?? 1500
  const hRank = home?.fifa_ranking ?? 0
  const aRank = away?.fifa_ranking ?? 0

  // Goals from group stage (most reliable source)
  const hPlayed = homeGroupCtx ? (homeGroupCtx.won + homeGroupCtx.drawn + homeGroupCtx.lost) : 0
  const aPlayed = awayGroupCtx ? (awayGroupCtx.won + awayGroupCtx.drawn + awayGroupCtx.lost) : 0
  const hGF = hPlayed > 0 ? homeGroupCtx!.goalsFor  / hPlayed : (homeFormStats?.avg_goals_scored ?? null)
  const hGA = hPlayed > 0 ? homeGroupCtx!.goalsAgainst / hPlayed : (homeFormStats?.avg_goals_conceded ?? null)
  const aGF = aPlayed > 0 ? awayGroupCtx!.goalsFor  / aPlayed : (awayFormStats?.avg_goals_scored ?? null)
  const aGA = aPlayed > 0 ? awayGroupCtx!.goalsAgainst / aPlayed : (awayFormStats?.avg_goals_conceded ?? null)

  return (
    <div className="card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Comparación de Equipos</h3>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-emerald-400 font-bold">{home?.code}</span>
          <span className="text-zinc-600">vs</span>
          <span className="text-blue-400 font-bold">{away?.code}</span>
        </div>
      </div>

      {/* ELO + FIFA */}
      <div className="space-y-3">
        <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Ranking &amp; Poder</p>
        <ComparisonBar label="ELO Rating" homeVal={hElo} awayVal={aElo} />
        {hRank > 0 && aRank > 0 && (
          <ComparisonBar
            label="Ranking FIFA"
            homeVal={hRank}
            awayVal={aRank}
            higherIsBetter={false}
            format={(v) => `#${v}`}
          />
        )}
      </div>

      {/* Group stage record */}
      {(homeGroupCtx || awayGroupCtx) && (
        <div className="space-y-3">
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Fase de Grupos</p>
          {hPlayed > 0 && aPlayed > 0 && (
            <ComparisonBar label="Victorias" homeVal={homeGroupCtx!.won} awayVal={awayGroupCtx!.won} />
          )}
          {hGF !== null && aGF !== null && (
            <ComparisonBar label="Goles/partido" homeVal={+hGF.toFixed(2)} awayVal={+aGF.toFixed(2)} format={(v) => v.toFixed(2)} />
          )}
          {hGA !== null && aGA !== null && (
            <ComparisonBar label="Concedidos/partido" homeVal={+hGA.toFixed(2)} awayVal={+aGA.toFixed(2)} higherIsBetter={false} format={(v) => v.toFixed(2)} />
          )}
          {hPlayed > 0 && aPlayed > 0 && (
            <ComparisonBar
              label="Puntos obtenidos"
              homeVal={homeGroupCtx!.points}
              awayVal={awayGroupCtx!.points}
            />
          )}
        </div>
      )}

      {/* Form goals if no group ctx but form exists */}
      {!homeGroupCtx && !awayGroupCtx && homeFormStats && awayFormStats && (
        <div className="space-y-3">
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Forma reciente</p>
          {homeFormStats.avg_goals_scored !== null && awayFormStats.avg_goals_scored !== null && (
            <ComparisonBar label="Goles/partido" homeVal={homeFormStats.avg_goals_scored!} awayVal={awayFormStats.avg_goals_scored!} format={(v) => v.toFixed(2)} />
          )}
          {homeFormStats.avg_goals_conceded !== null && awayFormStats.avg_goals_conceded !== null && (
            <ComparisonBar label="Concedidos/partido" homeVal={homeFormStats.avg_goals_conceded!} awayVal={awayFormStats.avg_goals_conceded!} higherIsBetter={false} format={(v) => v.toFixed(2)} />
          )}
        </div>
      )}

      {/* Additional stats if available */}
      {homeFormStats && awayFormStats && (
        (() => {
          const rows: Array<{ label: string; h: number; a: number; hib?: boolean; fmt?: (v: number) => string }> = []
          if (homeFormStats.avg_xg != null && awayFormStats.avg_xg != null)
            rows.push({ label: 'xG/partido', h: homeFormStats.avg_xg, a: awayFormStats.avg_xg, fmt: (v) => v.toFixed(2) })
          if (homeFormStats.avg_xga != null && awayFormStats.avg_xga != null)
            rows.push({ label: 'xGA/partido', h: homeFormStats.avg_xga, a: awayFormStats.avg_xga, hib: false, fmt: (v) => v.toFixed(2) })
          if (homeFormStats.avg_shots != null && awayFormStats.avg_shots != null)
            rows.push({ label: 'Tiros/partido', h: homeFormStats.avg_shots, a: awayFormStats.avg_shots, fmt: (v) => v.toFixed(1) })
          if (homeFormStats.avg_corners != null && awayFormStats.avg_corners != null)
            rows.push({ label: 'Córners/partido', h: homeFormStats.avg_corners, a: awayFormStats.avg_corners, fmt: (v) => v.toFixed(1) })
          if (homeFormStats.avg_possession != null && awayFormStats.avg_possession != null)
            rows.push({ label: 'Posesión %', h: homeFormStats.avg_possession, a: awayFormStats.avg_possession, fmt: (v) => `${v.toFixed(0)}%` })
          if (rows.length === 0) return null
          return (
            <div className="space-y-3">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Estadísticas de juego</p>
              {rows.map(r => (
                <ComparisonBar key={r.label} label={r.label} homeVal={r.h} awayVal={r.a} higherIsBetter={r.hib ?? true} format={r.fmt} />
              ))}
            </div>
          )
        })()
      )}

      {/* Group records text */}
      {(homeGroupCtx || awayGroupCtx) && (
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800">
          {[
            { team: home, grp: homeGroupCtx, color: 'emerald' },
            { team: away, grp: awayGroupCtx, color: 'blue' },
          ].map(({ team, grp, color }) => grp ? (
            <div key={team?.code} className="rounded-lg bg-zinc-900 border border-zinc-800 p-2.5">
              <p className={cn('text-[10px] font-bold mb-1', color === 'emerald' ? 'text-emerald-400' : 'text-blue-400')}>
                {grp.groupName} — {grp.position}°
              </p>
              <p className="text-[11px] text-zinc-400 mono">{grp.won}V {grp.drawn}E {grp.lost}D · {grp.goalsFor}:{grp.goalsAgainst}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{grp.points} puntos</p>
            </div>
          ) : null)}
        </div>
      )}
    </div>
  )
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
            {/* Always-visible power comparison: ELO + FIFA + group stage data */}
            <TeamPowerComparison
              match={match}
              homeGroupCtx={homeGroupContext}
              awayGroupCtx={awayGroupContext}
              homeFormStats={computeStatsFromForm(homeRecentMatches ?? [])}
              awayFormStats={computeStatsFromForm(awayRecentMatches ?? [])}
            />

            {matchStats.length > 0 && (
              <MatchStatsComparison
                stats={matchStats}
                homeTeam={match.home_team}
                awayTeam={match.away_team}
              />
            )}

            {effectiveHomeStats && effectiveAwayStats && (
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
            )}
          </div>
        )}

        {/* ── Cuotas ── */}
        {active === 'cuotas' && (
          <div className="space-y-4">
            <OddsComparisonTable
              odds={odds}
              prediction={prediction}
              homeTeam={match.home_team}
              awayTeam={match.away_team}
            />
            <ResponsibleGamingNotice demoOdds />
          </div>
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
          <div className="space-y-4">
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
            <ResponsibleGamingNotice demoOdds />
          </div>
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
