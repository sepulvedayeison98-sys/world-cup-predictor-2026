'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, flexRender, createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import Link from 'next/link'
import { ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

interface Props { competitionId: string }

type PlayerRow = {
  id: string
  name: string
  short_name: string
  number: number
  position: string
  status: string
  team: { id: string; name: string; short_name: string; code: string } | null
  player_statistics: {
    matches_played: number
    minutes_played: number
    goals: number
    assists: number
    avg_rating: number
    form_score: number
    physical_condition: number
  } | null
}

const col = createColumnHelper<PlayerRow>()

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  available:  { label: 'Disponible',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  doubt:      { label: 'Duda',        color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  injured:    { label: 'Lesionado',   color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
  suspended:  { label: 'Suspendido',  color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/20' },
}

const POSITION_COLORS: Record<string, string> = {
  GK: 'text-violet-400 bg-violet-500/10',
  CB: 'text-blue-400 bg-blue-500/10',
  LB: 'text-blue-400 bg-blue-500/10',
  RB: 'text-blue-400 bg-blue-500/10',
  CDM: 'text-cyan-400 bg-cyan-500/10',
  CM: 'text-cyan-400 bg-cyan-500/10',
  CAM: 'text-emerald-400 bg-emerald-500/10',
  LW: 'text-amber-400 bg-amber-500/10',
  RW: 'text-amber-400 bg-amber-500/10',
  ST: 'text-red-400 bg-red-500/10',
  CF: 'text-orange-400 bg-orange-500/10',
}

function FormBar({ score }: { score: number }) {
  const pct = Math.round((score / 10) * 100)
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all',
            score >= 7 ? 'bg-emerald-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-[10px] mono font-semibold',
        score >= 7 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-red-400'
      )}>
        {score.toFixed(1)}
      </span>
    </div>
  )
}

function PhysicalBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={cn('h-full rounded-full',
            value >= 90 ? 'bg-emerald-500' : value >= 70 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] mono text-zinc-400">{value}%</span>
    </div>
  )
}

async function fetchPlayers(filters: Record<string, string>, competitionId: string): Promise<PlayerRow[]> {
  const supabase = createClient()
  let query = supabase
    .from('players')
    .select(`
      id, name, short_name, number, position, status,
      team:teams(id, name, short_name, code),
      player_statistics!inner(
        matches_played, minutes_played, goals, assists,
        avg_rating, form_score, physical_condition
      )
    `)
    .eq('player_statistics.competition_id', competitionId)
    .order('name')

  if (filters.team)     query = query.eq('team_id', filters.team)
  // Los filtros llegan como string de la URL; los enums del schema los validan en runtime
  if (filters.position) query = query.eq('position', filters.position as Database['public']['Enums']['player_position'])
  if (filters.status)   query = query.eq('status', filters.status as Database['public']['Enums']['player_status'])
  if (filters.q)        query = query.ilike('name', `%${filters.q}%`)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((p: any) => ({
    ...p,
    player_statistics: Array.isArray(p.player_statistics) ? p.player_statistics[0] ?? null : p.player_statistics,
  }))
}

export function PlayersTable({ competitionId }: Props) {
  const searchParams = useSearchParams()
  const [sorting, setSorting] = useState<SortingState>([{ id: 'form_score', desc: true }])

  const filters = {
    team:     searchParams.get('team') ?? '',
    position: searchParams.get('position') ?? '',
    status:   searchParams.get('status') ?? '',
    q:        searchParams.get('q') ?? '',
  }

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['players', filters, competitionId],
    queryFn: () => fetchPlayers(filters, competitionId),
    staleTime: 120_000,
  })

  const columns = useMemo(() => [
    col.display({
      id: 'player',
      header: 'Jugador',
      cell: ({ row }) => {
        const p = row.original
        const s = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.available
        return (
          <div className="flex items-center gap-2.5 min-w-[160px]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700">
              <span className="text-xs font-bold text-zinc-300 mono">{p.number}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-100 truncate">{p.name}</p>
              <span className={cn('inline-flex rounded px-1 py-0.5 text-[10px] font-medium border', s.bg, s.color)}>
                {s.label}
              </span>
            </div>
          </div>
        )
      },
      size: 200,
    }),
    col.display({
      id: 'position',
      header: 'Pos.',
      cell: ({ row }) => (
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', POSITION_COLORS[row.original.position] ?? 'text-zinc-400 bg-zinc-800')}>
          {row.original.position}
        </span>
      ),
      size: 60,
    }),
    col.display({
      id: 'team',
      header: 'Equipo',
      cell: ({ row }) => (
        <span className="text-xs text-zinc-400">{row.original.team?.code}</span>
      ),
      size: 70,
    }),
    col.accessor(r => r.player_statistics?.minutes_played ?? 0, {
      id: 'minutes_played',
      header: 'Min.',
      cell: info => <span className="mono text-xs text-zinc-400">{info.getValue()}&apos;</span>,
      size: 60,
    }),
    col.accessor(r => r.player_statistics?.goals ?? 0, {
      id: 'goals',
      header: 'Goles',
      cell: info => (
        <span className={cn('mono text-sm font-bold', (info.getValue() as number) > 0 ? 'text-emerald-400' : 'text-zinc-600')}>
          {info.getValue() as number}
        </span>
      ),
      size: 65,
    }),
    col.accessor(r => r.player_statistics?.assists ?? 0, {
      id: 'assists',
      header: 'Asis.',
      cell: info => (
        <span className={cn('mono text-sm font-bold', (info.getValue() as number) > 0 ? 'text-blue-400' : 'text-zinc-600')}>
          {info.getValue() as number}
        </span>
      ),
      size: 65,
    }),
    col.accessor(r => r.player_statistics?.avg_rating ?? 0, {
      id: 'avg_rating',
      header: 'Rating',
      cell: info => {
        const v = info.getValue() as number
        return (
          <span className={cn('mono text-sm font-bold',
            v >= 8 ? 'text-emerald-400' : v >= 7 ? 'text-amber-400' : 'text-zinc-400'
          )}>
            {v > 0 ? v.toFixed(1) : '—'}
          </span>
        )
      },
      size: 70,
    }),
    col.accessor(r => r.player_statistics?.form_score ?? 0, {
      id: 'form_score',
      header: 'Forma',
      cell: info => <FormBar score={info.getValue() as number} />,
      size: 100,
    }),
    col.accessor(r => r.player_statistics?.physical_condition ?? 0, {
      id: 'physical_condition',
      header: 'Estado Físico',
      cell: info => <PhysicalBar value={info.getValue() as number} />,
      size: 120,
    }),
    col.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Link
          href={`/players/${row.original.id}`}
          className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Perfil <ExternalLink className="h-3 w-3" />
        </Link>
      ),
      size: 70,
    }),
  ], [])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  const SortIcon = ({ col }: { col: any }) => {
    if (!col.getCanSort()) return null
    const sorted = col.getIsSorted()
    return sorted === 'asc'
      ? <ChevronUp className="h-3 w-3 text-emerald-400" />
      : sorted === 'desc'
      ? <ChevronDown className="h-3 w-3 text-emerald-400" />
      : <ChevronsUpDown className="h-3 w-3 text-zinc-600" />
  }

  if (isError) return (
    <div className="card p-8 text-center">
      <p className="text-sm text-red-400">Error al cargar jugadores.</p>
    </div>
  )

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <p className="text-xs text-zinc-500">{isLoading ? '…' : `${data.length} jugadores`}</p>
        <p className="text-[10px] text-zinc-600">
          Pág. {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="border-b border-zinc-800">
                {hg.headers.map((header, colIdx) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={cn(
                      'text-left',
                      // Primera columna (Jugador) fija en scroll horizontal móvil
                      colIdx === 0 && 'sticky left-0 z-10 bg-zinc-900',
                      header.column.getCanSort() && 'cursor-pointer select-none hover:text-zinc-300',
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon col={header.column} />
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((_, j) => (
                      <td key={j}><div className="h-8 animate-pulse rounded bg-zinc-800" /></td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map(row => (
                  <tr key={row.id} className={cn(
                    row.original.status === 'injured'   && 'bg-red-500/3',
                    row.original.status === 'doubt'     && 'bg-amber-500/3',
                    row.original.status === 'suspended' && 'bg-yellow-500/3',
                  )}>
                    {row.getVisibleCells().map((cell, colIdx) => (
                      <td
                        key={cell.id}
                        className={cn(colIdx === 0 && 'sticky left-0 z-10 !bg-zinc-900')}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
            }
            {!isLoading && data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-sm text-zinc-500">
                  No se encontraron jugadores con esos filtros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
        <p className="text-xs text-zinc-500">
          {table.getState().pagination.pageIndex * 20 + 1}–{Math.min((table.getState().pagination.pageIndex + 1) * 20, data.length)} de {data.length}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
