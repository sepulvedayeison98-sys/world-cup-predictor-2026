'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Radio } from 'lucide-react'

const LIVE_INTERVAL_MS = 30 * 1000 // 30s durante un partido en vivo

interface Props {
  status: string
  kickoffTime: string
}

/**
 * Refresco rápido de la página de partido mientras está EN VIVO o alrededor
 * del saque. Dispara /api/sync/live (sync de ESPN bajo demanda, porque el
 * cron de GitHub llega con 70-90 min de retraso) y re-renderiza el server
 * component para que el usuario vea el gol sin recargar.
 *
 * Se activa si: status='live', o status='scheduled' dentro de la ventana de
 * juego (desde 5 min antes del saque hasta 150 min después). Fuera de eso no
 * hace nada.
 */
export function LiveMatchRefresh({ status, kickoffTime }: Props) {
  const router = useRouter()
  const [beat, setBeat] = useState(false)

  const kickMs = new Date(kickoffTime).getTime()
  const nowMs = Date.now()
  const inWindow = nowMs >= kickMs - 5 * 60_000 && nowMs <= kickMs + 150 * 60_000
  const shouldPoll = status === 'live' || (status === 'scheduled' && inWindow)

  useEffect(() => {
    if (!shouldPoll) return
    const tick = async () => {
      setBeat(true)
      try { await fetch('/api/sync/live', { cache: 'no-store' }) } catch {}
      router.refresh()
      setTimeout(() => setBeat(false), 800)
    }
    // Primera pasada inmediata (captura el saque sin esperar 30s)
    tick()
    const id = setInterval(tick, LIVE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [shouldPoll, router])

  if (status === 'live') {
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5">
        <Radio className={`h-3 w-3 text-red-400 ${beat ? 'animate-ping' : 'animate-pulse'}`} />
        <span className="text-[11px] font-semibold text-red-400">
          Marcador en vivo · se actualiza solo
        </span>
      </div>
    )
  }
  return null
}
