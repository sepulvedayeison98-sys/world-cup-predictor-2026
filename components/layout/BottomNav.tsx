'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, TrendingUp, Zap, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMobileNav } from '@/components/layout/MobileNavContext'
import { useBottomNavState } from '@/components/layout/BottomNavContext'

/** Curva de la transición amplia → compacta. */
const EASE = 'cubic-bezier(.32,.72,0,1)'

/**
 * Navegación inferior móvil (playbook Sofascore, mejora 6; F-nav: píldora
 * flotante). Solo <lg: en desktop manda el sidebar. Cinco destinos de
 * máximo uso; "Más" abre el drawer del sidebar (donde viven competiciones,
 * inteligencia y ajustes). La navegación raíz sigue CONGELADA: esto es un
 * atajo a rutas existentes, no ítems nuevos.
 *
 * Tamaño: amplia por defecto (con etiquetas), se contrae a solo íconos
 * al bajar y vuelve a su tamaño normal al volver arriba (o al tocar
 * alguno de sus botones) — estado en BottomNavContext.
 */
const ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/matches', label: 'Partidos', icon: Calendar },
  { href: '/predictions', label: 'Predice', icon: TrendingUp },
  { href: '/value-bets', label: 'Smart Bets', icon: Zap },
]

export function BottomNav() {
  const pathname = usePathname()
  const { setOpen } = useMobileNav()
  const { expanded, expand } = useBottomNavState()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const itemCls = (active: boolean) =>
    cn(
      'flex flex-col items-center rounded-full text-[10px] font-medium transition-all duration-500',
      expanded ? 'flex-1 gap-0.5 py-2.5' : 'gap-0 p-2.5',
      active ? 'bg-emerald-500/15 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300',
    )

  return (
    <nav
      aria-label="Navegación inferior"
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))', transitionTimingFunction: EASE }}
      className={cn(
        'fixed z-40 flex items-center rounded-full border border-zinc-800 bg-zinc-900/90 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)] backdrop-blur-xl transition-all duration-500 lg:hidden',
        expanded ? 'inset-x-3 gap-0.5 p-1.5' : 'left-1/2 w-auto -translate-x-1/2 gap-1 p-1',
      )}
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            onClick={expand}
            className={itemCls(active)}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className={cn('truncate', !expanded && 'sr-only')}>{label}</span>
          </Link>
        )
      })}
      <button
        onClick={() => {
          setOpen(true)
          expand()
        }}
        aria-label="Más secciones"
        className={itemCls(false)}
      >
        <Menu className="h-5 w-5 shrink-0" />
        <span className={cn('truncate', !expanded && 'sr-only')}>Más</span>
      </button>
    </nav>
  )
}
