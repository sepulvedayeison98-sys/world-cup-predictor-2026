'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, TrendingUp, Zap, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMobileNav } from '@/components/layout/MobileNavContext'

/**
 * Navegación inferior móvil (playbook Sofascore, mejora 6; F-nav: píldora
 * flotante). Solo <lg: en desktop manda el sidebar. Cinco destinos de
 * máximo uso; "Más" abre el drawer del sidebar (donde viven competiciones,
 * inteligencia y ajustes). La navegación raíz sigue CONGELADA: esto es un
 * atajo a rutas existentes, no ítems nuevos.
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
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      className="fixed inset-x-3 z-40 flex items-center gap-0.5 rounded-full border border-zinc-800 bg-zinc-900/90 p-1.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)] backdrop-blur-xl lg:hidden"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[10px] font-medium transition-colors',
              active ? 'bg-emerald-500/15 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300',
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
        className="flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <Menu className="h-5 w-5" />
        <span>Más</span>
      </button>
    </nav>
  )
}
