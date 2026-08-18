'use client'

import { createContext, useContext, useState } from 'react'

/**
 * Estado de scroll del <main> (auditoría F-nav: el contenido scrollea
 * dentro de <main>, no en window). Lo consume MainScrollArea (que mide
 * el scroll real) y Topbar (que reacciona volviéndose flotante).
 */
type MainScroll = { scrolled: boolean; setScrolled: (v: boolean) => void }

const MainScrollCtx = createContext<MainScroll>({ scrolled: false, setScrolled: () => {} })

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  return <MainScrollCtx.Provider value={{ scrolled, setScrolled }}>{children}</MainScrollCtx.Provider>
}

export const useMainScroll = () => useContext(MainScrollCtx)
