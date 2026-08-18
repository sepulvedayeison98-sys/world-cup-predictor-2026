'use client'

import { createContext, useContext, useState } from 'react'

/**
 * Tamaño del BottomNav flotante: amplio por defecto, se contrae al cruzar
 * el umbral de scroll hacia abajo y vuelve a su tamaño normal al cruzarlo
 * de nuevo hacia arriba (MainScrollArea llama a collapse()/expand()), o al
 * instante si se toca uno de sus botones (BottomNav llama a expand()).
 */
type BottomNavState = { expanded: boolean; collapse: () => void; expand: () => void }

const BottomNavCtx = createContext<BottomNavState>({
  expanded: true,
  collapse: () => {},
  expand: () => {},
})

export function BottomNavProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <BottomNavCtx.Provider
      value={{ expanded, collapse: () => setExpanded(false), expand: () => setExpanded(true) }}
    >
      {children}
    </BottomNavCtx.Provider>
  )
}

export const useBottomNavState = () => useContext(BottomNavCtx)
