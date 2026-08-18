'use client'

import { createContext, useContext, useState } from 'react'

/**
 * Tamaño del BottomNav flotante: amplio por defecto, se contrae apenas
 * hay scroll (MainScrollArea llama a collapse()) y solo vuelve a expandirse
 * cuando el usuario toca uno de sus botones (BottomNav llama a expand()).
 * Volver arriba con scroll NO lo re-expande — es a propósito, solo el clic.
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
