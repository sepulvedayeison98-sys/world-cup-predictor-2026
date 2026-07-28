import { PageSkeleton, HeaderSkeleton, StatsRowSkeleton, TableSkeleton } from '@/components/tennis/Skeletons'

/** Carga del perfil de jugador: cabecera + métricas + dos columnas. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <StatsRowSkeleton />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-56 rounded-xl border border-zinc-800 bg-zinc-900" />
        <TableSkeleton rows={6} />
      </div>
    </PageSkeleton>
  )
}
