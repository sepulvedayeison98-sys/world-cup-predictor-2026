import { isoForCode } from '@/lib/flags'
import { cn } from '@/lib/utils'

/**
 * Bandera nacional de un equipo a partir de su código FIFA (`teams.code`).
 * Usa flagcdn.com. Si no hay mapeo, no renderiza nada (degradación elegante).
 *
 * Es <img> plano (no next/image) a propósito: en tablas se pintan muchas
 * banderas pequeñas y la optimización de next/image sería un sobrecosto.
 */
export function Flag({
  code,
  className,
}: {
  code?: string | null
  className?: string
}) {
  const iso = isoForCode(code)
  if (!iso) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/h20/${iso}.png`}
      srcSet={`https://flagcdn.com/h40/${iso}.png 2x`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={cn('inline-block h-3.5 w-5 shrink-0 rounded-[2px] object-cover', className)}
    />
  )
}
