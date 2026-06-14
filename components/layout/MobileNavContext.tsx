'use client'

import { createContext, useContext, useState } from 'react'

/**
 * Estado compartido del menu lateral en movil (drawer).
 * Lo consumen el Topbar (boton hamburguesa) y el Sidebar (drawer + overlay).
 */
type MobileNav = { open: boolean; setOpen: (v: boolean) => void }

const MobileNavCtx = createContext<MobileNav>({ open: false, setOpen: () => {} })

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return <MobileNavCtx.Provider value={{ open, setOpen }}>{children}</MobileNavCtx.Provider>
}

export const useMobileNav = () => useContext(MobileNavCtx)
