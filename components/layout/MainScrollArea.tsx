'use client'

import { useRef } from 'react'
import { useMainScroll } from '@/components/layout/ScrollContext'
import { useBottomNavState } from '@/components/layout/BottomNavContext'
import { AutoRefresh } from '@/components/ui/AutoRefresh'
import { SyncKeepalive } from '@/components/layout/SyncKeepalive'

/** Píxeles de scroll a partir de los cuales el Topbar se vuelve flotante. */
const SCROLL_THRESHOLD = 24

export function MainScrollArea({ children }: { children: React.ReactNode }) {
  const { setScrolled } = useMainScroll()
  const { collapse, expand } = useBottomNavState()
  const lastRef = useRef(false)

  return (
    <main
      id="contenido"
      tabIndex={-1}
      onScroll={(e) => {
        const next = e.currentTarget.scrollTop > SCROLL_THRESHOLD
        if (lastRef.current !== next) {
          lastRef.current = next
          setScrolled(next)
          // El BottomNav se contrae al cruzar el umbral hacia abajo y
          // vuelve a su tamaño normal al cruzarlo de nuevo hacia arriba
          // (o al volver al inicio) — no solo con un clic.
          if (next) collapse()
          else expand()
        }
      }}
      className="flex-1 overflow-y-auto overflow-x-hidden bg-zinc-950 pb-28 lg:pb-0"
    >
      <AutoRefresh />
      <SyncKeepalive />
      {children}
    </main>
  )
}
