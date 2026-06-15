'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Flag } from '@/components/ui/Flag'

/**
 * Tarjeta de partido para los widgets del dashboard.
 * Lee la predicción embebida en el match (PostgREST la devuelve como objeto
 * por UNIQUE(match_id)) — sin query por tarjeta.
 */
export function MatchCard({ match }: { match: any }) {
  const prediction = Array.isArray(match.predictions) ? match.predictions[0] : match.predictions
  const kickoff = new Date(match.kickoff_time)
  const isLive = match.status === 'live'

  const h = prediction ? Math.round(prediction.home_win_probability * 100) : 0
  const d = prediction ? Math.round(prediction.draw_probability * 100) : 0
  const a = prediction ? Math.round(prediction.away_win_probability * 100) : 0

  return (
    <Link
      href={`/matches/${match.id}`}
      className="block rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition-all duration-150 hover:border-zinc-700 hover:bg-zinc-800/50"
    >
      {/* Meta */}
      <div className="mb-2 flex items-center gap-2">
        {isLive ? (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-red-400">
            <span className="live-dot" /> EN VIVO
          </span>
        ) : (
          <span className="text-[10px] text-zinc-500">
            {format(kickoff, "d MMM · HH:mm", { locale: es })}
          </span>
        )}
        <span className="text-[10px] text-zinc-600">·</span>
        <span className="flex items-center gap-1 text-[10px] text-zinc-600">
          <MapPin className="h-2.5 w-2.5" />
          {match.city}
        </span>
      </div>

      {/* Teams */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Flag code={match.home_team?.code} />
            <span className="text-sm font-semibold text-zinc-100">
              {match.home_team?.short_name ?? match.home_team?.name}
            </span>
            {match.home_score !== null && (
              <span className="mono text-sm font-bold text-white">{match.home_score}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Flag code={match.away_team?.code} />
            <span className="text-sm text-zinc-400">
              {match.away_team?.short_name ?? match.away_team?.name}
            </span>
            {match.away_score !== null && (
              <span className="mono text-sm font-bold text-white">{match.away_score}</span>
            )}
          </div>
        </div>

        {prediction && match.status === 'scheduled' && (
          <div className="text-right">
            <p className="mb-0.5 text-[10px] text-zinc-500">Pronóstico</p>
            <p className="mono text-sm font-bold text-zinc-200">
              {prediction.predicted_home_score}–{prediction.predicted_away_score}
            </p>
          </div>
        )}
      </div>

      {/* Probability bar */}
      {prediction && (
        <div className="space-y-1">
          <div className="mono flex justify-between text-[10px] font-medium">
            <span className="text-emerald-400">{h}%</span>
            <span className="text-amber-400">{d}%</span>
            <span className="text-red-400">{a}%</span>
          </div>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="bg-emerald-500" style={{ width: `${h}%` }} />
            <div className="bg-amber-500" style={{ width: `${d}%` }} />
            <div className="bg-red-500" style={{ width: `${a}%` }} />
          </div>
        </div>
      )}
    </Link>
  )
}
