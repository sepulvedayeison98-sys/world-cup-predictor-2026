'use client'

import { formatColTime, formatColLongDate, formatColFull } from '@/lib/datetime'
import { MapPin, Clock, CloudSun, Users, ArrowLeft, Check, X } from 'lucide-react'
import Link from 'next/link'
import { Flag } from '@/components/ui/Flag'
import { FavoriteStar } from '@/components/ui/FavoriteStar'
import { PHASE_LABELS } from '@/lib/constants'

interface Props {
  match: any
  /** Contexto de competición para el regreso y la etiqueta (universal) */
  competition?: { name: string; href: string } | null
  /** Predicción del motor: muestra el pick y su estado en finalizados */
  prediction?: any | null
}

/**
 * Cabecera universal del partido (plantilla EVENTO): funciona para
 * selecciones (bandera + FIFA) y clubes (escudo + ELO) de cualquier
 * competición presente o futura. El contexto lo aporta la página.
 */
function TeamBadge({ team }: { team: any }) {
  if (team?.logo_url) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={team.logo_url} alt="" className="h-full w-full object-contain" />
      </div>
    )
  }
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-2xl overflow-hidden">
      <Flag code={team?.code} className="h-11 w-16 rounded-none" />
    </div>
  )
}

function TeamCredential({ team }: { team: any }) {
  // Selecciones: FIFA + ELO · Clubes (sin ranking FIFA): solo ELO
  const fifa = team?.fifa_ranking
  return (
    <p className="text-xs text-zinc-500">
      {fifa > 0 ? `FIFA #${fifa} · ` : ''}ELO {team?.elo_rating}
    </p>
  )
}

export function MatchHeader({ match, competition, prediction }: Props) {
  const kickoff = new Date(match.kickoff_time)
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'
  const hasScore = match.home_score !== null && match.away_score !== null

  // Etiqueta de contexto: jornada de liga o fase de torneo
  const contextLabel = match.round != null
    ? `Jornada ${match.round}`
    : match.group_id
      ? 'Fase de Grupos'
      : (PHASE_LABELS[match.phase] ?? null)

  // Pick del motor y su estado (solo con predicción publicada)
  const pick = prediction && prediction.id !== 'computed'
    ? (() => {
        const h = Number(prediction.home_win_probability)
        const d = Number(prediction.draw_probability)
        const a = Number(prediction.away_win_probability)
        const outcome = h >= d && h >= a ? 'home' : a >= d ? 'away' : 'draw'
        const label = outcome === 'home'
          ? match.home_team?.short_name ?? 'Local'
          : outcome === 'away'
            ? match.away_team?.short_name ?? 'Visita'
            : 'Empate'
        return { label, prob: Math.round(Math.max(h, d, a) * 100), correct: prediction.was_correct as boolean | null }
      })()
    : null

  return (
    <div className="card overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5 bg-zinc-900/80">
        <Link
          href={competition?.href ?? '/matches'}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {competition?.name ?? 'Partidos'}
        </Link>
        <div className="flex items-center gap-3">
          {contextLabel && (
            <span className="text-xs font-medium text-zinc-400">{contextLabel}</span>
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
            <TeamBadge team={match.home_team} />
            <div className="text-center">
              <p className="flex items-center justify-center gap-1 text-lg font-bold text-white">
                {match.home_team?.name}
                {match.home_team?.id && (
                  <FavoriteStar team={{ id: match.home_team.id, name: match.home_team.name, code: match.home_team.code }} />
                )}
              </p>
              <TeamCredential team={match.home_team} />
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
                  {formatColTime(kickoff)} COL
                </p>
                <p className="text-xs text-zinc-500">
                  {formatColLongDate(kickoff)}
                </p>
              </div>
            )}
          </div>

          {/* Away team */}
          <div className="flex flex-col items-center gap-2 flex-1 max-w-[180px]">
            <TeamBadge team={match.away_team} />
            <div className="text-center">
              <p className="flex items-center justify-center gap-1 text-lg font-bold text-white">
                {match.away_team?.name}
                {match.away_team?.id && (
                  <FavoriteStar team={{ id: match.away_team.id, name: match.away_team.name, code: match.away_team.code }} />
                )}
              </p>
              <TeamCredential team={match.away_team} />
            </div>
          </div>
        </div>

        {/* Pick del motor: qué dijo antes del partido y cómo le fue */}
        {pick && (
          <div className="mt-5 flex justify-center">
            <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-1.5 text-xs">
              <span className="text-zinc-500">Pick del motor:</span>
              <span className="font-bold text-zinc-200">{pick.label}</span>
              <span className="mono text-zinc-500">{pick.prob}%</span>
              {isFinished && pick.correct === true && (
                <span className="flex items-center gap-1 font-semibold text-emerald-400"><Check className="h-3.5 w-3.5" /> Acertado</span>
              )}
              {isFinished && pick.correct === false && (
                <span className="flex items-center gap-1 font-semibold text-red-400"><X className="h-3.5 w-3.5" /> Fallado</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-4 border-t border-zinc-800 px-6 py-3 bg-zinc-900/40">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <MapPin className="h-3.5 w-3.5" />
          <span>{match.venue}, {match.city}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatColFull(kickoff)} COL</span>
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
