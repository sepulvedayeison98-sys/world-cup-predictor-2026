'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Radio, Cpu, Database, Activity } from 'lucide-react'

interface Props {
  modelVersion: string
  accuracy: number | null
  totalMatches: number
  analyzedMatches: number
}

function Ticker({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 border-r border-zinc-800 pr-4 last:border-0 last:pr-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
      <span className={cn('text-xs font-bold mono', color ?? 'text-zinc-300')}>{value}</span>
    </div>
  )
}

export function TerminalHeader({ modelVersion, accuracy, totalMatches, analyzedMatches }: Props) {
  const [time, setTime] = useState('')
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour12: false }))
      setPulse(p => !p)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      {/* Terminal top bar */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={cn('h-2 w-2 rounded-full bg-emerald-500 transition-opacity duration-500', pulse ? 'opacity-100' : 'opacity-40')} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Live</span>
          </div>
          <span className="text-[10px] text-zinc-600 mono">{time} COT</span>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto">
          <Ticker label="Motor" value={`v${modelVersion}`} color="text-emerald-400" />
          <Ticker label="Partidos" value={`${analyzedMatches}/${totalMatches}`} />
          <Ticker
            label="Precisión"
            value={accuracy === null ? '—' : `${(accuracy * 100).toFixed(1)}%`}
            color={accuracy !== null && accuracy >= 0.65 ? 'text-emerald-400' : accuracy !== null && accuracy >= 0.50 ? 'text-amber-400' : 'text-zinc-400'}
          />
          <Ticker label="WC2026" value="FIFA · México · EEUU · Canadá" color="text-zinc-400" />
        </div>

        <div className="flex items-center gap-3 text-zinc-600">
          <Cpu className="h-3.5 w-3.5" />
          <Database className="h-3.5 w-3.5" />
          <Activity className="h-3.5 w-3.5 text-emerald-600" />
        </div>
      </div>

      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
              FIFA World Cup 2026
            </span>
            <span className="text-[10px] text-zinc-600">·</span>
            <span className="text-[10px] text-zinc-600 mono">WLDCP:2026</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Panel de Inteligencia
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5">
          <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Motor activo</span>
        </div>
      </div>
    </div>
  )
}
