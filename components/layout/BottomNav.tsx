'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, TrendingUp, Zap, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMobileNav } from '@/components/layout/MobileNavContext'

/**
 * Navegación inferior móvil (playbook Sofascore, mejora 6). Solo <lg:
 * en desktop manda el sidebar. Cinco destinos de máximo uso; "Más" abre el
 * drawer del sidebar (donde viven competiciones, inteligencia y ajustes).
 * La navegación raíz sigue CONGELADA: esto es un atajo a rutas existentes,
 * no ítems nuevos.
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <nav
      aria-label="Navegación inferior"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              active ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">{label}</span>
          </Link>
        )
      })}
      <button
        onClick={() => setOpen(true)}
        aria-label="Más secciones"
        className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <Menu className="h-5 w-5" />
        <span>Más</span>
      </button>
    </nav>
  )
}
