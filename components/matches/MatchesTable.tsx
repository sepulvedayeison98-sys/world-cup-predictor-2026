'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, ExternalLink,
} from 'lucide-react'
import { cn, formatProbability } from '@/lib/utils'
import { matchesService } from '@/services/matches.service'
import { Flag } from '@/components/ui/Flag'
import type { Match } from '@/types'

// ─── Column helper ────────────────────────────────────────────

type MatchRow = Match & {
  prediction?: {
    home_win_probability: number
    draw_probability: number
    away_win_probability: number
    confidence_level: number
    predicted_home_score: number
    predicted_away_score: number
    confidence_score: number
  } | null
}

const col = createColumnHelper<MatchRow>()

// ─── Sub-components ───────────────────────────────────────────

function ProbBar({ home, draw, away }: { home: number; draw: number; away: number }) {
  const h = Math.round(home * 100)
  const d = Math.round(draw * 100)
  const a = Math.round(away * 100)
  return (
    <div className="space-y-0.5 min-w-[90px]">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="bg-emerald-500" style={{ width: `${h}%` }} />
        <div className="bg-amber-500"   style={{ width: `${d}%` }} />
        <div className="bg-red-500"     style={{ width: `${a}%` }} />
      </div>
      <div className="flex justify-between text-[9px] mono">
        <span className="text-emerald-400">{h}%</span>
        <span className="text-amber-400">{d}%</span>
        <span className="text-red-400">{a}%</span>
      </div>
    </div>
  )
}

function Stars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < level ? 'text-amber-400' : 'text-zinc-700'} style={{ fontSize: 10 }}>
          ★
        </span>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    scheduled: { label: 'Programado', className: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
    live:      { label: 'En vivo',    className: 'bg-red-500/10 text-red-400 border-red-500/20' },
    finished:  { label: 'Finalizado', className: 'bg-zinc-800 text-zinc-500 border-zinc-700' },
    postponed: { label: 'Aplazado',   className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  }
  const cfg = map[status] ?? map.scheduled
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider border', cfg.className)}>
      {status === 'live' && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
      {cfg.label}
    </span>
  )
}

// ─── Column definitions ───────────────────────────────────────

function buildColumns(): ColumnDef<MatchRow, any>[] {
  return [
    col.accessor('kickoff_time', {
      header: 'Fecha',
      cell: (info) => (
        <div className="whitespace-nowrap">
          <p className="text-xs font-medium text-zinc-200">
            {format(new Date(info.getValue()), "d MMM", { locale: es })}
          </p>
          <p className="text-[10px] text-zinc-500 mono">
            {format(new Date(info.getValue()), "HH:mm")}
          </p>
        </div>
      ),
      size: 80,
    }),
    col.accessor('status', {
      header: 'Estado',
      cell: (info) => <StatusBadge status={info.getValue()} />,
      size: 100,
    }),
    col.display({
      id: 'home_team',
      header: 'Local',
      cell: ({ row }) => {
        const m = row.original
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            <Flag code={m.home_team?.code} />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-zinc-100">
                {m.home_team?.short_name ?? m.home_team?.code}
              </span>
              <span className="text-[10px] text-zinc-500">
                FIFA #{m.home_team?.fifa_ranking}
              </span>
            </div>
            {m.status === 'finished' || m.status === 'live' ? (
              <span className="mono text-sm font-bold text-white">{m.home_score}</span>
            ) : null}
          </div>
        )
      },
      size: 130,
    }),
    col.display({
      id: 'away_team',
      header: 'Visitante',
      cell: ({ row }) => {
        const m = row.original
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            {m.status === 'finished' || m.status === 'live' ? (
              <span className="mono text-sm font-bold text-white">{m.away_score}</span>
            ) : null}
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-zinc-100">
                {m.away_team?.short_name ?? m.away_team?.code}
              </span>
              <span className="text-[10px] text-zinc-500">
                FIFA #{m.away_team?.fifa_ranking}
              </span>
            </div>
            <Flag code={m.away_team?.code} />
          </div>
        )
      },
      size: 130,
    }),
    col.display({
      id: 'probabilities',
      header: 'Probabilidades',
      cell: ({ row }) => {
        const p = row.original.prediction
        if (!p) return <span className="text-[10px] text-zinc-600">Sin análisis</span>
        return (
          <ProbBar
            home={p.home_win_probability}
            draw={p.draw_probability}
            away={p.away_win_probability}
          />
        )
      },
      size: 120,
    }),
    col.display({
      id: 'predicted_score',
      header: 'Marcador Est.',
      cell: ({ row }) => {
        const p = row.original.prediction
        if (!p) return <span className="text-[10px] text-zinc-600">—</span>
        return (
          <span className="mono text-sm font-bold text-zinc-200">
            {p.predicted_home_score}–{p.predicted_away_score}
          </span>
        )
      },
      size: 90,
    }),
    col.display({
      id: 'confidence',
      header: 'Confianza',
      cell: ({ row }) => {
        const p = row.original.prediction
        if (!p) return <span className="text-[10px] text-zinc-600">—</span>
        return (
          <div className="space-y-0.5">
            <Stars level={p.confidence_level} />
            <span className="text-[10px] text-zinc-500 mono">{p.confidence_score.toFixed(0)}%</span>
          </div>
        )
      },
      size: 90,
    }),
    col.display({
      id: 'venue',
      header: 'Sede',
      cell: ({ row }) => (
        <div>
          <p className="text-xs text-zinc-300 truncate max-w-[120px]">{row.original.venue}</p>
          <p className="text-[10px] text-zinc-500">{row.original.city}</p>
        </div>
      ),
      size: 130,
    }),
    col.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Link
          href={`/matches/${row.original.id}`}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors"
        >
          Analizar <ExternalLink className="h-3 w-3" />
        </Link>
      ),
      size: 80,
    }),
  ]
}

// ─── Main Table Component ─────────────────────────────────────

export function MatchesTable() {
  const searchParams = useSearchParams()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'kickoff_time', desc: false },
  ])
  const [pageIndex, setPageIndex] = useState(0)
  const PAGE_SIZE = 15

  // Por defecto muestra los partidos del día actual
  const todayStr  = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local
  const dateParam = searchParams.get('date') ?? todayStr
  const date_from = `${dateParam}T00:00:00`
  const date_to   = `${dateParam}T23:59:59`

  const filters = {
    search: searchParams.get('q') ?? undefined,
    status: searchParams.get('status') ? [searchParams.get('status') as any] : undefined,
    group_id: searchParams.get('group') ?? undefined,
    team_id: searchParams.get('team') ?? undefined,
    min_confidence: searchParams.get('confidence')
      ? parseInt(searchParams.get('confidence')!)
      : undefined,
    date_from,
    date_to,
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['matches', filters, dateParam, pageIndex],
    queryFn: () => matchesService.getMatchesWithPredictions(filters, pageIndex + 1, PAGE_SIZE),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const columns = useMemo(() => buildColumns(), [])

  // Mensaje de "sin resultados" contextual: deja claro que el filtro SÍ se
  // aplicó y por qué está vacío (ej. no hay partidos en vivo ahora mismo),
  // en vez de un genérico que parece un error.
  const activeStatus = filters.status?.[0]
  const hasOtherFilters = Boolean(
    filters.search || filters.group_id || filters.team_id || filters.min_confidence
  )
  const isToday = dateParam === todayStr
  const emptyMessage =
    hasOtherFilters
      ? 'No hay partidos que coincidan con los filtros actuales.'
      : activeStatus === 'live'
        ? 'No hay partidos en vivo en este momento.'
        : activeStatus === 'finished'
          ? 'No hay partidos finalizados en esta fecha.'
          : isToday
            ? 'No hay partidos programados para hoy.'
            : `No hay partidos programados para el ${new Date(`${dateParam}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'long' })}.`

  const table = useReactTable({
    data: (data?.data ?? []) as MatchRow[],
    columns,
    state: { sorting, pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: data?.total_pages ?? 1,
  })

  const SortIcon = ({ col }: { col: any }) => {
    const sorted = col.getIsSorted()
    if (!col.getCanSort()) return null
    return sorted === 'asc'
      ? <ChevronUp className="h-3 w-3 text-emerald-400" />
      : sorted === 'desc'
      ? <ChevronDown className="h-3 w-3 text-emerald-400" />
      : <ChevronsUpDown className="h-3 w-3 text-zinc-600" />
  }

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-red-400">Error al cargar los partidos. Verifica la conexión con Supabase.</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Summary row */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <p className="text-xs text-zinc-500">
          {isLoading ? '…' : `${data?.count ?? 0} partidos`}
          {Object.values(filters).some(Boolean) && ' (filtrado)'}
        </p>
        <p className="text-[10px] text-zinc-600">
          Página {pageIndex + 1} de {data?.total_pages ?? 1}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-zinc-800">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={cn(
                      'text-left',
                      header.column.getCanSort() && 'cursor-pointer select-none hover:text-zinc-300'
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
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((_, j) => (
                      <td key={j}>
                        <div className="h-8 animate-pulse rounded bg-zinc-800" />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      row.original.status === 'live' && 'bg-red-500/5'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}

            {!isLoading && (data?.data ?? []).length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  <p className="mx-auto max-w-md text-sm text-zinc-400">{emptyMessage}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
        <p className="text-xs text-zinc-500">
          Mostrando {pageIndex * PAGE_SIZE + 1}–{Math.min((pageIndex + 1) * PAGE_SIZE, data?.count ?? 0)} de {data?.count ?? 0}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pageIndex === 0}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {Array.from({ length: Math.min(data?.total_pages ?? 1, 5) }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPageIndex(i)}
              className={cn(
                'h-7 w-7 rounded-lg text-xs font-medium transition-colors',
                pageIndex === i
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              )}
            >
              {i + 1}
            </button>
          ))}

          <button
            onClick={() => setPageIndex((p) => Math.min((data?.total_pages ?? 1) - 1, p + 1))}
            disabled={pageIndex >= (data?.total_pages ?? 1) - 1}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
