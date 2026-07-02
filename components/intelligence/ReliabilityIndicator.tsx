'use client'

import { cn } from '@/lib/utils'
import { type ReliabilityTier, TIER_COLOR, TIER_LABEL } from '@/lib/intelligence/dataQuality'

interface Props {
  score: number
  tier: ReliabilityTier
  compact?: boolean
}

export function ReliabilityIndicator({ score, tier, compact = false }: Props) {
  const cfg = TIER_COLOR[tier]

  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border', cfg.bg, cfg.text, cfg.border)}>
        <span className={cn('h-1.5 w-1.5 rounded-full', tier === 'excelente' ? 'bg-emerald-400' : tier === 'alta' ? 'bg-blue-400' : tier === 'media' ? 'bg-amber-400' : 'bg-red-400')} />
        {TIER_LABEL[tier]} · {score.toFixed(0)}%
      </span>
    )
  }

  const segments = [
    { label: '95%+',   tier: 'excelente' as ReliabilityTier, min: 95, color: 'bg-emerald-500' },
    { label: '90–94%', tier: 'alta'      as ReliabilityTier, min: 90, color: 'bg-blue-500'    },
    { label: '80–89%', tier: 'media'     as ReliabilityTier, min: 80, color: 'bg-amber-500'   },
    { label: '<80%',   tier: 'baja'      as ReliabilityTier, min: 0,  color: 'bg-red-500'     },
  ]

  return (
    <div className={cn('rounded-lg border p-3 space-y-2', cfg.bg, cfg.border)}>
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-semibold', cfg.text)}>
          Fiabilidad del dato: {TIER_LABEL[tier]}
        </span>
        <span className={cn('text-sm font-bold mono', cfg.text)}>{score.toFixed(0)}%</span>
      </div>

      {/* Barra segmentada */}
      <div className="flex gap-0.5 h-2">
        {segments.map((seg) => (
          <div
            key={seg.tier}
            className={cn('flex-1 rounded-full', score >= seg.min ? seg.color : 'bg-zinc-800')}
          />
        ))}
      </div>

      <div className="flex justify-between text-[10px] text-zinc-600">
        <span>Baja</span>
        <span>Media</span>
        <span>Alta</span>
        <span>Excelente</span>
      </div>
    </div>
  )
}
