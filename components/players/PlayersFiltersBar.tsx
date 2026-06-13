'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const POSITIONS = [
  { value: 'GK',  label: 'Portero' },
  { value: 'CB',  label: 'Central' },
  { value: 'LB',  label: 'Lat. Izq.' },
  { value: 'RB',  label: 'Lat. Der.' },
  { value: 'CDM', label: 'Volante D.' },
  { value: 'CM',  label: 'Mediocampo' },
  { value: 'CAM', label: 'Mediocamp. Ofensivo' },
  { value: 'LW',  label: 'Extremo Izq.' },
  { value: 'RW',  label: 'Extremo Der.' },
  { value: 'ST',  label: 'Delantero' },
  { value: 'CF',  label: 'Mediapunta' },
]

const STATUS_OPTIONS = [
  { value: 'available',  label: '✓ Disponible' },
  { value: 'doubt',      label: '⚠ Duda' },
  { value: 'injured',    label: '✗ Lesionado' },
  { value: 'suspended',  label: '🟨 Suspendido' },
]

interface Props {
  teams: { id: string; name: string; short_name: string; code: string }[]
}

export function PlayersFiltersBar({ teams }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    value ? params.set(key, value) : params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const hasFilters = ['q', 'team', 'position', 'status'].some(k => searchParams.has(k))

  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[160px] flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar jugador…"
            defaultValue={searchParams.get('q') ?? ''}
            onChange={e => update('q', e.target.value)}
            className="w-full rounded-lg bg-zinc-800 pl-8 pr-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 border border-zinc-700 focus:border-emerald-500/50 outline-none transition-colors"
          />
        </div>

        {/* Team */}
        <select
          value={searchParams.get('team') ?? ''}
          onChange={e => update('team', e.target.value)}
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-emerald-500/50 transition-colors cursor-pointer min-w-[110px]"
        >
          <option value="">Todos los equipos</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t.code} — {t.short_name}</option>
          ))}
        </select>

        {/* Position */}
        <select
          value={searchParams.get('position') ?? ''}
          onChange={e => update('position', e.target.value)}
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
        >
          <option value="">Todas las posiciones</option>
          {POSITIONS.map(p => (
            <option key={p.value} value={p.value}>{p.value} — {p.label}</option>
          ))}
        </select>

        {/* Status */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map(opt => {
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
                {opt.label}
              </button>
            )
          })}
        </div>

        {hasFilters && (
          <button
            onClick={() => router.push(pathname)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-3 w-3" /> Limpiar
          </button>
        )}
      </div>
    </div>
  )
}
