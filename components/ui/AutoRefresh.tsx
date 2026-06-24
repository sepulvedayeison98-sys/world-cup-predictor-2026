'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

const INTERVAL_MS = 30 * 60 * 1000 // 30 minutos

export function AutoRefresh() {
  const router   = useRouter()
  const [last,   setLast]   = useState<Date>(new Date())
  const [mins,   setMins]   = useState(0)
  const [spin,   setSpin]   = useState(false)

  // Refresco automático cada 30 min
  useEffect(() => {
    const id = setInterval(() => {
      setSpin(true)
      router.refresh()
      setLast(new Date())
      setTimeout(() => setSpin(false), 1200)
    }, INTERVAL_MS)
    return () => clearInterval(id)
  }, [router])

  // Contador de minutos desde el último refresh
  useEffect(() => {
    const id = setInterval(() => {
      setMins(Math.floor((Date.now() - last.getTime()) / 60_000))
    }, 30_000)
    return () => clearInterval(id)
  }, [last])

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-600 select-none">
      <RefreshCw className={`h-2.5 w-2.5 ${spin ? 'animate-spin text-emerald-500' : ''}`} />
      {mins === 0 ? 'Actualizado ahora' : `Actualizado hace ${mins} min`}
    </span>
  )
}
