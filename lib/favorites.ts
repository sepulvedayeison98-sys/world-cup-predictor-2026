/**
 * Favoritos sin autenticación (playbook Sofascore, QW3).
 *
 * La app es pública y sin cuentas: los equipos favoritos viven en
 * localStorage del navegador. Es la etapa 1 del bucle de retención
 * (favoritos → franja "Mis equipos"); la etapa 2 (Web Push) requerirá
 * backend y es decisión aparte.
 *
 * Solo usable desde componentes cliente ('use client').
 */

export interface FavoriteTeam {
  id: string
  name: string
  code?: string | null
}

const KEY = 'veredicto:favoritos'
/** Evento propio para que los componentes reaccionen a cambios en la misma pestaña */
export const FAVORITES_EVENT = 'veredicto:favoritos-cambiaron'

export function getFavorites(): FavoriteTeam[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((t) => t && typeof t.id === 'string') : []
  } catch {
    return []
  }
}

export function isFavorite(teamId: string): boolean {
  return getFavorites().some((t) => t.id === teamId)
}

export function toggleFavorite(team: FavoriteTeam): boolean {
  const current = getFavorites()
  const exists = current.some((t) => t.id === team.id)
  const next = exists ? current.filter((t) => t.id !== team.id) : [...current, team]
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent(FAVORITES_EVENT))
  } catch {
    // almacenamiento lleno o bloqueado: se ignora silenciosamente
  }
  return !exists
}
