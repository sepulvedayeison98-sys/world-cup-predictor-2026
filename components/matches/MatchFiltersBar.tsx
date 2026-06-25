'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Group { id: string; name: string; letter: string }
interface Team  { id: string; name: string; short_name: string; code: string }

interface Props {
  groups: Group[]
  teams: Team[]
}

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Programado' },
  { value: 'live',      label: 'En vivo' },
  { value: 'finished',  label: 'Finalizado' },
]

const CONFIDENCE_OPTIONS = [
  { value: '',  label: 'Cualquiera' },
  { value: '3', label: '⭐⭐⭐+' },
  { value: '4', label: '⭐⭐⭐⭐+' },
  { value: '5', label: '⭐⭐⭐⭐⭐' },
]

export function MatchFiltersBar({ groups, teams }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Fecha local en formato YYYY-MM-DD
  const todayStr = new Date().toLocaleDateString('en-CA')
  const dateParam = searchParams.get('date') ?? todayStr

  const shiftDate = (base: string, days: number) => {
    const d = new Date(`${base}T12:00:00`)
    d.setDate(d.getDate() + days)
    return d.toLocaleDateString('en-CA')
  }
  const yesterdayStr = shiftDate(todayStr, -1)
  const tomorrowStr  = shiftDate(todayStr, +1)

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const hasFilters =
    searchParams.has('q') ||
    searchParams.has('status') ||
    searchParams.has('group') ||
    searchParams.has('team') ||
    searchParams.has('confidence') ||
    (searchParams.has('date') && searchParams.get('date') !== todayStr)

  const clearAll = () => router.push(pathname)

  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center gap-2">

        {/* Date navigation */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-1 py-0.5">
          <button
            onClick={() => update('date', shiftDate(dateParam, -1))}
            className="rounded p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
            title="Día anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-1.5 px-1">
            <CalendarDays className="h-3.5 w-3.5 text-zinc-500" />
            <input
              type="date"
              value={dateParam}
              onChange={(e) => update('date', e.target.value)}
              className="bg-transparent text-xs text-zinc-200 outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>

          <button
            onClick={() => update('date', shiftDate(dateParam, +1))}
            className="rounded p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
            title="Día siguiente"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Quick day buttons */}
        <div className="flex items-center gap-1">
          {[
            { label: 'Ayer',   date: yesterdayStr },
            { label: 'Hoy',    date: todayStr },
            { label: 'Mañana', date: tomorrowStr },
          ].map(({ label, date }) => (
            <button
              key={date}
              onClick={() => update('date', date)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                dateParam === date
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600 hover:text-zinc-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-zinc-700" />

        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar equipo, estadio…"
            defaultValue={searchParams.get('q') ?? ''}
            onChange={(e) => update('q', e.target.value)}
            className={cn(
              'w-full rounded-lg bg-zinc-800 pl-8 pr-3 py-1.5',
              'text-sm text-zinc-200 placeholder:text-zinc-600',
              'border border-zinc-700 focus:border-emerald-500/50',
              'outline-none transition-colors'
            )}
          />
        </div>

        {/* Status */}
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map((opt) => {
            const active = searchParams.get('status') === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => update('status', active ? '' : opt.value)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                  active
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600 hover:text-zinc-300'
                )}
              >
                {opt.value === 'live' && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />
                )}
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Group */}
        <select
          value={searchParams.get('group') ?? ''}
          onChange={(e) => update('group', e.target.value)}
          className={cn(
            'rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5',
            'text-xs text-zinc-300 outline-none focus:border-emerald-500/50',
            'transition-colors cursor-pointer'
          )}
        >
          <option value="">Todos los grupos</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              Grupo {g.letter}
            </option>
          ))}
        </select>

        {/* Team */}
        <select
          value={searchParams.get('team') ?? ''}
          onChange={(e) => update('team', e.target.value)}
          className={cn(
            'rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5',
            'text-xs text-zinc-300 outline-none focus:border-emerald-500/50',
            'transition-colors cursor-pointer min-w-[120px]'
          )}
        >
          <option value="">Todos los equipos</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code} — {t.short_name}
            </option>
          ))}
        </select>

        {/* Confidence */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-500" />
          <select
            value={searchParams.get('confidence') ?? ''}
            onChange={(e) => update('confidence', e.target.value)}
            className={cn(
              'rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5',
              'text-xs text-zinc-300 outline-none focus:border-emerald-500/50',
              'transition-colors cursor-pointer'
            )}
          >
            {CONFIDENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        )}
      </div>
    </div>
  )
}
