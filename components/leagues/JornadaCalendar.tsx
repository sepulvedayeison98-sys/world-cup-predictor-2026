'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface JornadaMatchView {
  id: string
  kickoff_time: string
  status: string
  home: { name: string; logo_url: string | null }
  away: { name: string; logo_url: string | null }
  home_score: number | null
  away_score: number | null
  prediction: {
    home: number // 0-1
    draw: number
    away: number
    pick: 'home' | 'draw' | 'away'
    correct: boolean | null
  } | null
}

export interface JornadaView {
  round: number
  matches: JornadaMatchView[]
}

const PICK_LABEL: Record<string, string> = { home: 'Local', draw: 'Empate', away: 'Visita' }

function TeamCell({ team, align }: { team: JornadaMatchView['home']; align: 'left' | 'right' }) {
  return (
    <div className={cn('flex items-center gap-2 min-w-0', align === 'right' && 'flex-row-reverse')}>
      {team.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo_url} alt="" className="h-5 w-5 shrink-0 object-contain" loading="lazy" />
      )}
      <span className="truncate text-sm font-medium text-zinc-200">{team.name}</span>
    </div>
  )
}

export function JornadaCalendar({ jornadas, initialRound }: { jornadas: JornadaView[]; initialRound: number }) {
  const rounds = jornadas.map((j) => j.round)
  const [round, setRound] = useState(rounds.includes(initialRound) ? initialRound : rounds[0])
  const idx = rounds.indexOf(round)
  const jornada = jornadas[idx]
  if (!jornada) return null

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Selector de jornada */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-bold text-white">Calendario</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => idx > 0 && setRound(rounds[idx - 1])}
            disabled={idx === 0}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
            aria-label="Jornada anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <select
            value={round}
            onChange={(e) => setRound(Number(e.target.value))}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-semibold text-zinc-200"
            aria-label="Seleccionar jornada"
          >
            {rounds.map((r) => (
              <option key={r} value={r}>Jornada {r}</option>
            ))}
          </select>
          <button
            onClick={() => idx < rounds.length - 1 && setRound(rounds[idx + 1])}
            disabled={idx === rounds.length - 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
            aria-label="Jornada siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ul className="divide-y divide-zinc-800/60">
        {jornada.matches.map((m) => {
          const played = m.status === 'finished' && m.home_score !== null
          const p = m.prediction
          return (
            // Todo partido es clicable: abre la vista de detalle completa
            <li key={m.id}>
              <Link
                href={`/matches/${m.id}`}
                className="block px-4 py-3 transition-colors hover:bg-zinc-800/40 focus-visible:bg-zinc-800/40 focus-visible:outline-none"
              >
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <TeamCell team={m.home} align="right" />
                <div className="text-center">
                  {played ? (
                    <span className="rounded-lg bg-zinc-950 px-2.5 py-1 text-sm font-bold text-white tabular-nums">
                      {m.home_score} - {m.away_score}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">
                      {new Date(m.kickoff_time).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                </div>
                <TeamCell team={m.away} align="left" />
              </div>

              {p && (
                <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-zinc-500">
                  {/* Barra 1X2 del modelo */}
                  <div className="flex h-1.5 w-40 overflow-hidden rounded-full bg-zinc-800">
                    <div className="bg-emerald-500/80" style={{ width: `${p.home * 100}%` }} />
                    <div className="bg-zinc-600" style={{ width: `${p.draw * 100}%` }} />
                    <div className="bg-sky-500/80" style={{ width: `${p.away * 100}%` }} />
                  </div>
                  <span className="tabular-nums">
                    {Math.round(p.home * 100)}·{Math.round(p.draw * 100)}·{Math.round(p.away * 100)}%
                  </span>
                  <span className="flex items-center gap-1">
                    Pick: {PICK_LABEL[p.pick]}
                    {p.correct === true && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                    {p.correct === false && <X className="h-3.5 w-3.5 text-red-400" />}
                  </span>
                </div>
              )}
              </Link>
            </li>
          )
        })}
      </ul>

      <p className="border-t border-zinc-800 px-4 py-2.5 text-[11px] text-zinc-600">
        Barra: probabilidades del modelo (local · empate · visita), calculadas
        antes de cada partido con la información disponible hasta esa jornada.
        Las primeras jornadas no tienen predicción (calentamiento del modelo).
      </p>
    </div>
  )
}
