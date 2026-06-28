'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Flag } from '@/components/ui/Flag'
import { Trophy, Clock, CheckCircle2, Radio, MapPin } from 'lucide-react'
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
  venue?: string | null
  city?: string | null
  homeWinProb?: number
  awayWinProb?: number
}

interface Props {
  matches: MatchSlot[]
  simulations: Record<string, any>
}

const PHASE_ORDER = ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']

const PHASE_LABEL: Record<string, string> = {
  round_of_32:   'Dieciseisavos',
  round_of_16:   'Octavos',
  quarter_final: 'Cuartos',
  semi_final:    'Semifinales',
  third_place:   '3er Lugar',
  final:         'Final',
}

const PHASE_SLOTS: Record<string, number> = {
  round_of_32:   16,
  round_of_16:   8,
  quarter_final: 4,
  semi_final:    2,
  third_place:   1,
  final:         1,
}

const COLOMBIA_HIGHLIGHT_ID = '10000000-0000-4000-a000-00000000002c'

function MatchCard({ slot, simulations }: { slot: MatchSlot; simulations: Props['simulations'] }) {
  const isFinished = slot.status === 'finished'
  const isLive     = slot.status === 'live'
  const isEmpty    = !slot.homeTeam && !slot.awayTeam

  const homeWinner = isFinished && slot.homeScore !== null && slot.awayScore !== null && slot.homeScore > slot.awayScore
  const awayWinner = isFinished && slot.homeScore !== null && slot.awayScore !== null && slot.awayScore > slot.homeScore

  const hasCol = slot.homeTeam?.id === COLOMBIA_HIGHLIGHT_ID || slot.awayTeam?.id === COLOMBIA_HIGHLIGHT_ID

  const kickoff = slot.kickoffTime ? new Date(slot.kickoffTime) : null
  const kickoffDate = kickoff
    ? kickoff.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })
    : null
  const kickoffTime = kickoff
    ? kickoff.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })
    : null

  const inner = (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-colors',
      isLive   ? 'border-emerald-500/50 bg-emerald-500/5'
               : hasCol ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50'
               : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700',
      isEmpty  && 'opacity-35',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-3 py-1.5 border-b text-[10px]',
        isLive ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/80',
      )}>
        <div className="flex items-center gap-1.5">
          {isLive     && <Radio className="h-2.5 w-2.5 text-emerald-400 animate-pulse" />}
          {isFinished && <CheckCircle2 className="h-2.5 w-2.5 text-zinc-500" />}
          {!isLive && !isFinished && !isEmpty && <Clock className="h-2.5 w-2.5 text-zinc-700" />}
          <span className={cn(
            'font-medium',
            isLive ? 'text-emerald-400' : isEmpty ? 'text-zinc-700' : isFinished ? 'text-zinc-500' : 'text-zinc-600',
          )}>
            {isLive ? 'En vivo' : isEmpty ? 'Por definir' : isFinished ? 'Finalizado' : kickoffDate}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {kickoffTime && !isEmpty && !isFinished && (
            <span className="text-zinc-500 mono font-medium">{kickoffTime}</span>
          )}
          {hasCol && !isEmpty && (
            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">🇨🇴</span>
          )}
        </div>
      </div>

      {/* Teams */}
      <div className="divide-y divide-zinc-800/60">
        {[
          { team: slot.homeTeam, score: slot.homeScore, isWinner: homeWinner, prob: slot.homeWinProb },
          { team: slot.awayTeam, score: slot.awayScore, isWinner: awayWinner, prob: slot.awayWinProb },
        ].map(({ team, score, isWinner, prob }, i) => (
          <div key={i} className={cn(
            'flex items-center gap-2.5 px-3 py-2.5',
            isWinner && 'bg-emerald-500/5',
          )}>
            {team ? (
              <>
                <Flag code={team.code} className="h-4 w-6" />
                <span className={cn(
                  'flex-1 text-sm font-medium truncate',
                  isWinner ? 'text-white' : isFinished ? 'text-zinc-500' : 'text-zinc-200',
                )}>
                  {team.short_name}
                </span>
                {isFinished || isLive ? (
                  <span className={cn('text-base font-black mono w-5 text-center', isWinner ? 'text-white' : 'text-zinc-500')}>
                    {score ?? '–'}
                  </span>
                ) : prob !== undefined ? (
                  <span className="text-xs mono text-zinc-500">{Math.round(prob * 100)}%</span>
                ) : (
                  <span className="text-xs text-zinc-700">—</span>
                )}
                {isWinner && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
              </>
            ) : (
              <span className="text-sm text-zinc-700 italic">Por definir</span>
            )}
          </div>
        ))}
      </div>

      {/* Win probability bar */}
      {!isFinished && slot.homeTeam && slot.awayTeam && slot.homeWinProb !== undefined && (
        <div className="flex h-0.5">
          <div className="bg-emerald-600/60" style={{ width: `${slot.homeWinProb * 100}%` }} />
          <div className="bg-blue-600/60 flex-1" />
        </div>
      )}

      {/* City footer */}
      {slot.city && !isEmpty && (
        <div className="flex items-center gap-1 px-3 py-1 border-t border-zinc-800/60">
          <MapPin className="h-2.5 w-2.5 text-zinc-700" />
          <span className="text-[9px] text-zinc-700">{slot.city}</span>
        </div>
      )}
    </div>
  )

  if (slot.matchId && !isEmpty) {
    return <Link href={`/matches/${slot.matchId}`}>{inner}</Link>
  }
  return inner
}

export function TournamentBracket({ matches, simulations }: Props) {
  const byPhase: Record<string, MatchSlot[]> = {}
  for (const m of matches) {
    if (!byPhase[m.phase]) byPhase[m.phase] = []
    byPhase[m.phase].push(m)
  }

  for (const phase of Object.keys(byPhase)) {
    byPhase[phase].sort((a, b) => a.matchNumber - b.matchNumber)
  }

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

  const firstWithData = PHASE_ORDER.find(p =>
    (byPhase[p] ?? []).some(m => m.homeTeam || m.awayTeam)
  ) ?? phases[0]

  const [activePhase, setActivePhase] = useState<string>(firstWithData ?? phases[0] ?? 'round_of_32')

  const activeMatches = byPhase[activePhase] ?? []
  const activeCount   = activeMatches.filter(m => m.homeTeam || m.awayTeam).length
  const isFinal       = activePhase === 'final' || activePhase === 'third_place'

  if (matches.length === 0) {
    return (
      <div className="card p-12 text-center space-y-3">
        <Trophy className="h-10 w-10 text-zinc-700 mx-auto" />
        <p className="text-sm font-medium text-zinc-500">Fase eliminatoria pendiente</p>
        <p className="text-xs text-zinc-600 max-w-sm mx-auto">
          El cuadro se mostrará cuando los partidos estén programados en la base de datos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Phase tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {phases.map(phase => {
          const hasData = (byPhase[phase] ?? []).some(m => m.homeTeam || m.awayTeam)
          const isActive = activePhase === phase
          return (
            <button
              key={phase}
              onClick={() => setActivePhase(phase)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap',
                isActive
                  ? phase === 'final'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : hasData
                    ? 'bg-zinc-800 text-zinc-400 border border-transparent hover:text-zinc-200'
                    : 'bg-zinc-800/40 text-zinc-600 border border-transparent',
              )}
            >
              {PHASE_LABEL[phase]}
            </button>
          )
        })}
      </div>

      {/* Subtitle */}
      <p className="text-xs text-zinc-600">
        {activeCount > 0
          ? `${activeCount} de ${PHASE_SLOTS[activePhase] ?? activeMatches.length} partidos definidos`
          : 'Partidos por definir — se actualizará al avanzar la fase anterior'
        }
      </p>

      {/* Matches grid */}
      <div className={cn(
        'grid gap-3',
        isFinal || activeMatches.length <= 2
          ? 'grid-cols-1 max-w-sm mx-auto'
          : activeMatches.length <= 4
            ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl'
            : 'grid-cols-1 sm:grid-cols-2',
      )}>
        {activeMatches.map(slot => (
          <MatchCard
            key={`${slot.phase}-${slot.matchNumber}`}
            slot={slot}
            simulations={simulations}
          />
        ))}
      </div>

      <p className="text-[10px] text-zinc-700 text-center pt-1">
        Probabilidades basadas en simulación Monte Carlo · Barra: verde = local · azul = visitante
      </p>
    </div>
  )
}
