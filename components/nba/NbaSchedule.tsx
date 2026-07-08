'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Game {
  id: string
  kickoff_time: string
  status: string
  home_code: string
  away_code: string
  home_name: string
  away_name: string
  home_score: number | null
  away_score: number | null
  prob_home: number | null
  prob_away: number | null
  was_correct: boolean | null
}

function shiftDay(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00-05:00`)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

/**
 * Calendario NBA navegable por día: cualquier partido es clicable y abre
 * su detalle completo. Carga cada día bajo demanda desde /api/nba/games
 * (la temporada tiene ~1.300 partidos, no caben todos en el servidor).
 */
export function NbaSchedule({ initialDate }: { initialDate: string }) {
  const [date, setDate] = useState(initialDate)
  const [games, setGames] = useState<Game[] | null>(null)

  const load = useCallback((d: string) => {
    setGames(null)
    fetch(`/api/nba/games?date=${d}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((body) => setGames(body.games ?? []))
      .catch(() => setGames([]))
  }, [])

  useEffect(() => { load(date) }, [date, load])

  const label = new Date(`${date}T12:00:00-05:00`).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-bold text-white">Calendario</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate((d) => shiftDay(d, -1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200"
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
            aria-label="Seleccionar fecha"
          />
          <button
            onClick={() => setDate((d) => shiftDay(d, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200"
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="px-4 pt-2 text-[11px] capitalize text-zinc-500">{label}</p>

      {games === null ? (
        <div className="px-4 py-6 text-center text-xs text-zinc-500">Cargando partidos…</div>
      ) : games.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-zinc-500">
          No hay partidos NBA este día. Usa las flechas para buscar otra fecha.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800/60">
          {games.map((g) => {
            const played = g.status === 'finished' && g.home_score !== null
            return (
              <li key={g.id}>
                <Link href={`/matches/${g.id}`} className="block px-4 py-2.5 hover:bg-zinc-800/40 transition-colors">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <span className="truncate text-right text-sm font-medium text-zinc-200">{g.home_code}</span>
                    <span className="text-center">
                      {played ? (
                        <span className="rounded bg-zinc-950 px-2 py-0.5 text-sm font-bold text-white tabular-nums">{g.home_score}-{g.away_score}</span>
                      ) : (
                        <span className="text-[11px] text-zinc-500">
                          {new Date(g.kickoff_time).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-left text-sm font-medium text-zinc-200">{g.away_code}</span>
                  </div>
                  {(g.prob_home != null) && (
                    <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
                      <span className="mono">{g.prob_home}%–{g.prob_away}%</span>
                      {played && g.was_correct === true && <Check className="h-3 w-3 text-emerald-400" />}
                      {played && g.was_correct === false && <X className="h-3 w-3 text-red-400" />}
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
