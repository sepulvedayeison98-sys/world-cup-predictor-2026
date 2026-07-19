'use client'

import { useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import {
  RotateCcw, Layers, ChevronDown, ChevronUp,
  Zap, AlertTriangle, CloudLightning, Users,
} from 'lucide-react'
import { applyScenario, type SimScenario, type SimResult } from '@/lib/scenarioEngine'

// ─── Opciones del formulario ─────────────────────────────────

const FORMATIONS = ['4-3-3','4-2-3-1','3-5-2','4-4-2','5-3-2','3-4-3','4-1-4-1','4-5-1']
const WEATHER_OPTIONS = [
  { value: 'Clear',     label: '☀️ Despejado' },
  { value: 'Cloudy',    label: '☁️ Nublado' },
  { value: 'Rain',      label: '🌧️ Lluvia' },
  { value: 'HeavyRain', label: '⛈️ Tormenta' },
  { value: 'Wind',      label: '💨 Mucho viento' },
  { value: 'Extreme',   label: '🌪️ Condiciones extremas' },
]

// ─── Sub-components ───────────────────────────────────────────

function DeltaBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.005) return <span className="text-[10px] text-zinc-600">=</span>
  const pct = (value * 100).toFixed(1)
  return (
    <span className={cn('text-[10px] font-bold mono', value > 0 ? 'text-emerald-400' : 'text-red-400')}>
      {value > 0 ? '+' : ''}{pct}%
    </span>
  )
}

function PlayerToggle({
  player, isSelected, onToggle, disabled = false,
}: {
  player: any; isSelected: boolean; onToggle: () => void; disabled?: boolean
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled || player.status === 'injured'}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all border',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        isSelected
          ? 'bg-red-500/15 border-red-500/40 text-red-300'
          : player.status === 'injured'
          ? 'bg-zinc-800/60 border-zinc-800 text-zinc-600 line-through'
          : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100'
      )}
    >
      <span className="mono text-[10px] text-zinc-500 w-4">{player.number}</span>
      <span className="truncate max-w-[80px]">{player.short_name ?? player.name.split(' ').pop()}</span>
      <span className="text-[10px] text-zinc-600">{player.position}</span>
      {isSelected && <span className="ml-auto text-[10px]">✗</span>}
    </button>
  )
}

function ResultGauge({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="#27272a" strokeWidth="3.5" />
          <circle
            cx="18" cy="18" r="14" fill="none"
            stroke={color} strokeWidth="3.5"
            strokeDasharray={`${pct * 0.88} 88`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mono">
          {pct}%
        </span>
      </div>
      <p className="text-[10px] text-zinc-500">{label}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────

interface Props {
  matches: any[]
  activeInjuries: any[]
  userId: string
}

export function SimulationEngine({ matches, activeInjuries, userId }: Props) {
  const [selectedMatchId, setSelectedMatchId] = useState<string>(matches[0]?.id ?? '')
  const [scenario, setScenario] = useState<SimScenario>({
    home_injuries: [], away_injuries: [],
    home_suspensions: [], away_suspensions: [],
    weather: 'Clear', home_formation: '4-3-3', away_formation: '4-2-3-1',
    scenario_name: 'Escenario 1',
  })
  const [savedResults, setSavedResults] = useState<{ scenario: SimScenario; result: SimResult; matchId: string }[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  const selectedMatch = useMemo(
    () => matches.find(m => m.id === selectedMatchId),
    [matches, selectedMatchId]
  )

  const basePrediction = useMemo(() => {
    const preds = selectedMatch?.predictions
    return Array.isArray(preds) ? preds[0] : preds
  }, [selectedMatch])

  const result = useMemo(() => {
    if (!selectedMatch) return null
    return applyScenario(
      basePrediction, scenario,
      selectedMatch.home_team, selectedMatch.away_team,
      activeInjuries
    )
  }, [selectedMatch, basePrediction, scenario, activeInjuries])

  const togglePlayer = useCallback((side: 'home' | 'away', type: 'injuries' | 'suspensions', playerId: string) => {
    const key = `${side}_${type}` as keyof SimScenario
    setScenario(prev => {
      const current = prev[key] as string[]
      return {
        ...prev,
        [key]: current.includes(playerId)
          ? current.filter(id => id !== playerId)
          : [...current, playerId],
      }
    })
  }, [])

  const reset = () => setScenario({
    home_injuries: [], away_injuries: [],
    home_suspensions: [], away_suspensions: [],
    weather: 'Clear', home_formation: '4-3-3', away_formation: '4-2-3-1',
    scenario_name: 'Escenario 1',
  })

  const saveScenario = () => {
    if (!result) return
    setSavedResults(prev => [{ scenario, result, matchId: selectedMatchId }, ...prev].slice(0, 5))
  }

  const totalMods = scenario.home_injuries.length + scenario.away_injuries.length +
                   scenario.home_suspensions.length + scenario.away_suspensions.length +
                   (scenario.weather !== 'Clear' ? 1 : 0)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

      {/* ── Left: Controls ─────────────────────────────── */}
      <div className="space-y-4 lg:col-span-2">

        {/* Match selector */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-violet-400" /> Seleccionar Partido
          </h3>
          <select
            value={selectedMatchId}
            onChange={e => { setSelectedMatchId(e.target.value); reset() }}
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500/50"
          >
            {matches.map(m => (
              <option key={m.id} value={m.id}>
                {m.home_team?.code} vs {m.away_team?.code} · {format(new Date(m.kickoff_time), "d MMM · HH:mm", { locale: es })} · {m.venue}
              </option>
            ))}
          </select>

          {/* Scenario name */}
          <input
            type="text"
            value={scenario.scenario_name}
            onChange={e => setScenario(p => ({ ...p, scenario_name: e.target.value }))}
            placeholder="Nombre del escenario"
            className="mt-2 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
          />
        </div>

        {selectedMatch && (
          <>
            {/* Home team injuries/suspensions */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                {selectedMatch.home_team?.name} — Bajas simuladas
                {(scenario.home_injuries.length + scenario.home_suspensions.length) > 0 && (
                  <span className="ml-auto text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5">
                    {scenario.home_injuries.length + scenario.home_suspensions.length} seleccionadas
                  </span>
                )}
              </h3>
              <div className="mb-2">
                <p className="text-[10px] text-zinc-600 mb-1.5">Lesiones simuladas</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedMatch.home_team?.players ?? []).map((p: any) => (
                    <PlayerToggle
                      key={p.id}
                      player={p}
                      isSelected={scenario.home_injuries.includes(p.id)}
                      onToggle={() => togglePlayer('home', 'injuries', p.id)}
                      disabled={scenario.home_suspensions.includes(p.id)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 mb-1.5 mt-3">Suspensiones simuladas</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedMatch.home_team?.players ?? []).map((p: any) => (
                    <PlayerToggle
                      key={p.id}
                      player={{ ...p, status: scenario.home_injuries.includes(p.id) ? 'injured' : p.status }}
                      isSelected={scenario.home_suspensions.includes(p.id)}
                      onToggle={() => togglePlayer('home', 'suspensions', p.id)}
                      disabled={scenario.home_injuries.includes(p.id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Away team */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-400" />
                {selectedMatch.away_team?.name} — Bajas simuladas
                {(scenario.away_injuries.length + scenario.away_suspensions.length) > 0 && (
                  <span className="ml-auto text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5">
                    {scenario.away_injuries.length + scenario.away_suspensions.length} seleccionadas
                  </span>
                )}
              </h3>
              <div className="mb-2">
                <p className="text-[10px] text-zinc-600 mb-1.5">Lesiones simuladas</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedMatch.away_team?.players ?? []).map((p: any) => (
                    <PlayerToggle
                      key={p.id}
                      player={p}
                      isSelected={scenario.away_injuries.includes(p.id)}
                      onToggle={() => togglePlayer('away', 'injuries', p.id)}
                      disabled={scenario.away_suspensions.includes(p.id)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 mb-1.5 mt-3">Suspensiones simuladas</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedMatch.away_team?.players ?? []).map((p: any) => (
                    <PlayerToggle
                      key={p.id}
                      player={{ ...p, status: scenario.away_injuries.includes(p.id) ? 'injured' : p.status }}
                      isSelected={scenario.away_suspensions.includes(p.id)}
                      onToggle={() => togglePlayer('away', 'suspensions', p.id)}
                      disabled={scenario.away_injuries.includes(p.id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Advanced: weather + formations */}
            <div className="card overflow-hidden">
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-semibold text-white flex items-center gap-2">
                  <CloudLightning className="h-4 w-4 text-amber-400" />
                  Condiciones y Tácticas
                </span>
                {showAdvanced ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
              </button>

              {showAdvanced && (
                <div className="border-t border-zinc-800 p-4 space-y-4">
                  {/* Weather */}
                  <div>
                    <p className="text-xs font-medium text-zinc-400 mb-2">Condición climática</p>
                    <div className="flex flex-wrap gap-1.5">
                      {WEATHER_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setScenario(p => ({ ...p, weather: opt.value }))}
                          className={cn(
                            'rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors',
                            scenario.weather === opt.value
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Formations */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-zinc-400 mb-2">{selectedMatch.home_team?.code} — Formación</p>
                      <div className="flex flex-wrap gap-1">
                        {FORMATIONS.map(f => (
                          <button
                            key={f}
                            onClick={() => setScenario(p => ({ ...p, home_formation: f }))}
                            className={cn(
                              'rounded px-2 py-1 text-[11px] font-mono border transition-colors',
                              scenario.home_formation === f
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                            )}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-400 mb-2">{selectedMatch.away_team?.code} — Formación</p>
                      <div className="flex flex-wrap gap-1">
                        {FORMATIONS.map(f => (
                          <button
                            key={f}
                            onClick={() => setScenario(p => ({ ...p, away_formation: f }))}
                            className={cn(
                              'rounded px-2 py-1 text-[11px] font-mono border transition-colors',
                              scenario.away_formation === f
                                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                            )}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 transition-colors"
          >
            <RotateCcw className="h-4 w-4" /> Resetear
          </button>
          <button
            onClick={saveScenario}
            disabled={!result}
            className="flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-300 hover:bg-violet-500/20 transition-colors disabled:opacity-40"
          >
            <Layers className="h-4 w-4" /> Añadir a comparación
          </button>
        </div>
      </div>

      {/* ── Right: Live Result ──────────────────────────── */}
      <div className="space-y-4">

        {/* Live result card */}
        <div className="card p-4 sticky top-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Resultado en Tiempo Real</h3>
            <div className="flex items-center gap-1.5">
              {totalMods > 0 && (
                <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded px-1.5 py-0.5">
                  {totalMods} modificación{totalMods > 1 ? 'es' : ''}
                </span>
              )}
              <span className="live-dot" />
            </div>
          </div>

          {result && selectedMatch ? (
            <>
              {/* Match label */}
              <div className="text-center mb-4">
                <p className="text-xs font-semibold text-zinc-300">
                  {selectedMatch.home_team?.code} vs {selectedMatch.away_team?.code}
                </p>
                <p className="text-[10px] text-zinc-600">{scenario.scenario_name}</p>
              </div>

              {/* Gauges */}
              <div className="flex justify-around mb-4">
                <ResultGauge label={selectedMatch.home_team?.code} value={result.home_win_probability} color="#10b981" />
                <ResultGauge label="X" value={result.draw_probability} color="#f59e0b" />
                <ResultGauge label={selectedMatch.away_team?.code} value={result.away_win_probability} color="#ef4444" />
              </div>

              {/* Stacked bar */}
              <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800 mb-3">
                <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${result.home_win_probability * 100}%` }} />
                <div className="bg-amber-500 transition-all duration-500"   style={{ width: `${result.draw_probability * 100}%` }} />
                <div className="bg-red-500 transition-all duration-500"     style={{ width: `${result.away_win_probability * 100}%` }} />
              </div>

              {/* Predicted score */}
              <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 mb-4 text-center">
                <p className="text-[10px] text-zinc-500 mb-1">Marcador estimado</p>
                <p className="text-3xl font-black mono text-white">
                  {result.predicted_home_score}–{result.predicted_away_score}
                </p>
              </div>

              {/* Deltas vs base */}
              {totalMods > 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 mb-4">
                  <p className="text-[10px] text-zinc-500 mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Cambio vs predicción base
                  </p>
                  <div className="space-y-1">
                    {[
                      { label: `${selectedMatch.home_team?.code}`, delta: result.delta.home },
                      { label: 'Empate', delta: result.delta.draw },
                      { label: `${selectedMatch.away_team?.code}`, delta: result.delta.away },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500">{r.label}</span>
                        <DeltaBadge value={r.delta} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] text-zinc-500">Confianza del modelo</span>
                <span className={cn('text-sm font-bold mono',
                  result.confidence_score >= 70 ? 'text-emerald-400' :
                  result.confidence_score >= 50 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {result.confidence_score.toFixed(0)}%
                </span>
              </div>

              {/* Top scorelines */}
              {result.top_scorelines.length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-2">Marcadores más probables</p>
                  <div className="space-y-1">
                    {result.top_scorelines.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="mono text-xs font-bold text-zinc-300 w-10">{s.home}–{s.away}</span>
                        <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', i === 0 ? 'bg-emerald-500' : 'bg-zinc-600')}
                            style={{ width: `${(s.prob / result.top_scorelines[0].prob) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] mono text-zinc-500 w-8 text-right">
                          {(s.prob * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-500">Selecciona un partido para simular</p>
            </div>
          )}
        </div>

        {/* Saved scenarios */}
        {savedResults.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white mb-1">Escenarios en comparación</h3>
            <p className="text-[10px] text-zinc-600 mb-3">Comparación temporal — se reinicia al recargar la página</p>
            <div className="space-y-2">
              {savedResults.map((saved, i) => {
                const match = matches.find(m => m.id === saved.matchId)
                return (
                  <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-semibold text-zinc-200">{saved.scenario.scenario_name}</p>
                      <p className="text-[10px] text-zinc-600">
                        {match?.home_team?.code} vs {match?.away_team?.code}
                      </p>
                    </div>
                    <div className="flex gap-3 text-[10px] mono">
                      <span className="text-emerald-400">{Math.round(saved.result.home_win_probability * 100)}%</span>
                      <span className="text-amber-400">{Math.round(saved.result.draw_probability * 100)}%</span>
                      <span className="text-red-400">{Math.round(saved.result.away_win_probability * 100)}%</span>
                      <span className="ml-auto text-zinc-400 font-bold">
                        {saved.result.predicted_home_score}–{saved.result.predicted_away_score}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
