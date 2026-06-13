'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Users,
  User,
  TrendingUp,
  Zap,
  Grid3X3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Trophy,
  FlaskConical,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/matches',      label: 'Partidos',      icon: Calendar },
  { href: '/groups',       label: 'Grupos',        icon: Grid3X3 },
  { href: '/predictions',  label: 'Predicciones',  icon: TrendingUp },
  { href: '/value-bets',   label: 'Apuestas Valor', icon: Zap },
  { href: '/simulation',   label: 'Simulador',      icon: FlaskConical },
  { href: '/teams',        label: 'Equipos',       icon: Users },
  { href: '/players',      label: 'Jugadores',     icon: User },
  { href: '/settings',     label: 'Información', icon: Settings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-zinc-900 border-r border-zinc-800',
        'transition-all duration-300 ease-in-out shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30">
            <Trophy className="h-4 w-4 text-emerald-400" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">WC Predictor</p>
              <p className="text-[10px] text-zinc-500 truncate">FIFA 2026</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'nav-item',
                    isActive && 'nav-item-active',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Model status indicator */}
      {!collapsed && (
        <div className="mx-2 mb-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <div className="flex items-center gap-2">
            <div className="live-dot" />
            <p className="text-xs font-medium text-zinc-300">Motor activo</p>
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">Modelo v1.0.0 · WC2026</p>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          'absolute -right-3 top-[52px] z-10',
          'flex h-6 w-6 items-center justify-center rounded-full',
          'border border-zinc-700 bg-zinc-900 text-zinc-400',
          'hover:border-zinc-600 hover:text-zinc-200 transition-colors'
        )}
        aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  )
}
