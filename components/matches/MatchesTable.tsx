'use client'

import { Fragment, useMemo, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
import { formatColDate, formatColTime } from '@/lib/datetime'
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, ExternalLink,
} from 'lucide-react'
import { cn, formatProbability, getConfidenceLabel } from '@/lib/utils'
import { matchesService } from '@/services/matches.service'
import { Flag } from '@/components/ui/Flag'
import { ProbBar1X2 } from '@/components/predictions/ProbBar1X2'
import { predictionWarmup, coldStartNote, coldStartBadge } from '@/lib/predictionQuality'
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

/** Partidos jugados del equipo en SU competición (join anidado de team_statistics). */
const playedOf = (team: any): number =>
  (Array.isArray(team?.team_statistics) ? team.team_statistics[0]?.matches_played : team?.team_statistics?.matches_played) ?? 0

/** Aviso de arranque en frío: el número existe, pero no es una lectura del equipo. */
const warmupOf = (m: MatchRow) => predictionWarmup(playedOf(m.home_team), playedOf(m.away_team))

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
      <div className="flex justify-between text-[11px] mono">
        <span className="text-emerald-400">{h}%</span>
        <span className="text-amber-400">{d}%</span>
        <span className="text-red-400">{a}%</span>
      </div>
    </div>
  )
}

/**
 * Identidad visual del equipo. La agenda mezcla selecciones (bandera por
 * código FIFA) y clubes de liga (escudo): se usa el escudo cuando la fuente
 * lo trae y la bandera cuando no. Ninguno de los dos se inventa.
 */
function TeamMark({ team }: { team: any }) {
  if (team?.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logo_url} alt="" aria-hidden="true" loading="lazy" className="h-4 w-4 shrink-0 object-contain" />
  }
  return <Flag code={team?.code} />
}

/** Ranking FIFA para selecciones, ELO del modelo para clubes. Si no hay
 *  ninguno de los dos, no se muestra nada (antes salía "FIFA #null"). */
function TeamMeta({ team }: { team: any }) {
  if (team?.fifa_ranking != null) {
    return <span className="text-[10px] text-zinc-500">FIFA #{team.fifa_ranking}</span>
  }
  if (team?.elo_rating != null) {
    return <span className="text-[10px] text-zinc-500 mono">ELO {Math.round(team.elo_rating)}</span>
  }
  return null
}

function Stars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < level ? 'text-amber-400' : 'text-zinc-700'} style={{ fontSize: 12 }}>
          ★
        </span>
      ))}
    </div>
  )
}

/**
 * Cabecera de jornada: "Domingo 23 de agosto".
 *
 * Los partidos de varios días llegaban en una lista plana y había que leer
 * la fecha fila a fila para saber dónde acaba un día y empieza el siguiente
 * — especialmente con el filtro "Próximos 7 días". Agrupar es la forma en
 * que se lee un calendario deportivo.
 */
export function diaLargo(iso: string): string {
  const t = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(iso))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Clave de día en zona Bogotá, para comparar filas consecutivas. */
export function claveDia(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso))
}

function StatusBadge({ status, kickoffTime }: { status: string; kickoffTime?: string }) {
  // If DB says "live" but match started >3h ago, it's almost certainly finished
  const effectiveStatus =
    status === 'live' && kickoffTime && Date.now() - new Date(kickoffTime).getTime() > 4.5 * 60 * 60 * 1000
      ? 'finished'
      : status

  const map: Record<string, { label: string; className: string }> = {
    scheduled: { label: 'Programado', className: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
    live:      { label: 'En vivo',    className: 'bg-red-500/10 text-red-400 border-red-500/20' },
    finished:  { label: 'Finalizado', className: 'bg-zinc-800 text-zinc-500 border-zinc-700' },
    postponed: { label: 'Aplazado',   className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  }
  const cfg = map[effectiveStatus] ?? map.scheduled
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border', cfg.className)}>
      {effectiveStatus === 'live' && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
      {cfg.label}
    </span>
  )
}

/** Tarjeta de partido para móvil (playbook Sofascore, mejora 1). Toda la
 *  tarjeta es un enlace al detalle; sin scroll horizontal. */
/** `shiftDays('2026-08-17', 6)` → `'2026-08-23'`. Fecha local, sin husos. */
function shiftDays(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

/** El equipo al que más probabilidad le da el modelo. Empate cuenta como
 *  "resultado favorito" propio, no se le asigna a ninguno de los dos. */
function favoredSide(p: NonNullable<MatchRow['prediction']>, m: MatchRow) {
  if (p.draw_probability >= p.home_win_probability && p.draw_probability >= p.away_win_probability) {
    return { label: 'Empate', prob: p.draw_probability }
  }
  return p.home_win_probability >= p.away_win_probability
    ? { label: m.home_team?.short_name ?? m.home_team?.name ?? 'Local', prob: p.home_win_probability }
    : { label: m.away_team?.short_name ?? m.away_team?.name ?? 'Visitante', prob: p.away_win_probability }
}

function MatchCard({ m, competitionName }: { m: MatchRow; competitionName?: string }) {
  const router = useRouter()
  const p = m.prediction
  const showScore = m.status === 'finished' || m.status === 'live'
  const favored = p ? favoredSide(p, m) : null
  return (
    <li>
      {/* Contenedor (no <a>): la tarjeta entera navega al partido, pero el
          nombre de cada equipo es SU PROPIO enlace al perfil — un <a> no
          puede anidar otro <a>, por eso esto es un div con onClick en vez
          del <Link> que envolvía toda la tarjeta antes. */}
      <div
        role="link"
        tabIndex={0}
        onClick={() => router.push(`/matches/${m.id}`)}
        onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/matches/${m.id}`) }}
        className={cn(
          'group block cursor-pointer rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900 to-zinc-900/40 p-3.5',
          'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-zinc-700 hover:shadow-lg active:translate-y-0 active:scale-[0.99] active:border-zinc-700',
          m.status === 'live' && 'border-red-500/30 bg-red-500/[0.03]',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
            {competitionName && (
              <span className="rounded border border-zinc-700/80 bg-zinc-800/80 px-1.5 py-0.5 font-medium text-zinc-400">
                {competitionName}
              </span>
            )}
            <span className="mono">{formatColDate(m.kickoff_time)} · {formatColTime(m.kickoff_time)}</span>
          </span>
          <StatusBadge status={m.status} kickoffTime={m.kickoff_time} />
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <Link
            href={`/equipos/${m.home_team_id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex min-w-0 items-center gap-2 text-sm font-bold text-zinc-100 active:opacity-60"
          >
            <TeamMark team={m.home_team} />
            <span className="truncate hover:underline">{m.home_team?.short_name ?? m.home_team?.name ?? m.home_team?.code}</span>
          </Link>
          {showScore ? (
            <span className="mono shrink-0 text-lg font-black text-white">{m.home_score ?? '—'}<span className="mx-1 text-zinc-600">–</span>{m.away_score ?? '—'}</span>
          ) : (
            <span className="shrink-0 text-xs font-bold text-zinc-600">VS</span>
          )}
          <Link
            href={`/equipos/${m.away_team_id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex min-w-0 items-center justify-end gap-2 text-sm font-bold text-zinc-100 active:opacity-60"
          >
            <span className="truncate hover:underline">{m.away_team?.short_name ?? m.away_team?.name ?? m.away_team?.code}</span>
            <TeamMark team={m.away_team} />
          </Link>
        </div>

        {p && favored ? (
          <>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Predicción del modelo
            </p>
            <ProbBar1X2 className="mt-1.5" home={p.home_win_probability} draw={p.draw_probability} away={p.away_win_probability}
              variant="full"
              homeLabel={m.home_team?.code ?? m.home_team?.short_name}
              awayLabel={m.away_team?.code ?? m.away_team?.short_name} />
            <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-zinc-400">
                Favorito: <span className="font-semibold text-zinc-200">{favored.label}</span>
                <span className="mono text-zinc-500"> · {Math.round(favored.prob * 100)}%</span>
              </span>
              <span className="text-zinc-500">
                est. <span className="mono font-bold text-zinc-300">{p.predicted_home_score}–{p.predicted_away_score}</span>
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                  p.confidence_level >= 4 ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                    : p.confidence_level === 3 ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
                    : 'border-zinc-700 bg-zinc-800/80 text-zinc-400',
                )}
              >
                Confianza {getConfidenceLabel(p.confidence_level).toLowerCase()}
              </span>
              <span className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < p.confidence_level ? 'text-amber-400' : 'text-zinc-700'} style={{ fontSize: 11 }}>★</span>
                ))}
                <span className="mono text-zinc-500">{p.confidence_score.toFixed(0)}%</span>
              </span>
            </div>
          </>
        ) : (
          <p className="mt-2.5 text-[11px] text-zinc-600">Sin análisis del modelo aún</p>
        )}

        {p && coldStartNote(warmupOf(m)) && (
          <p className="mt-2 border-t border-zinc-800/80 pt-2 text-[10px] leading-snug text-amber-400/80">
            {coldStartNote(warmupOf(m))}
          </p>
        )}
      </div>
    </li>
  )
}

// ─── Column definitions ───────────────────────────────────────

function buildColumns(competitionNames: Map<string, string>): ColumnDef<MatchRow, any>[] {
  return [
    col.display({
      id: 'competition',
      header: 'Liga',
      cell: ({ row }) => {
        const name = competitionNames.get(row.original.competition_id)
        if (!name) return null
        return (
          <span className="inline-block whitespace-nowrap rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            {name}
          </span>
        )
      },
      size: 110,
    }),
    col.accessor('kickoff_time', {
      header: 'Fecha',
      cell: (info) => (
        <div className="whitespace-nowrap">
          <p className="text-xs font-medium text-zinc-200">
            {formatColDate(info.getValue())}
          </p>
          <p className="text-[10px] text-zinc-500 mono">
            {formatColTime(info.getValue())} COL
          </p>
        </div>
      ),
      size: 80,
    }),
    col.accessor('status', {
      header: 'Estado',
      cell: (info) => <StatusBadge status={info.getValue()} kickoffTime={info.row.original.kickoff_time} />,
      size: 100,
    }),
    col.display({
      id: 'home_team',
      header: 'Local',
      cell: ({ row }) => {
        const m = row.original
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            {/* stopPropagation: la fila entera navega al partido (onClick del
                <tr>); el nombre navega al equipo y no debe disparar los dos. */}
            <Link
              href={`/equipos/${m.home_team_id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 hover:underline"
            >
              <TeamMark team={m.home_team} />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-100">
                  {m.home_team?.short_name ?? m.home_team?.name ?? m.home_team?.code}
                </span>
                <TeamMeta team={m.home_team} />
              </div>
            </Link>
            {m.status === 'finished' || m.status === 'live' ? (
              <span className="mono text-sm font-bold text-white">{m.home_score ?? '—'}</span>
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
              <span className="mono text-sm font-bold text-white">{m.away_score ?? '—'}</span>
            ) : null}
            <Link
              href={`/equipos/${m.away_team_id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 hover:underline"
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-100">
                  {m.away_team?.short_name ?? m.away_team?.name ?? m.away_team?.code}
                </span>
                <TeamMeta team={m.away_team} />
              </div>
              <TeamMark team={m.away_team} />
            </Link>
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
        const badge = coldStartBadge(warmupOf(row.original))
        return (
          <div className="space-y-1">
            <ProbBar
              home={p.home_win_probability}
              draw={p.draw_probability}
              away={p.away_win_probability}
            />
            {badge && (
              <span
                title={coldStartNote(warmupOf(row.original)) ?? undefined}
                className="inline-block rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
              >
                {badge}
              </span>
            )}
          </div>
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

export function MatchesTable({
  defaultDate,
  competitions = [],
}: { defaultDate?: string; competitions?: { id: string; name: string }[] } = {}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'kickoff_time', desc: false },
  ])
  const [pageIndex, setPageIndex] = useState(0)
  const PAGE_SIZE = 15

  // Por defecto muestra la fecha inteligente del servidor: hoy si hay
  // partidos, o la próxima fecha con actividad (Q2 — nunca abre vacía)
  const todayStr  = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local
  const dateParam = searchParams.get('date') ?? defaultDate ?? todayStr
  const rangeParam = searchParams.get('range') // '7d' → ventana desde hoy, ignora dateParam
  // Convertir a ISO UTC para que Supabase filtre correctamente según zona horaria del usuario
  const date_from = rangeParam === '7d'
    ? new Date(`${todayStr}T00:00:00`).toISOString()
    : new Date(`${dateParam}T00:00:00`).toISOString()
  const date_to = rangeParam === '7d'
    ? new Date(`${shiftDays(todayStr, 6)}T23:59:59`).toISOString()
    : new Date(`${dateParam}T23:59:59`).toISOString()

  const filters = {
    search: searchParams.get('q') ?? undefined,
    status: searchParams.get('status') ? [searchParams.get('status') as 'scheduled' | 'live' | 'finished' | 'postponed'] : undefined,
    competition_id: searchParams.get('competition') ?? undefined,
    team_id: searchParams.get('team') ?? undefined,
    min_confidence: searchParams.get('confidence')
      ? parseInt(searchParams.get('confidence')!)
      : undefined,
    date_from,
    date_to,
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['matches', filters, dateParam, rangeParam, pageIndex],
    queryFn: () => matchesService.getMatchesWithPredictions(filters, pageIndex + 1, PAGE_SIZE),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const competitionNames = useMemo(
    () => new Map(competitions.map((c) => [c.id, c.name])),
    [competitions],
  )
  const columns = useMemo(() => buildColumns(competitionNames), [competitionNames])

  // Mensaje de "sin resultados" contextual: deja claro que el filtro SÍ se
  // aplicó y por qué está vacío (ej. no hay partidos en vivo ahora mismo),
  // en vez de un genérico que parece un error.
  const activeStatus = filters.status?.[0]
  const hasOtherFilters = Boolean(
    filters.search || filters.competition_id || filters.team_id || filters.min_confidence
  )
  const isToday = !rangeParam && dateParam === todayStr
  const emptyMessage =
    hasOtherFilters
      ? 'No hay partidos que coincidan con los filtros actuales.'
      : activeStatus === 'live'
        ? 'No hay partidos en vivo en este momento.'
        : activeStatus === 'finished'
          ? 'No hay partidos finalizados en esta fecha.'
          : rangeParam === '7d'
            ? 'No hay partidos programados en los próximos 7 días.'
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

  // La agrupación por jornada solo tiene sentido con la tabla ordenada por
  // fecha, que es el orden por defecto. Ordenada por confianza o por liga,
  // una cabecera de día sería falsa.
  const agrupaPorDia = sorting.length === 0 || sorting[0]?.id === 'kickoff_time'

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
          {(filters.search || filters.status || filters.competition_id || filters.team_id || filters.min_confidence) && ' (filtrado)'}
        </p>
        <p className="text-[10px] text-zinc-600">
          Página {pageIndex + 1} de {data?.total_pages ?? 1}
        </p>
      </div>

      {/* ── MÓVIL: tarjetas (sin scroll horizontal) ── */}
      <ul className="flex flex-col gap-2.5 p-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <li key={i}><div className="h-28 animate-pulse rounded-2xl border border-zinc-800/80 bg-zinc-900" /></li>
          ))
        ) : (data?.data ?? []).length === 0 ? (
          <li className="rounded-2xl border border-zinc-800/80 bg-zinc-900 px-4 py-12 text-center"><p className="mx-auto max-w-md text-sm text-zinc-400">{emptyMessage}</p></li>
        ) : (
          (data?.data ?? []).map((m, i, filas) => {
            const row = m as MatchRow
            const nuevoDia = i === 0 ||
              claveDia((filas[i - 1] as MatchRow).kickoff_time) !== claveDia(row.kickoff_time)
            return (
              <Fragment key={row.id}>
                {nuevoDia && (
                  <li className="px-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {diaLargo(row.kickoff_time)}
                  </li>
                )}
                <MatchCard m={row} competitionName={competitionNames.get(row.competition_id)} />
              </Fragment>
            )
          })
        )}
      </ul>

      {/* ── DESKTOP: tabla ── */}
      <div className="hidden overflow-x-auto md:block">
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
              : table.getRowModel().rows.map((row, i, filas) => (
                  <Fragment key={row.id}>
                  {/* Solo cuando la tabla está ordenada POR FECHA: con otro
                      criterio (confianza, liga…) una cabecera de jornada
                      mentiría, porque las filas ya no van por días. */}
                  {agrupaPorDia && (
                    i === 0 ||
                    claveDia(filas[i - 1].original.kickoff_time) !== claveDia(row.original.kickoff_time)
                  ) && (
                    <tr className="bg-zinc-950/70">
                      <td colSpan={row.getVisibleCells().length} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                        {diaLargo(row.original.kickoff_time)}
                      </td>
                    </tr>
                  )}
                  <tr
                    onClick={() => router.push(`/matches/${row.original.id}`)}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-zinc-800/60',
                      row.original.status === 'live' && 'bg-red-500/5 hover:bg-red-500/10'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  </Fragment>
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
          {(data?.count ?? 0) === 0
            ? '0 resultados'
            : `Mostrando ${pageIndex * PAGE_SIZE + 1}–${Math.min((pageIndex + 1) * PAGE_SIZE, data?.count ?? 0)} de ${data?.count ?? 0}`}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pageIndex === 0}
            aria-label="Página anterior"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {(() => {
            // Ventana de 5 páginas centrada en la actual: siempre se puede
            // navegar a cualquier página, no solo a las primeras 5
            const total = data?.total_pages ?? 1
            const windowSize = Math.min(total, 5)
            const start = Math.max(0, Math.min(pageIndex - 2, total - windowSize))
            return Array.from({ length: windowSize }).map((_, idx) => {
              const i = start + idx
              return (
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
              )
            })
          })()}

          <button
            onClick={() => setPageIndex((p) => Math.min((data?.total_pages ?? 1) - 1, p + 1))}
            disabled={pageIndex >= (data?.total_pages ?? 1) - 1}
            aria-label="Página siguiente"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
