import { PageSkeleton, HeaderSkeleton, StatsRowSkeleton, TableSkeleton } from '@/components/tennis/Skeletons'

/** Carga del hub de tenis: refleja cabecera + KPIs + secciones + dos columnas. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <StatsRowSkeleton />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[68px] rounded-xl border border-zinc-800 bg-zinc-900" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TableSkeleton rows={8} />
        <TableSkeleton rows={8} />
      </div>
    </PageSkeleton>
  )
}
