'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Flag } from '@/components/ui/Flag'
import { Trophy, Clock, CheckCircle2, Radio } from 'lucide-react'
import Link from 'next/link'

interface MatchSlot {
  id: string | null
  matchId: string | null
  phase: string
  matchNumber: number
  status: string
  homeTeam: { id: string; name: string; short_name: string; code: string; confederation: string } | null
  awayTeam: { id: string; name: string; short_name: string; code: string; confederation: string } | null
  homeScore: number | null
  awayScore: number | null
  kickoffTime: string | null
  homeWinProb?: number
  awayWinProb?: number
}

interface Props {
  matches: MatchSlot[]
  simulations: Record<string, { winner_prob: number; final_prob: number; semi_final_prob: number; quarter_final_prob: number; round_of_16_prob: number }>
}

const PHASE_ORDER = ['round_of_16', 'quarter_final', 'semi_final', 'final']
const PHASE_LABEL: Record<string, string> = {
  round_of_16:   'Octavos',
  quarter_final: 'Cuartos',
  semi_final:    'Semifinal',
  third_place:   '3er Lugar',
  final:         'Final',
}
const PHASE_SLOTS: Record<string, number> = {
  round_of_16:   8,
  quarter_final: 4,
  semi_final:    2,
  final:         1,
}

const CONF_COLOR: Record<string, string> = {
  UEFA:     'text-blue-400',
  CONMEBOL: 'text-amber-400',
  CONCACAF: 'text-red-400',
  AFC:      'text-violet-400',
  CAF:      'text-emerald-400',
  OFC:      'text-cyan-400',
}

function MatchCard({ slot, simulations }: { slot: MatchSlot; simulations: Props['simulations'] }) {
  const isFinished = slot.status === 'finished'
  const isLive = slot.status === 'live'
  const isScheduled = slot.status === 'scheduled' || slot.status === 'upcoming'
  const isEmpty = !slot.homeTeam && !slot.awayTeam

  const homeSim = slot.homeTeam ? simulations[slot.homeTeam.id] : null
  const awaySim = slot.awayTeam ? simulations[slot.awayTeam.id] : null

  const homeWinner = isFinished && slot.homeScore !== null && slot.awayScore !== null && slot.homeScore > slot.awayScore
  const awayWinner = isFinished && slot.homeScore !== null && slot.awayScore !== null && slot.awayScore > slot.homeScore

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden text-[11px] w-48',
      isLive ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/60',
      isEmpty && 'opacity-40',
    )}>
      {/* Status bar */}
      <div className={cn(
        'flex items-center justify-between px-2 py-0.5 border-b',
        isLive ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/80',
      )}>
        {isLive && (
          <div className="flex items-center gap-1">
            <Radio className="h-2.5 w-2.5 text-emerald-400 animate-pulse" />
            <span className="text-[9px] font-bold text-emerald-400 uppercase">En vivo</span>
          </div>
        )}
        {isFinished && <CheckCircle2 className="h-2.5 w-2.5 text-zinc-500" />}
        {isScheduled && <Clock className="h-2.5 w-2.5 text-zinc-700" />}
        {isEmpty && <span className="text-[9px] text-zinc-700">Por definir</span>}
        {slot.kickoffTime && !isEmpty && (
          <span className="text-[9px] text-zinc-600 mono">
            {new Date(slot.kickoffTime).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="divide-y divide-zinc-800/60">
        {[
          { team: slot.homeTeam, score: slot.homeScore, isWinner: homeWinner, sim: homeSim, prob: slot.homeWinProb },
          { team: slot.awayTeam, score: slot.awayScore, isWinner: awayWinner, sim: awaySim, prob: slot.awayWinProb },
        ].map(({ team, score, isWinner, sim, prob }, i) => (
          <div key={i} className={cn(
            'flex items-center gap-1.5 px-2 py-2',
            isWinner && 'bg-emerald-500/5',
          )}>
            {team ? (
              <>
                <Flag code={team.code} />
                <span className={cn(
                  'flex-1 font-medium truncate',
                  isWinner ? 'text-white' : isFinished ? 'text-zinc-500' : 'text-zinc-300',
                )}>
                  {team.code}
                </span>
                {isFinished || isLive ? (
                  <span className={cn('font-black mono text-sm', isWinner ? 'text-white' : 'text-zinc-500')}>
                    {score ?? '–'}
                  </span>
                ) : sim && prob !== undefined ? (
                  <span className="text-[10px] mono text-zinc-500">{Math.round(prob * 100)}%</span>
                ) : null}
                {isWinner && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
              </>
            ) : (
              <span className="text-zinc-700 italic">—</span>
            )}
          </div>
        ))}
      </div>

      {/* Win probability bar */}
      {!isFinished && slot.homeTeam && slot.awayTeam && slot.homeWinProb !== undefined && slot.awayWinProb !== undefined && (
        <div className="flex h-0.5">
          <div className="bg-emerald-600/60 h-full" style={{ width: `${slot.homeWinProb * 100}%` }} />
          <div className="bg-zinc-700/60 h-full flex-1" />
          <div className="bg-red-600/60 h-full" style={{ width: `${slot.awayWinProb * 100}%` }} />
        </div>
      )}

      {/* Link to match detail */}
      {slot.matchId && (
        <Link
          href={`/matches/${slot.matchId}`}
          className="block text-center text-[9px] text-zinc-700 hover:text-emerald-500 py-0.5 border-t border-zinc-800/60 transition-colors"
        >
          Ver análisis →
        </Link>
      )}
    </div>
  )
}

function ConnectorLine({ top }: { top?: boolean }) {
  return (
    <div className={cn(
      'w-6 border-t border-zinc-700/50 self-center shrink-0',
      top ? 'mt-6' : '-mt-6'
    )} />
  )
}

export function TournamentBracket({ matches, simulations }: Props) {
  const [halfView, setHalfView] = useState<'upper' | 'lower' | 'all'>('all')

  // Group matches by phase
  const byPhase: Record<string, MatchSlot[]> = {}
  for (const m of matches) {
    if (!byPhase[m.phase]) byPhase[m.phase] = []
    byPhase[m.phase].push(m)
  }

  // Sort within each phase by matchNumber
  for (const phase of Object.keys(byPhase)) {
    byPhase[phase].sort((a, b) => a.matchNumber - b.matchNumber)
  }

  // Pad with empty slots if fewer matches than expected
  for (const [phase, count] of Object.entries(PHASE_SLOTS)) {
    const slots = byPhase[phase] ?? []
    while (slots.length < count) {
      slots.push({
        id: null, matchId: null, phase, matchNumber: slots.length + 1,
        status: 'scheduled', homeTeam: null, awayTeam: null,
        homeScore: null, awayScore: null, kickoffTime: null,
      })
    }
    byPhase[phase] = slots
  }

  const phases = PHASE_ORDER.filter(p => byPhase[p])
  const thirdPlace = (byPhase['third_place'] ?? [])[0] ?? null
  const finalMatch = (byPhase['final'] ?? [])[0] ?? null

  const hasData = matches.length > 0

  if (!hasData) {
    return (
      <div className="card p-12 text-center space-y-3">
        <Trophy className="h-10 w-10 text-zinc-700 mx-auto" />
        <p className="text-sm font-medium text-zinc-500">Fase eliminatoria pendiente</p>
        <p className="text-xs text-zinc-600 max-w-sm mx-auto">
          El cuadro de eliminatorias se mostrará cuando los partidos de ronda final estén programados en la base de datos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Phase labels header */}
      <div className="flex gap-4 overflow-x-auto pb-1">
        {phases.map(phase => (
          <div key={phase} className="text-center shrink-0" style={{ width: '12rem' }}>
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded',
              phase === 'final' ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500 bg-zinc-800/50'
            )}>
              {PHASE_LABEL[phase]}
            </span>
          </div>
        ))}
        {thirdPlace && (
          <div className="text-center shrink-0" style={{ width: '12rem' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded text-zinc-600 bg-zinc-800/50">
              3er Lugar
            </span>
          </div>
        )}
      </div>

      {/* Bracket scroll area */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-1 min-w-max">
          {phases.map((phase, phaseIdx) => {
            const slots = byPhase[phase] ?? []
            const isLast = phaseIdx === phases.length - 1

            return (
              <div key={phase} className="flex items-center">
                {/* Column of match cards */}
                <div
                  className="flex flex-col justify-around"
                  style={{ minHeight: `${Math.max(slots.length, 1) * 120}px` }}
                >
                  {slots.map((slot) => (
                    <div key={slot.matchNumber} className="py-2">
                      <MatchCard slot={slot} simulations={simulations} />
                    </div>
                  ))}
                </div>

                {/* Connector lines between phases */}
                {!isLast && (
                  <div
                    className="flex flex-col justify-around mx-1"
                    style={{ minHeight: `${Math.max(slots.length, 1) * 120}px` }}
                  >
                    {slots.filter((_, i) => i % 2 === 0).map((_, i) => (
                      <div key={i} className="flex flex-col" style={{ height: '240px' }}>
                        {/* Top connector → bracket arm */}
                        <div className="flex-1 border-r border-b border-zinc-700/40 rounded-br-sm" />
                        <div className="flex-1 border-r border-t border-zinc-700/40 rounded-tr-sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* 3rd place column */}
          {thirdPlace && (
            <div className="ml-8 flex flex-col justify-center">
              <p className="text-[9px] text-zinc-700 uppercase tracking-wider mb-2 text-center">3er Lugar</p>
              <MatchCard slot={thirdPlace} simulations={simulations} />
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] text-zinc-700 text-center">
        Cuadro de eliminatorias · Probabilidades basadas en simulación Monte Carlo ·
        Barras de color: verde = local, rojo = visitante
      </p>
    </div>
  )
}
