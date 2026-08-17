'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Fila de partido navegable, con un enlace independiente anidado dentro
 * (el nombre del rival → su perfil de equipo). Un `<a>` no puede contener
 * otro `<a>`, así que la fila es un `<div>` con navegación por clic/teclado
 * en vez del `<Link>` que la envolvía antes; el enlace del rival detiene la
 * propagación para no disparar los dos destinos a la vez.
 *
 * Reutilizado por el perfil de equipo (recientes y próximos) — mismo patrón
 * que ya usan MatchesTable y JornadaCalendar.
 */
export function ClickableMatchRow({
  matchId,
  className,
  children,
}: {
  matchId: string
  className?: string
  children: ReactNode
}) {
  const router = useRouter()
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/matches/${matchId}`)}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/matches/${matchId}`) }}
      className={cn('cursor-pointer', className)}
    >
      {children}
    </div>
  )
}

/** El nombre/escudo del rival, como enlace independiente a su perfil. */
export function OpponentLink({
  teamId,
  className,
  children,
}: {
  teamId?: string | null
  className?: string
  children: ReactNode
}) {
  if (!teamId) return <span className={className}>{children}</span>
  return (
    <Link href={`/equipos/${teamId}`} onClick={(e) => e.stopPropagation()} className={cn('active:opacity-60', className)}>
      {children}
    </Link>
  )
}
