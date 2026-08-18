import { Globe, Dribbble, CircleDot } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CompetitionEntry, SportSlug } from '@/lib/sports'

/**
 * Escudo de una competición, con su icono como respaldo.
 *
 * ── Por qué el escudo va sobre una pastilla clara ────────────────────────
 * No es decoración. Los escudos oficiales vienen en PNG transparente con la
 * paleta de cada liga, y varias de esas paletas son oscuras: el de la Ligue 1
 * es **negro puro** y sobre el `bg-zinc-900` de la barra lateral desaparece
 * por completo; el de la Premier es morado muy oscuro y el de la Serie A
 * lleva texto azul marino incrustado. Pintarlos «tal cual» sobre el tema
 * oscuro deja tres competiciones sin icono visible.
 *
 * La pastilla clara resuelve las ocho de una vez sin retocar ninguna imagen
 * —recolorearlas sería alterar una marca ajena— y es lo que hacen Sofascore
 * y FotMob por el mismo motivo.
 *
 * ── Por qué `<img>` y no `next/image` ────────────────────────────────────
 * Son PNG locales de tamaño fijo que se pintan a 16-20 px. `next/image`
 * añadiría trabajo de optimización y un wrapper por cada icono de la
 * navegación sin ganar nada medible.
 */

const SPORT_ICON: Record<SportSlug, typeof Globe> = {
  futbol: Globe,
  baloncesto: Dribbble,
  tenis: CircleDot,
}

export interface CompetitionLogoProps {
  competition: Pick<CompetitionEntry, 'name' | 'sport' | 'logo'>
  /** Lado del cuadro, en píxeles. 20 en la barra lateral, 16 en listas. */
  size?: number
  className?: string
}

export function CompetitionLogo({ competition, size = 20, className }: CompetitionLogoProps) {
  const Icon = SPORT_ICON[competition.sport] ?? Globe

  if (!competition.logo) {
    return (
      <Icon
        className={cn('shrink-0 text-zinc-500', className)}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    )
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-white/90',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={competition.logo}
        // Decorativo: el nombre de la competición ya va como texto al lado,
        // así que repetirlo aquí solo haría que el lector de pantalla lo
        // dijese dos veces.
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="object-contain"
        style={{ width: size - 4, height: size - 4 }}
      />
    </span>
  )
}
