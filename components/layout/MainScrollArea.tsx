'use client'

import { useRef } from 'react'
import { useMainScroll } from '@/components/layout/ScrollContext'
import { AutoRefresh } from '@/components/ui/AutoRefresh'
import { SyncKeepalive } from '@/components/layout/SyncKeepalive'

/** Píxeles de scroll a partir de los cuales el Topbar se vuelve flotante. */
const SCROLL_THRESHOLD = 24

export function MainScrollArea({ children }: { children: React.ReactNode }) {
  const { setScrolled } = useMainScroll()
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
