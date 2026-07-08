'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface EventRow {
  id: string
  team_id: string | null
  minute: number | null
  minute_extra: number | null
  type: string
  player_name: string | null
  assist_name: string | null
  detail: string | null
}

interface Props {
  matchId: string
  homeTeamId: string
  homeName: string
  awayName: string
  /** true si el partido tiene fuente de eventos (api_football_id) */
  hasSource: boolean
  status: string
}

const EVENT_META: Record<string, { icon: string; label: string; cls: string }> = {
  goal:           { icon: '⚽', label: 'Gol',            cls: 'text-emerald-400' },
  penalty_goal:   { icon: '⚽', label: 'Gol de penal',   cls: 'text-emerald-400' },
  own_goal:       { icon: '⚽', label: 'Autogol',        cls: 'text-red-400' },
  missed_penalty: { icon: '✗',  label: 'Penal fallado',  cls: 'text-red-400' },
  yellow_card:    { icon: '▮',  label: 'Amarilla',       cls: 'text-amber-400' },
  red_card:       { icon: '▮',  label: 'Roja',           cls: 'text-red-500' },
  substitution:   { icon: '⇄',  label: 'Cambio',         cls: 'text-zinc-400' },
  var:            { icon: 'VAR', label: 'Revisión VAR',  cls: 'text-sky-400' },
}

/**
 * Línea de tiempo del partido (plantilla EVENTO, genérica por deporte):
 * eventos del local a la izquierda, visitante a la derecha, eje central
 * con el minuto. La primera visita a un partido de liga dispara la
 * ingesta única (el estado de carga lo dice honestamente).
 */
export function MatchTimeline({ matchId, homeTeamId, homeName, awayName, hasSource, status }: Props) {
  const [events, setEvents] = useState<EventRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/matches/${matchId}/events`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (alive) setEvents(d.events ?? []) })
      .catch(() => { if (alive) { setEvents([]); setFailed(true) } })
    return () => { alive = false }
  }, [matchId])

  // Sin fuente de eventos y sin datos: no ocupar espacio con promesas vacías
  if (events !== null && events.length === 0 && !hasSource) return null
  if (events !== null && events.length === 0 && (failed || status !== 'finished')) return null

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-bold text-white">Línea de tiempo</h2>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="text-emerald-400">{homeName}</span>
          <span>·</span>
          <span className="text-sky-400">{awayName}</span>
        </div>
      </div>

      {events === null ? (
        <div className="px-4 py-6 text-center text-xs text-zinc-500">
          Cargando eventos del partido…
        </div>
      ) : events.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-zinc-500">
          Eventos no disponibles para este partido.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800/40">
          {events.map((e) => {
            const meta = EVENT_META[e.type] ?? { icon: '·', label: e.type, cls: 'text-zinc-400' }
            const isHome = e.team_id === homeTeamId
            const minute = e.minute != null
              ? `${e.minute}${e.minute_extra ? `+${e.minute_extra}` : ''}'`
              : '—'
            const body = (
              <div className={cn('min-w-0', isHome ? 'text-right' : 'text-left')}>
                <p className="truncate text-sm text-zinc-200">
                  <span className={cn('mr-1.5 font-bold', meta.cls)}>{meta.icon}</span>
                  <span className="font-medium">{e.player_name ?? meta.label}</span>
                </p>
                <p className="truncate text-[11px] text-zinc-500">
                  {meta.label}
                  {e.type === 'substitution' && e.assist_name ? ` · entra ${e.assist_name}` : ''}
                  {e.type !== 'substitution' && e.assist_name ? ` · asiste ${e.assist_name}` : ''}
                </p>
              </div>
            )
            return (
              <li key={e.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2">
                <div>{isHome && body}</div>
                <span className="w-11 shrink-0 rounded bg-zinc-950 px-1.5 py-0.5 text-center text-[11px] font-bold mono text-zinc-400">
                  {minute}
                </span>
                <div>{!isHome && body}</div>
              </li>
            )
          })}
        </ul>
      )}
      {events !== null && events.length > 0 && (
        <p className="border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-600">
          Fuente: API-Football · eventos oficiales del partido
        </p>
      )}
    </div>
  )
}
