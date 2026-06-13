'use client'

import { Bell, Search, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/matches':     'Partidos',
  '/groups':      'Grupos',
  '/predictions': 'Predicciones',
  '/value-bets':  'Apuestas de Valor',
  '/teams':       'Equipos',
  '/players':     'Jugadores',
  '/settings':    'Configuración',
}

export function Topbar() {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()

  const label = Object.entries(ROUTE_LABELS).find(([key]) =>
    pathname.startsWith(key)
  )?.[1] ?? ''

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 backdrop-blur-sm">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">FIFA WC 2026</span>
        {label && (
          <>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-medium text-zinc-300">{label}</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          aria-label="Buscar"
        >
          <Search className="h-4 w-4" />
        </button>

        <button
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs font-bold text-emerald-400">
          A
        </div>
      </div>
    </header>
  )
}
