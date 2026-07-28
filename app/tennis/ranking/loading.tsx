import { PageSkeleton, HeaderSkeleton, TableSkeleton } from '@/components/tennis/Skeletons'

/** Carga del ranking completo (500+ filas): cabecera + tabla larga. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <TableSkeleton rows={14} />
    </PageSkeleton>
  )
}
