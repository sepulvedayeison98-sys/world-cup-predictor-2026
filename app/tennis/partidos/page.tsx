import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchTennisResults } from '@/services/tennis/queries'
import { ResultsList } from '@/components/tennis/ResultsList'
import { SURFACE_LABELS, type Surface } from '@/lib/tennis/constants'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Resultados ATP | Veredicto',
  description: 'Navegador de resultados reales del circuito ATP, filtrable por superficie.',
}

export const revalidate = 600

const PAGE = 40
const FILTERS: { key: string | null; label: string }[] = [
  { key: null, label: 'Todas' },
  ...(Object.keys(SURFACE_LABELS) as Surface[]).map((s) => ({ key: s, label: SURFACE_LABELS[s] })),
]

export default async function TennisResultsPage({
  searchParams,
}: { searchParams: Promise<{ surface?: string; offset?: string }> }) {
  const sp = await searchParams
  const surface = sp.surface ?? null
  const offset = Math.max(0, parseInt(sp.offset ?? '0', 10) || 0)
  const { rows, hasMore } = await fetchTennisResults({ surface, limit: PAGE, offset })

  const qs = (o: number) => {
    const p = new URLSearchParams()
    if (surface) p.set('surface', surface)
    if (o > 0) p.set('offset', String(o))
    const s = p.toString()
    return s ? `/tennis/partidos?${s}` : '/tennis/partidos'
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href="/tennis" className="text-xs font-semibold uppercase tracking-widest text-lime-500 hover:text-lime-400">← Tenis</Link>
        <h1 className="mt-1 text-2xl font-bold text-white">Resultados ATP</h1>
        <p className="text-sm text-zinc-400">
          Partidos reales del circuito, del más reciente al más antiguo. La
          fuente es histórica (no hay calendario de próximos encuentros), así
          que aquí solo hay resultados verificables.
        </p>
      </div>

      {/* Filtro por superficie */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (f.key ?? null) === surface
          const p = new URLSearchParams()
          if (f.key) p.set('surface', f.key)
          const href = p.toString() ? `/tennis/partidos?${p.toString()}` : '/tennis/partidos'
          return (
            <Link key={f.label} href={href}
              className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                active ? 'border-lime-500/40 bg-lime-500/15 text-lime-300' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700')}>
              {f.label}
            </Link>
          )
        })}
      </div>

      <ResultsList rows={rows} />

      {/* Paginación por offset */}
      <div className="flex items-center justify-between">
        {offset > 0 ? (
          <Link href={qs(Math.max(0, offset - PAGE))} className="text-sm text-lime-500 hover:text-lime-400">← más recientes</Link>
        ) : <span />}
        {hasMore ? (
          <Link href={qs(offset + PAGE)} className="text-sm text-lime-500 hover:text-lime-400">más antiguos →</Link>
        ) : <span />}
      </div>

      <p className="text-[11px] text-zinc-600">
        Fuente: TML-Database (esquema Sackmann, CC BY-NC-SA). Los walkover no se
        listan (no hubo tenis jugado).
      </p>
    </div>
  )
}
