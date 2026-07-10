'use client'

import { useState } from 'react'
import { Search, Menu } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useMobileNav } from '@/components/layout/MobileNavContext'
import { GlobalSearch } from '@/components/search/GlobalSearch'
import { LEAGUE_NAMES } from '@/lib/constants'

/**
 * Breadcrumb contextual (auditoría C1): el contexto lo define la ruta,
 * nunca una marca de torneo fija. Una página de la Premier vive en
 * "Competiciones / Premier League", no dentro de "FIFA WC 2026".
 */
function breadcrumbOf(pathname: string): [string, string] | [string] {
  if (pathname === '/' || pathname.startsWith('/dashboard')) return ['Inicio']
  if (pathname.startsWith('/mundial')) return ['Competiciones', 'Mundial 2026']
  if (pathname.startsWith('/ligas/')) {
    const slug = pathname.split('/')[2]
    return ['Competiciones', LEAGUE_NAMES[slug] ?? 'Liga']
  }
  if (pathname.startsWith('/ligas')) return ['Competiciones', 'Ligas']
  if (pathname.startsWith('/nba')) return ['Competiciones', 'NBA']
  // Secciones del Mundial que conservan sus rutas (compatibilidad)
  if (pathname.startsWith('/champion')) return ['Mundial 2026', 'Campeón']
  if (pathname.startsWith('/bracket')) return ['Mundial 2026', 'Eliminatorias']
  if (pathname.startsWith('/groups')) return ['Mundial 2026', 'Grupos']
  if (pathname.startsWith('/scorers')) return ['Mundial 2026', 'Goleadores']
  if (pathname.startsWith('/players')) return ['Mundial 2026', 'Jugadores']
  if (pathname.startsWith('/simulation')) return ['Mundial 2026', 'Simulador']
  if (pathname.startsWith('/matches')) return ['Análisis', 'Partidos']
  if (pathname.startsWith('/predictions')) return ['Análisis', 'Predicciones']
  if (pathname.startsWith('/value-bets')) return ['Análisis', 'Smart Bets']
  if (pathname.startsWith('/inteligencia')) return ['Análisis', 'Inteligencia']
  if (pathname.startsWith('/settings')) return ['Configuración']
  if (pathname.startsWith('/admin')) return ['Administración']
  return ['Veredicto']
}

export function Topbar() {
  const pathname = usePathname()
  const { setOpen } = useMobileNav()
  const [searchOpen, setSearchOpen] = useState(false)
  const crumb = breadcrumbOf(pathname)

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 backdrop-blur-sm">
      {/* Hamburguesa (movil) + breadcrumb contextual */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 -ml-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="truncate text-xs text-zinc-500">{crumb[0]}</span>
        {crumb[1] && (
          <>
            <span className="text-zinc-700">/</span>
            <span className="truncate text-xs font-medium text-zinc-300">{crumb[1]}</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Q7 + limpieza F1: campana, toggle de tema y avatar retirados — no
            hay notificaciones, modo claro ni cuentas de usuario detrás (la app
            es pública sin auth). Un avatar "A" fijo solo simulaba una sesión
            inexistente. El producto es solo-oscuro por identidad (terminal
            financiera); Buscar es la única acción real del topbar. */}
        <button
          onClick={() => setSearchOpen(true)}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors focus-visible:outline focus-visible:outline-emerald-500"
          aria-label="Buscar equipo o competición"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
