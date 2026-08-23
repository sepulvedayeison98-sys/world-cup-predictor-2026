'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, CalendarRange } from 'lucide-react'
import { cn } from '@/lib/utils'
import { todayCol } from '@/lib/datetime'

interface Competition { id: string; name: string }
interface Team  { id: string; name: string; short_name: string; code: string; competition_id?: string }

interface Props {
  competitions: Competition[]
  teams: Team[]
  defaultDate?: string
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

export function MatchFiltersBar({ competitions, teams, defaultDate }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Al acotar por competición, el selector de equipos muestra solo los suyos:
  // 116 clubes de seis ligas en una sola lista no es una lista, es un muro.
  const competitionParam = searchParams.get('competition') ?? ''
  const visibleTeams = competitionParam
    ? teams.filter((t) => t.competition_id === competitionParam)
    : teams

  // Fecha local en formato YYYY-MM-DD
  const todayStr = todayCol()
  // Q2: sin fecha en la URL, cae en la fecha por defecto del servidor
  // (hoy si hay partidos; si no, la próxima fecha con actividad)
  const dateParam = searchParams.get('date') ?? defaultDate ?? todayStr
  const rangeParam = searchParams.get('range') // '7d' → ventana de 7 días, ignora dateParam

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

  // Un día concreto y una ventana de varios días son modos distintos: elegir
  // uno limpia el otro para que la URL nunca diga las dos cosas a la vez.
  const setSingleDate = (date: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', date)
    params.delete('range')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }
  const setRange = (range: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('range', range)
    params.delete('date')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const hasFilters =
    searchParams.has('q') ||
    searchParams.has('status') ||
    searchParams.has('competition') ||
    searchParams.has('team') ||
    searchParams.has('confidence') ||
    searchParams.has('range') ||
    (searchParams.has('date') && searchParams.get('date') !== todayStr)

  const hasAdvancedFilters = Boolean(competitionParam || searchParams.get('team') || searchParams.get('confidence'))

  const clearAll = () => router.push(pathname)

  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center gap-2">

        {/* Date navigation — inactivo visualmente en modo ventana (range) */}
        <div className={cn(
          'flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-1 py-0.5',
          rangeParam && 'opacity-50',
        )}>
          <button
            onClick={() => setSingleDate(shiftDate(dateParam, -1))}
            className="rounded p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
            title="Día anterior"
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-1.5 px-1">
            <CalendarDays className="h-3.5 w-3.5 text-zinc-500" />
            <input
              type="date"
              value={dateParam}
              onChange={(e) => setSingleDate(e.target.value)}
              aria-label="Fecha de los partidos"
              className="bg-transparent text-xs text-zinc-200 outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>

          <button
            onClick={() => setSingleDate(shiftDate(dateParam, +1))}
            className="rounded p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
            title="Día siguiente"
            aria-label="Día siguiente"
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
              onClick={() => setSingleDate(date)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors active:scale-95',
                !rangeParam && dateParam === date
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600 hover:text-zinc-300'
              )}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setRange('7d')}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors active:scale-95',
              rangeParam === '7d'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600 hover:text-zinc-300'
            )}
          >
            <CalendarRange className="h-3 w-3" />
            Próximos 7 días
          </button>
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
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors active:scale-95',
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

        {/* Filtros avanzados: detrás de un panel desplegable — competición,
            equipo y confianza no son de uso diario, y mostrarlos siempre
            saturaba la barra con tres selects más. */}
        <button
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors active:scale-95',
            hasAdvancedFilters
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600 hover:text-zinc-300'
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros avanzados
          {hasAdvancedFilters && (
            <span className="mono text-[10px]">
              ({[competitionParam, searchParams.get('team'), searchParams.get('confidence')].filter(Boolean).length})
            </span>
          )}
          <ChevronDown className={cn('h-3 w-3 transition-transform', advancedOpen && 'rotate-180')} />
        </button>

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

      {advancedOpen && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
          {/* Competition */}
          <select
            value={competitionParam}
            onChange={(e) => {
              // Cambiar de liga invalida el equipo elegido: era de la otra.
              const params = new URLSearchParams(searchParams.toString())
              if (e.target.value) params.set('competition', e.target.value)
              else params.delete('competition')
              params.delete('team')
              params.delete('page')
              router.push(`${pathname}?${params.toString()}`)
            }}
            aria-label="Filtrar por competición"
            className={cn(
              'rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5',
              'text-xs text-zinc-300 outline-none focus:border-emerald-500/50',
              'transition-colors cursor-pointer'
            )}
          >
            <option value="">Todas las ligas</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Team */}
          <select
            value={searchParams.get('team') ?? ''}
            onChange={(e) => update('team', e.target.value)}
            aria-label="Filtrar por equipo"
            className={cn(
              'rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5',
              'text-xs text-zinc-300 outline-none focus:border-emerald-500/50',
              'transition-colors cursor-pointer min-w-[120px]'
            )}
          >
            <option value="">Todos los equipos</option>
            {visibleTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.short_name || t.name}
              </option>
            ))}
          </select>

          {/* Confidence */}
          <select
            value={searchParams.get('confidence') ?? ''}
            onChange={(e) => update('confidence', e.target.value)}
            aria-label="Filtrar por nivel de confianza"
            className={cn(
              'rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5',
              'text-xs text-zinc-300 outline-none focus:border-emerald-500/50',
              'transition-colors cursor-pointer'
            )}
          >
            {CONFIDENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Confianza: {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
