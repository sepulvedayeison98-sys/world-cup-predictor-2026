'use client'

import Link from 'next/link'
import { ArrowLeft, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { differenceInYears } from 'date-fns'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  available:  { label: '✓ Disponible',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  doubt:      { label: '⚠ Duda',        color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30' },
  injured:    { label: '✗ Lesionado',   color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30' },
  suspended:  { label: '🟨 Suspendido', color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30' },
}

const POSITION_FULL: Record<string, string> = {
  GK: 'Portero', CB: 'Defensa Central', LB: 'Lateral Izquierdo', RB: 'Lateral Derecho',
  CDM: 'Volante Defensivo', CM: 'Centrocampista', CAM: 'Mediocamp. Ofensivo',
  LW: 'Extremo Izquierdo', RW: 'Extremo Derecho', ST: 'Delantero Centro', CF: 'Mediapunta',
}

interface Props {
  player: any
  stats: any
}

export function PlayerProfileHeader({ player, stats }: Props) {
  const s = STATUS_CONFIG[player.status] ?? STATUS_CONFIG.available
  const age = player.date_of_birth
    ? differenceInYears(new Date(), new Date(player.date_of_birth))
    : null

  const physicalCondition = stats?.physical_condition ?? 100
  const formScore = stats?.form_score ?? 0

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-zinc-800 px-4 py-2.5">
        <Link href="/players" className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a Jugadores
        </Link>
      </div>

      <div className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {/* Avatar */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-zinc-800 border border-zinc-700">
            <span className="text-3xl font-black mono text-zinc-400">
              {player.number}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white">{player.name}</h1>
              <span className={cn('rounded-lg px-2.5 py-1 text-xs font-semibold border', s.bg, s.color)}>
                {s.label}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
              <span>{POSITION_FULL[player.position] ?? player.position}</span>
              <span>·</span>
              <span>{player.team?.name}</span>
              {player.club_name && <><span>·</span><span>Club: {player.club_name}</span></>}
              {age && <><span>·</span><span>{age} años</span></>}
              {player.height_cm && <><span>·</span><span>{player.height_cm} cm</span></>}
              {player.market_value_euros && (
                <><span>·</span><span>€{(player.market_value_euros / 1_000_000).toFixed(0)}M</span></>
              )}
            </div>

            {/* Physical + Form bars */}
            <div className="mt-4 grid grid-cols-2 gap-4 max-w-sm">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Estado Físico
                  </span>
                  <span className={cn('text-xs font-bold mono',
                    physicalCondition >= 90 ? 'text-emerald-400' :
                    physicalCondition >= 70 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {physicalCondition}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700',
                      physicalCondition >= 90 ? 'bg-emerald-500' :
                      physicalCondition >= 70 ? 'bg-amber-500' : 'bg-red-500'
                    )}
                    style={{ width: `${physicalCondition}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-zinc-500">Forma</span>
                  <span className={cn('text-xs font-bold mono',
                    formScore >= 7 ? 'text-emerald-400' :
                    formScore >= 5 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {formScore.toFixed(1)}/10
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700',
                      formScore >= 7 ? 'bg-emerald-500' :
                      formScore >= 5 ? 'bg-amber-500' : 'bg-red-500'
                    )}
                    style={{ width: `${(formScore / 10) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Team badge */}
          {player.team && (
            <div className="shrink-0 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 mx-auto mb-1">
                <span className="text-lg font-black text-zinc-300">{player.team.code}</span>
              </div>
              <p className="text-[10px] text-zinc-500">FIFA #{player.team.fifa_ranking}</p>
              <p className="text-[10px] text-zinc-500">ELO {player.team.elo_rating}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
