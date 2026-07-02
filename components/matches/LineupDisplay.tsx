'use client'

import { useQuery } from '@tanstack/react-query'
import { matchesService } from '@/services/matches.service'
import { cn } from '@/lib/utils'
import { Users, CheckCircle, Clock } from 'lucide-react'

interface Props {
  matchId: string
  homeTeam: any
  awayTeam: any
}

function PlayerDot({ player, color }: { player: any; color: string }) {
  const p = player?.player ?? player
  return (
    <div className="flex flex-col items-center gap-0.5 group">
      <div
        className={cn(
          'h-7 w-7 rounded-full border-2 flex items-center justify-center',
          'text-[10px] font-bold text-white',
          color,
          'group-hover:scale-110 transition-transform cursor-default'
        )}
        title={p?.name ?? ''}
      >
        {p?.number ?? '?'}
      </div>
      <span className="text-[10px] text-zinc-400 max-w-[48px] truncate text-center leading-tight">
        {p?.short_name ?? p?.name?.split(' ').pop() ?? ''}
      </span>
    </div>
  )
}

function PitchTeam({ lineup, color, label, reversed = false }: {
  lineup: any
  color: string
  label: string
  reversed?: boolean
}) {
  if (!lineup) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
        <Users className="h-8 w-8 text-zinc-600" />
        <p className="text-xs text-zinc-600">Alineación no disponible</p>
      </div>
    )
  }

  const starters = (lineup.players ?? [])
    .filter((p: any) => p.is_starter)
    .sort((a: any, b: any) => (reversed ? b.grid_y - a.grid_y : a.grid_y - b.grid_y))

  // Group by row (grid_y)
  const rows: Record<number, any[]> = {}
  starters.forEach((p: any) => {
    if (!rows[p.grid_y]) rows[p.grid_y] = []
    rows[p.grid_y].push(p)
  })

  return (
    <div className="flex flex-col gap-2 justify-around h-full py-2">
      {Object.values(rows).map((rowPlayers, idx) => (
        <div key={idx} className="flex justify-center gap-3 flex-wrap">
          {rowPlayers.map((p: any) => (
            <PlayerDot key={p.id} player={p} color={color} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function LineupDisplay({ matchId, homeTeam, awayTeam }: Props) {
  const { data: lineups, isLoading } = useQuery({
    queryKey: ['lineups', matchId],
    queryFn: () => matchesService.getMatchLineups(matchId),
    staleTime: 120_000,
  })

  const homeLineup = lineups?.find((l: any) => l.team_id === homeTeam.id)
  const awayLineup = lineups?.find((l: any) => l.team_id === awayTeam.id)

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Alineaciones</h3>
        </div>
        <div className="flex items-center gap-3">
          {homeLineup && (
            <span className={cn(
              'flex items-center gap-1 text-[10px]',
              homeLineup.is_confirmed ? 'text-emerald-400' : 'text-amber-400'
            )}>
              {homeLineup.is_confirmed
                ? <><CheckCircle className="h-3 w-3" /> Oficial</>
                : <><Clock className="h-3 w-3" /> Probable</>
              }
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-zinc-800" />
      ) : !homeLineup && !awayLineup ? (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <Users className="h-10 w-10 text-zinc-700" />
          <p className="text-sm font-medium text-zinc-500">Alineaciones no confirmadas</p>
          <p className="text-xs text-zinc-600 max-w-xs">
            Las alineaciones oficiales se publican aproximadamente 1 hora antes del pitido inicial.
          </p>
        </div>
      ) : (
        <div>
          {/* Formation labels */}
          <div className="flex justify-between mb-2 px-2">
            <div>
              <span className="text-xs font-semibold text-zinc-300">{homeTeam.short_name}</span>
              {homeLineup && (
                <span className="ml-2 text-[10px] text-zinc-600 mono">{homeLineup.formation}</span>
              )}
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-zinc-300">{awayTeam.short_name}</span>
              {awayLineup && (
                <span className="ml-2 text-[10px] text-zinc-600 mono">{awayLineup.formation}</span>
              )}
            </div>
          </div>

          {/* Pitch */}
          <div
            className="relative rounded-lg overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #14532d 0%, #166534 45%, #166534 55%, #14532d 100%)',
              minHeight: 320,
            }}
          >
            {/* Pitch markings */}
            <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 320">
              <rect x="10" y="10" width="380" height="300" fill="none" stroke="white" strokeWidth="1" />
              <line x1="200" y1="10" x2="200" y2="310" stroke="white" strokeWidth="1" />
              <circle cx="200" cy="160" r="40" fill="none" stroke="white" strokeWidth="1" />
              {/* Penalty areas */}
              <rect x="10" y="100" width="65" height="120" fill="none" stroke="white" strokeWidth="1" />
              <rect x="325" y="100" width="65" height="120" fill="none" stroke="white" strokeWidth="1" />
              {/* Goals */}
              <rect x="10" y="135" width="15" height="50" fill="none" stroke="white" strokeWidth="1" />
              <rect x="375" y="135" width="15" height="50" fill="none" stroke="white" strokeWidth="1" />
            </svg>

            {/* Teams on pitch */}
            <div className="relative z-10 grid grid-cols-2 gap-0 h-80">
              <div className="flex flex-col">
                <PitchTeam
                  lineup={homeLineup}
                  color="border-emerald-400 bg-emerald-600"
                  label={homeTeam.short_name}
                />
              </div>
              <div className="flex flex-col">
                <PitchTeam
                  lineup={awayLineup}
                  color="border-blue-400 bg-blue-600"
                  label={awayTeam.short_name}
                  reversed
                />
              </div>
            </div>
          </div>

          {/* Bench / unavailable */}
          {(homeLineup || awayLineup) && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[homeLineup, awayLineup].map((lineup, idx) => {
                if (!lineup) return <div key={idx} />
                const bench = (lineup.players ?? []).filter((p: any) => !p.is_starter)
                if (bench.length === 0) return <div key={idx} />
                return (
                  <div key={idx}>
                    <p className="text-[10px] text-zinc-600 mb-1">
                      {idx === 0 ? homeTeam.code : awayTeam.code} · Suplentes
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {bench.slice(0, 7).map((p: any) => (
                        <span key={p.id} className="text-[10px] text-zinc-500 bg-zinc-800 rounded px-1.5 py-0.5">
                          {p.player?.number} {p.player?.short_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
