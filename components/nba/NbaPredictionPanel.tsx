import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  prediction: any | null
  match: any
}

/**
 * Panel de predicción para baloncesto (moneyline 2 vías, sin empate).
 * Muestra probabilidad de cada equipo, marcador estimado, hándicap
 * (margen) y total de puntos — la lectura natural de la NBA.
 */
export function NbaPredictionPanel({ prediction, match }: Props) {
  if (!prediction) {
    return (
      <div className="card p-8 text-center text-sm text-zinc-500">
        Sin predicción disponible para este partido.
      </div>
    )
  }
  const home = Number(prediction.home_win_probability)
  const away = Number(prediction.away_win_probability)
  const ph = Math.round(home * 100)
  const pa = Math.round(away * 100)
  const predH = prediction.predicted_home_score
  const predA = prediction.predicted_away_score
  const margin = predH - predA
  const total = predH + predA
  const favHome = home >= away
  const homeCode = match.home_team?.code ?? 'LOC'
  const awayCode = match.away_team?.code ?? 'VIS'
  const favCode = favHome ? homeCode : awayCode
  const conf = Math.round(Number(prediction.confidence_score))

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Predicción del Motor</h3>
        </div>
        <span className="text-[10px] text-zinc-600 mono">nba-1.0</span>
      </div>

      <div className="space-y-5 p-4">
        {/* Moneyline (2 vías) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className={cn('font-bold', favHome ? 'text-emerald-400' : 'text-zinc-300')}>{homeCode} {ph}%</span>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Ganador (moneyline)</span>
            <span className={cn('font-bold', !favHome ? 'text-sky-400' : 'text-zinc-300')}>{pa}% {awayCode}</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-zinc-800">
            <div className="bg-emerald-500/80" style={{ width: `${ph}%` }} />
            <div className="bg-sky-500/80" style={{ width: `${pa}%` }} />
          </div>
        </div>

        {/* Marcador / hándicap / total */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Marcador est.</p>
            <p className="mt-1 text-lg font-bold text-white mono">{predH}-{predA}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Hándicap</p>
            <p className="mt-1 text-lg font-bold text-emerald-400 mono">{favCode} -{Math.abs(margin)}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Total est.</p>
            <p className="mt-1 text-lg font-bold text-white mono">{total}</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-xs">
          <span className="text-zinc-500">Confianza del modelo</span>
          <span className={cn('font-bold mono', conf >= 65 ? 'text-emerald-400' : conf >= 55 ? 'text-amber-400' : 'text-zinc-400')}>{conf}%</span>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-600">
          Sin empates en baloncesto: la probabilidad se reparte entre local y
          visitante. Hándicap y total son estimaciones del modelo ELO nba-1.0.
        </p>
      </div>
    </div>
  )
}
