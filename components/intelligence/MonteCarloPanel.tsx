'use client'

import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { Zap, Target, Triangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { runMonteCarloModel, type MCResult, type Percentile } from '@/lib/models/monteCarloModel'
import { simulateEventTimeline } from '@/lib/intelligence/eventSimulator'
import { formToScore } from '@/lib/predictionEngine'
import { getMatchContext } from '@/lib/matchContext'

// ─── Sub-componentes ────────────────────────────────────────────────────────────

function PercentilesCard({ p50, p80, p95, homeCode, awayCode }: {
  p50: Percentile; p80: Percentile; p95: Percentile
  homeCode: string; awayCode: string
}) {
  const rows = [
    { label: 'Goles local',   p50: p50.homeGoals,    p80: p80.homeGoals,    p95: p95.homeGoals    },
    { label: 'Goles visitante', p50: p50.awayGoals,  p80: p80.awayGoals,    p95: p95.awayGoals    },
    { label: 'Goles totales', p50: p50.totalGoals,   p80: p80.totalGoals,   p95: p95.totalGoals   },
    { label: 'Corners',       p50: p50.corners,      p80: p80.corners,      p95: p95.corners      },
    { label: 'Tarjetas',      p50: p50.cards,        p80: p80.cards,        p95: p95.cards        },
    { label: 'Tiros puerta',  p50: p50.shotsOnTarget, p80: p80.shotsOnTarget, p95: p95.shotsOnTarget },
  ]

  return (
    <div className="card p-4">
      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        Intervalos de confianza
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left text-zinc-600 pb-2 font-medium">Métrica</th>
              <th className="text-center text-zinc-500 pb-2 font-medium">P50</th>
              <th className="text-center text-amber-500/70 pb-2 font-medium">P80</th>
              <th className="text-center text-red-500/70 pb-2 font-medium">P95</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {rows.map(row => (
              <tr key={row.label}>
                <td className="py-2 text-zinc-400">{row.label}</td>
                <td className="py-2 text-center mono text-zinc-300 font-medium">{row.p50}</td>
                <td className="py-2 text-center mono text-amber-400 font-medium">{row.p80}</td>
                <td className="py-2 text-center mono text-red-400 font-medium">{row.p95}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-zinc-700 mt-2">
        P50: el 50% de simulaciones resulta igual o menor · P80: 80% · P95: 95%
      </p>
    </div>
  )
}

function GoalDistributionChart({ dist, label, color }: {
  dist: Record<number, number>; label: string; color: string
}) {
  const data = Object.entries(dist)
    .map(([k, v]) => ({ goals: Number(k), prob: Math.round(v * 100) }))
    .sort((a, b) => a.goals - b.goals)
    .slice(0, 8)

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-zinc-500 font-medium">{label}</p>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={data} barSize={18} margin={{ top: 2, right: 0, bottom: 0, left: -20 }}>
          <XAxis dataKey="goals" tick={{ fontSize: 9, fill: '#52525b' }} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 6, fontSize: 11 }}
            formatter={(v: number) => [`${v}%`, 'Prob.']}
            labelFormatter={(l) => `${l} gol${l !== 1 ? 'es' : ''}`}
          />
          <Bar dataKey="prob" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={color} opacity={0.4 + entry.prob / 100 * 0.6} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function EventTimelineChart({ minuteByMinute, homeCode, awayCode }: {
  minuteByMinute: ReturnType<typeof simulateEventTimeline>['minuteByMinute']
  homeCode: string; awayCode: string
}) {
  const data = minuteByMinute.filter(d => d.minute % 5 === 0 || d.minute === 1 || d.minute === 90)

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-zinc-500 font-medium">Probabilidad acumulada de gol por minuto</p>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradHome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="gradAway" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <XAxis dataKey="minute" tick={{ fontSize: 9, fill: '#52525b' }} tickLine={false} axisLine={false}
            tickFormatter={v => v === 1 ? '1\'' : `${v}'`} />
          <YAxis hide domain={[0, 1]} />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 6, fontSize: 11 }}
            formatter={(v: number, name: string) => [
              `${(v * 100).toFixed(0)}%`,
              name === 'goalHomeCumProb' ? homeCode : awayCode
            ]}
            labelFormatter={l => `Minuto ${l}'`}
          />
          <Area type="monotone" dataKey="goalHomeCumProb" stroke="#10b981" strokeWidth={1.5} fill="url(#gradHome)" dot={false} />
          <Area type="monotone" dataKey="goalAwayCumProb" stroke="#ef4444" strokeWidth={1.5} fill="url(#gradAway)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-3">
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-4 bg-emerald-500" />
          <span className="text-[10px] text-zinc-600">{homeCode}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-4 bg-red-500" />
          <span className="text-[10px] text-zinc-600">{awayCode}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────────

interface Props {
  prediction: any | null
  homeStats: any | null
  awayStats: any | null
  match: any
  injuries: any[]
}

const ITERATION_OPTIONS = [1000, 3000, 10000] as const

export function MonteCarloPanel({ prediction, homeStats, awayStats, match, injuries }: Props) {
  const [iterations, setIterations] = useState<1000 | 3000 | 10000>(3000)

  const homeCode = match?.home_team?.code ?? 'LOC'
  const awayCode = match?.away_team?.code ?? 'VIS'

  const result = useMemo<MCResult | null>(() => {
    if (!prediction) return null

    const { goalMult: goalsF, cornersF, homeRestF, awayRestF } = getMatchContext(match)

    // Lambdas base desde la predicción almacenada
    // Si no hay xG, usamos los marcadores predichos como proxy
    const homeXg = homeStats?.avg_xg ?? prediction.predicted_home_score ?? 1.2
    const awayXg = awayStats?.avg_xg ?? prediction.predicted_away_score ?? 1.0
    const homeXga = homeStats?.avg_xga ?? awayXg
    const awayXga = awayStats?.avg_xga ?? homeXg

    const baseHome   = Math.max(0.2, (homeXg + awayXga) / 2) * goalsF * homeRestF
    const baseAway   = Math.max(0.2, (awayXg + homeXga) / 2) * goalsF * awayRestF
    const baseCorners = ((homeStats?.avg_corners ?? 4.5) + (awayStats?.avg_corners ?? 5.0)) * cornersF
    const baseCards   = (homeStats?.avg_yellow_cards ?? 1.8) + (awayStats?.avg_yellow_cards ?? 1.7)
    const baseShotsOT = (homeStats?.avg_shots_on_target ?? 3.5) + (awayStats?.avg_shots_on_target ?? 3.0)

    // Factor lesiones — separado por equipo
    const homeInjuryImpact = injuries
      .filter((inj: any) => inj.team_id === match?.home_team_id)
      .reduce((sum: number, inj: any) => sum + (inj.impact_score ?? 0), 0)
    const awayInjuryImpact = injuries
      .filter((inj: any) => inj.team_id === match?.away_team_id)
      .reduce((sum: number, inj: any) => sum + (inj.impact_score ?? 0), 0)
    const homeInjF = Math.max(0.80, 1 - homeInjuryImpact / 100)
    const awayInjF = Math.max(0.80, 1 - awayInjuryImpact / 100)

    return runMonteCarloModel({
      lambdaHome:    baseHome   * homeInjF,
      lambdaAway:    baseAway   * awayInjF,
      lambdaCorners: baseCorners,
      lambdaCards:   baseCards,
      lambdaShotsOT: baseShotsOT,
      iterations,
      phase: match?.phase,
      weatherCondition: match?.weather_condition,
      homeRestDays: match?.home_rest_days,
      awayRestDays: match?.away_rest_days,
    })
  }, [prediction, homeStats, awayStats, match, injuries, iterations])

  const eventSim = useMemo(() => {
    if (!result) return null
    return simulateEventTimeline({
      lambdaHome: result.expectedGoalsHome,
      lambdaAway: result.expectedGoalsAway,
      lambdaCorners: result.expectedCorners,
      lambdaCards: result.expectedCards,
    })
  }, [result])

  if (!prediction) {
    return (
      <div className="card p-10 flex flex-col items-center gap-3 text-center">
        <Target className="h-8 w-8 text-zinc-700" />
        <p className="text-sm font-medium text-zinc-500">Sin predicción disponible</p>
        <p className="text-xs text-zinc-600 max-w-xs">
          El simulador necesita una predicción generada para ejecutar el modelo Monte Carlo.
        </p>
      </div>
    )
  }

  if (!result) return null

  const { probabilities, p50, p80, p95, iterationsUsed } = result

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-400 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white">Simulación Monte Carlo</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {iterationsUsed.toLocaleString()} iteraciones · rejilla Poisson analítica
            </p>
          </div>
        </div>

        {/* Selector de iteraciones */}
        <div className="flex gap-1">
          {ITERATION_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => setIterations(n)}
              className={cn(
                'px-2 py-1 text-[10px] rounded font-mono font-medium border transition-colors',
                iterations === n
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                  : 'bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:text-zinc-300'
              )}
            >
              {n >= 1000 ? `${n / 1000}K` : n}
            </button>
          ))}
        </div>
      </div>

      {/* Probabilidades principales */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: homeCode, prob: probabilities.home, color: 'text-emerald-400', bar: 'bg-emerald-500' },
          { label: 'Empate', prob: probabilities.draw, color: 'text-amber-400',   bar: 'bg-amber-500'   },
          { label: awayCode, prob: probabilities.away, color: 'text-red-400',     bar: 'bg-red-500'     },
        ].map(item => (
          <div key={item.label} className="card p-3 text-center space-y-1.5">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{item.label}</p>
            <p className={cn('text-2xl font-black mono', item.color)}>
              {(item.prob * 100).toFixed(0)}%
            </p>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full', item.bar)} style={{ width: `${item.prob * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Marcador más probable */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-3.5 w-3.5 text-amber-400" />
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Marcadores más probables
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {result.exactScores.slice(0, 5).map((score, i) => (
            <div
              key={`${score.home}-${score.away}`}
              className={cn(
                'text-center rounded-lg p-2 border',
                i === 0
                  ? 'border-amber-500/30 bg-amber-500/10'
                  : 'border-zinc-800 bg-zinc-900/40'
              )}
            >
              <p className={cn('text-lg font-black mono', i === 0 ? 'text-amber-400' : 'text-zinc-300')}>
                {score.home}–{score.away}
              </p>
              <p className="text-[10px] text-zinc-600 mono">{(score.prob * 100).toFixed(1)}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Distribuciones de goles */}
      <div className="card p-4 space-y-4">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Distribución de goles
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <GoalDistributionChart dist={result.goalDistributionHome} label={`${homeCode} (goles)`} color="#10b981" />
          <GoalDistributionChart dist={result.goalDistributionAway} label={`${awayCode} (goles)`} color="#ef4444" />
          <GoalDistributionChart dist={result.totalGoalsDistribution} label="Total partido"        color="#3b82f6" />
        </div>
      </div>

      {/* Timeline de eventos */}
      {eventSim && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Timeline de eventos
            </h4>
            <span className="text-[10px] text-zinc-600">
              Primer gol esperado: min. {eventSim.expectedFirstGoalMinute}'
            </span>
          </div>

          <EventTimelineChart
            minuteByMinute={eventSim.minuteByMinute}
            homeCode={homeCode}
            awayCode={awayCode}
          />

          {/* Minutos calientes */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {[
              { code: homeCode, minutes: eventSim.mostLikelyGoalMinutes.home, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
              { code: awayCode, minutes: eventSim.mostLikelyGoalMinutes.away, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
            ].map(({ code, minutes, color }) => (
              <div key={code}>
                <p className="text-[10px] text-zinc-600 mb-1.5">{code} · minutos calientes</p>
                <div className="flex flex-wrap gap-1">
                  {minutes.map(m => (
                    <span key={m} className={cn('text-[10px] mono font-bold border rounded px-1.5 py-0.5', color)}>
                      {m}'
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intervalos de confianza */}
      <PercentilesCard p50={p50} p80={p80} p95={p95} homeCode={homeCode} awayCode={awayCode} />

      {/* Nota metodológica */}
      <div className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
        <Triangle className="h-3.5 w-3.5 text-blue-500/40 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Las probabilidades 1X2 se derivan de la rejilla Poisson analítica (equivalente a 100K MC).
          Los percentiles P50/P80/P95 y distribuciones de corners/tarjetas usan {iterationsUsed.toLocaleString()} simulaciones estocásticas adicionales.
        </p>
      </div>
    </div>
  )
}
