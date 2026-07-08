'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  TrendingUp,
  Zap,
  Settings,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Globe,
  BrainCircuit,
  Activity,
  Dribbble,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MODEL_VERSION } from '@/lib/constants'
import { ACTIVE_COMPETITIONS, COMPETITIONS_NAV } from '@/lib/sports'
import { useMobileNav } from '@/components/layout/MobileNavContext'

/**
 * Navegación raíz CONGELADA (auditoría F2/F5): las competiciones nuevas
 * entran al registro lib/sports.ts, nunca como ítems raíz nuevos.
 */
const ANALYSIS_ITEMS = [
  { href: '/matches',     label: 'Partidos',      icon: Calendar },
  { href: '/predictions', label: 'Predicciones',  icon: TrendingUp },
  { href: '/value-bets',  label: 'Smart Bets',    icon: Zap },
  { href: '/inteligencia', label: 'Inteligencia', icon: BrainCircuit },
]

const UPCOMING = COMPETITIONS_NAV.filter((c) => c.status === 'proximamente')

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  return (
    <p className={cn(
      'px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600',
      collapsed && 'lg:hidden',
    )}>
      {children}
    </p>
  )
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false) // solo escritorio (lg+)
  const pathname = usePathname()
  const { open, setOpen } = useMobileNav()

  // Cerrar el drawer al navegar (movil)
  useEffect(() => {
    setOpen(false)
  }, [pathname, setOpen])

  const navItem = (href: string, label: string, Icon: any, active: boolean) => (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={() => setOpen(false)}
      className={cn('nav-item', active && 'nav-item-active', collapsed && 'lg:justify-center lg:px-2')}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn('truncate', collapsed && 'lg:hidden')}>{label}</span>
    </Link>
  )

  return (
    <>
      {/* Overlay (solo movil, cuando el drawer esta abierto) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'flex flex-col bg-zinc-900 border-r border-zinc-800',
          'fixed inset-y-0 left-0 z-50 w-60 transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:static lg:z-auto lg:shrink-0 lg:translate-x-0 lg:transition-all',
          collapsed ? 'lg:w-16' : 'lg:w-60'
        )}
      >
        {/* Marca neutra (auditoría T2): la casa es de inteligencia
            deportiva; el Mundial es su primera competición, no su nombre. */}
        <div className="flex items-center h-14 px-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30">
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <div className={cn('min-w-0', collapsed && 'lg:hidden')}>
              <p className="text-sm font-bold text-white truncate">Veredicto</p>
              <p className="text-[10px] text-zinc-500 truncate">Inteligencia Deportiva</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <ul className="flex flex-col gap-0.5">
            <li>{navItem('/dashboard', 'Inicio', LayoutDashboard, pathname === '/dashboard' || pathname === '/')}</li>
          </ul>

          <SectionLabel collapsed={collapsed}>Competiciones</SectionLabel>
          <ul className="flex flex-col gap-0.5">
            {ACTIVE_COMPETITIONS.map((c) => {
              const Icon = c.sport === 'baloncesto' ? Dribbble : c.slug === 'mundial-2026' ? Trophy : Globe
              const active = pathname === c.href || pathname.startsWith(c.href + '/')
              return <li key={c.slug}>{navItem(c.href, c.name, Icon, active)}</li>
            })}
          </ul>
          {UPCOMING.length > 0 && (
            <p className={cn('px-3 pt-1.5 text-[10px] leading-relaxed text-zinc-600', collapsed && 'lg:hidden')}>
              Pronto: {UPCOMING.map((c) => c.name).join(' · ')}
            </p>
          )}

          <SectionLabel collapsed={collapsed}>Análisis</SectionLabel>
          <ul className="flex flex-col gap-0.5">
            {ANALYSIS_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return <li key={href}>{navItem(href, label, Icon, active)}</li>
            })}
          </ul>

          <div className="mt-4 border-t border-zinc-800 pt-2">
            <ul className="flex flex-col gap-0.5">
              <li>{navItem('/settings', 'Configuración', Settings, pathname.startsWith('/settings'))}</li>
            </ul>
          </div>
        </nav>

        {/* Model status indicator */}
        <div
          className={cn(
            'mx-2 mb-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3',
            collapsed && 'lg:hidden'
          )}
        >
          <div className="flex items-center gap-2">
            <div className="live-dot" />
            <p className="text-xs font-medium text-zinc-300">Motor activo</p>
          </div>
          {/* Q1: versión desde la fuente única — nunca más desincronizada */}
          <p className="mt-1 text-[10px] text-zinc-500">Modelo v{MODEL_VERSION}</p>
        </div>

        {/* Collapse toggle (solo escritorio) */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'absolute -right-3 top-[52px] z-10',
            'hidden lg:flex h-6 w-6 items-center justify-center rounded-full',
            'border border-zinc-700 bg-zinc-900 text-zinc-400',
            'hover:border-zinc-600 hover:text-zinc-200 transition-colors'
          )}
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>
    </>
  )
}
