'use client'

import { useQuery } from '@tanstack/react-query'
import { matchesService } from '@/services/matches.service'
import { predictionsService } from '@/services/predictions.service'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { MapPin, Clock, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

function ConfidenceStars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5" title={`Confianza: ${level}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn('text-[10px]', i < level ? 'text-amber-400' : 'text-zinc-700')}
        >
          ★
        </span>
      ))}
    </div>
  )
}

function ProbabilityRow({
  homeProb,
  drawProb,
  awayProb,
}: {
  homeProb: number
  drawProb: number
  awayProb: number
}) {
  const h = Math.round(homeProb * 100)
  const d = Math.round(drawProb * 100)
  const a = Math.round(awayProb * 100)

  return (
    <div className="space-y-1">
      {/* Labels */}
      <div className="flex justify-between text-[10px] font-medium mono">
        <span className="text-emerald-400">{h}%</span>
        <span className="text-amber-400">{d}%</span>
        <span className="text-red-400">{a}%</span>
      </div>
      {/* Stacked bar */}
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="bg-emerald-500 transition-all duration-700"
          style={{ width: `${h}%` }}
        />
        <div
          className="bg-amber-500 transition-all duration-700"
          style={{ width: `${d}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-700"
          style={{ width: `${a}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-zinc-600">
        <span>Local</span>
        <span>Empate</span>
        <span>Visitante</span>
      </div>
    </div>
  )
}

export function UpcomingMatchesWidget() {
  const { data: matches, isLoading } = useQuery({
    queryKey: ['upcoming-matches'],
    queryFn: () => matchesService.getUpcomingMatches(6),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  if (isLoading) {
    return (
      <div className="card p-4">
        <div className="mb-4 h-5 w-32 animate-pulse rounded bg-zinc-800" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-zinc-800" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Próximos Partidos</h2>
          <p className="text-[11px] text-zinc-500">Con predicciones del motor</p>
        </div>
        <Link
          href="/matches"
          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Ver todos <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {(matches ?? []).map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}

        {(matches ?? []).length === 0 && (
          <div className="py-8 text-center text-sm text-zinc-500">
            No hay partidos próximos
          </div>
        )}
      </div>
    </div>
  )
}

function MatchCard({ match }: { match: any }) {
  const { data: prediction } = useQuery({
    queryKey: ['prediction', match.id],
    queryFn: () => predictionsService.getPredictionByMatchId(match.id),
    staleTime: 300_000,
  })

  const kickoff = new Date(match.kickoff_time)
  const isLive = match.status === 'live'
  const relativeTime = formatDistanceToNow(kickoff, { locale: es, addSuffix: true })

  return (
    <Link
      href={`/matches/${match.id}`}
      className="block rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all duration-150"
    >
      <div className="flex items-start gap-3">
        {/* Teams */}
        <div className="flex-1 min-w-0">
          {/* Match meta */}
          <div className="flex items-center gap-2 mb-2">
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

          {/* Teams row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-100">
                  {match.home_team?.short_name ?? match.home_team?.name}
                </span>
                {match.home_score !== null && (
                  <span className="text-sm font-bold text-white mono">
                    {match.home_score}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">
                  {match.away_team?.short_name ?? match.away_team?.name}
                </span>
                {match.away_score !== null && (
                  <span className="text-sm font-bold text-white mono">
                    {match.away_score}
                  </span>
                )}
              </div>
            </div>

            {/* Predicted score */}
            {prediction && match.status === 'scheduled' && (
              <div className="text-right">
                <p className="text-[10px] text-zinc-500 mb-0.5">Pronóstico</p>
                <p className="text-sm font-bold mono text-zinc-200">
                  {prediction.predicted_home_score}–{prediction.predicted_away_score}
                </p>
                <ConfidenceStars level={prediction.confidence_level} />
              </div>
            )}
          </div>

          {/* Probability bar */}
          {prediction && (
            <ProbabilityRow
              homeProb={prediction.home_win_probability}
              drawProb={prediction.draw_probability}
              awayProb={prediction.away_win_probability}
            />
          )}
        </div>
      </div>
    </Link>
  )
}
