'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isFavorite, toggleFavorite, FAVORITES_EVENT, type FavoriteTeam } from '@/lib/favorites'

/**
 * Estrella de favorito (playbook Sofascore, QW3). Marca/desmarca un equipo
 * en localStorage. Renderiza neutro en SSR y se hidrata con el estado real.
 */
export function FavoriteStar({ team, className }: { team: FavoriteTeam; className?: string }) {
  const [fav, setFav] = useState(false)

  useEffect(() => {
    const sync = () => setFav(isFavorite(team.id))
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [team.id])

  return (
    <button
      onClick={() => setFav(toggleFavorite(team))}
      aria-label={fav ? `Quitar ${team.name} de mis equipos` : `Seguir a ${team.name}`}
      aria-pressed={fav}
      title={fav ? 'Quitar de mis equipos' : 'Seguir equipo'}
      className={cn(
        'rounded p-1 transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-emerald-500',
        className,
      )}
    >
      <Star className={cn('h-4 w-4', fav ? 'fill-amber-400 text-amber-400' : 'text-zinc-600 hover:text-zinc-400')} />
    </button>
  )
}
