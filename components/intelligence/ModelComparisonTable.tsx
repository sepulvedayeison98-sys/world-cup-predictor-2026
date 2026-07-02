'use client'

import { cn } from '@/lib/utils'
import { type ModelComparison } from '@/lib/agents/predictionEngineAgent'

interface Props {
  models: ModelComparison[]
  homeCode: string
  awayCode: string
}

function ProbBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('text-xs font-bold mono w-9 text-right shrink-0', color)}>
        {(value * 100).toFixed(0)}%
      </span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color === 'text-emerald-400' ? 'bg-emerald-500' : color === 'text-amber-400' ? 'bg-amber-500' : 'bg-red-500')}
          style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  )
}

const MODEL_ICON: Record<string, string> = {
  elo:      '⚡',
  poisson:  '📊',
  xg:       '🎯',
  market:   '💹',
  ensemble: '🤖',
}

export function ModelComparisonTable({ models, homeCode, awayCode }: Props) {
  const available = models.filter(m => m.available)
  const unavailable = models.filter(m => !m.available && m.name !== 'ensemble')

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 px-3 pb-1 text-[10px] text-zinc-600 font-medium uppercase tracking-wider">
        <span>Modelo</span>
        <span className="text-emerald-600">{homeCode}</span>
        <span className="text-amber-600">Empate</span>
        <span className="text-red-600">{awayCode}</span>
      </div>

      {available.map((model) => {
        const isEnsemble = model.name === 'ensemble'
        return (
          <div
            key={model.name}
            className={cn(
              'grid grid-cols-[1fr_1fr_1fr_1fr] items-center gap-2 rounded-lg px-3 py-2',
              isEnsemble
                ? 'bg-zinc-800/80 border border-zinc-700'
                : 'bg-zinc-900/60'
            )}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm leading-none">{MODEL_ICON[model.name] ?? '●'}</span>
                <div>
                  <p className={cn('text-[11px] font-semibold', isEnsemble ? 'text-white' : 'text-zinc-300')}>
                    {model.label}
                  </p>
                  {model.note && (
                    <p className="text-[10px] text-zinc-600 mt-0.5">{model.note}</p>
                  )}
                </div>
              </div>
            </div>

            <ProbBar value={model.probabilities.home} color="text-emerald-400" />
            <ProbBar value={model.probabilities.draw} color="text-amber-400"   />
            <ProbBar value={model.probabilities.away} color="text-red-400"     />
          </div>
        )
      })}

      {unavailable.length > 0 && (
        <div className="pt-1">
          {unavailable.map(m => (
            <p key={m.name} className="text-[10px] text-zinc-700 px-3">
              {MODEL_ICON[m.name]} {m.label}: {m.note ?? 'sin datos suficientes'}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
