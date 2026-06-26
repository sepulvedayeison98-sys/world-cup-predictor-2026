'use client'

import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MapPin, Clock, CloudSun, Users, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Flag } from '@/components/ui/Flag'

interface Props {
  match: any
}

export function MatchHeader({ match }: Props) {
  const kickoff = new Date(match.kickoff_time)
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'
  const hasScore = match.home_score !== null && match.away_score !== null

  return (
    <div className="card overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5 bg-zinc-900/80">
        <Link
          href="/matches"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a Partidos
        </Link>
        <div className="flex items-center gap-3">
          {match.group_id && (
            <span className="text-xs font-medium text-zinc-400">Fase de Grupos</span>
          )}
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-400">
              <span className="live-dot" /> EN VIVO
            </span>
          )}
          {isFinished && (
            <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-zinc-800 text-zinc-500 border border-zinc-700">
              Finalizado
            </span>
          )}
          {match.status === 'scheduled' && (
            <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Programado
            </span>
          )}
        </div>
      </div>

      {/* Teams & score */}
      <div className="px-6 py-8">
        <div className="flex items-center justify-center gap-6 md:gap-12">

          {/* Home team */}
          <div className="flex flex-col items-center gap-2 flex-1 max-w-[180px]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-2xl overflow-hidden">
              <Flag code={match.home_team?.code} className="h-11 w-16 rounded-none" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{match.home_team?.name}</p>
              <p className="text-xs text-zinc-500">FIFA #{match.home_team?.fifa_ranking} · ELO {match.home_team?.elo_rating}</p>
            </div>
          </div>

          {/* Score / VS */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {hasScore ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-5xl font-black mono text-white">{match.home_score}</span>
                  <span className="text-2xl text-zinc-600">—</span>
                  <span className="text-5xl font-black mono text-white">{match.away_score}</span>
                </div>
                {match.home_score_ht != null && match.away_score_ht != null && (
                  <p className="text-[10px] text-zinc-600 mono">
                    ({match.home_score_ht} — {match.away_score_ht}) MT
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <p className="text-2xl font-black text-zinc-600">VS</p>
                <p className="text-sm font-semibold text-zinc-300 mono">
                  {format(kickoff, 'HH:mm')}
                </p>
                <p className="text-xs text-zinc-500">
                  {format(kickoff, "d 'de' MMMM", { locale: es })}
                </p>
              </div>
            )}
          </div>

          {/* Away team */}
          <div className="flex flex-col items-center gap-2 flex-1 max-w-[180px]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-2xl overflow-hidden">
              <Flag code={match.away_team?.code} className="h-11 w-16 rounded-none" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{match.away_team?.name}</p>
              <p className="text-xs text-zinc-500">FIFA #{match.away_team?.fifa_ranking} · ELO {match.away_team?.elo_rating}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-4 border-t border-zinc-800 px-6 py-3 bg-zinc-900/40">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <MapPin className="h-3.5 w-3.5" />
          <span>{match.venue}, {match.city}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Clock className="h-3.5 w-3.5" />
          <span>{format(kickoff, "EEEE d MMM · HH:mm", { locale: es })}</span>
        </div>
        {match.referee && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="text-zinc-600">Árbitro:</span>
            <span>{match.referee}</span>
          </div>
        )}
        {match.weather_condition && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <CloudSun className="h-3.5 w-3.5" />
            <span>{match.weather_condition} · {match.weather_temp_celsius}°C</span>
          </div>
        )}
        {match.attendance && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Users className="h-3.5 w-3.5" />
            <span>{match.attendance.toLocaleString('es-CO')} espectadores</span>
          </div>
        )}
        {match.home_rest_days != null && match.away_rest_days != null && (
          <div className="text-xs text-zinc-500">
            Descanso: <span className="text-zinc-300">{match.home_rest_days}d</span> vs <span className="text-zinc-300">{match.away_rest_days}d</span>
          </div>
        )}
      </div>
    </div>
  )
}
