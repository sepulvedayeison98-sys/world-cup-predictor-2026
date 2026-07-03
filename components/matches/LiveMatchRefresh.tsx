'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Radio } from 'lucide-react'

const LIVE_INTERVAL_MS = 30 * 1000 // 30s durante un partido en vivo

/**
 * Refresco rápido de la página de partido mientras está EN VIVO. El marcador
 * lo actualiza el sync de ESPN en la BD; esto vuelve a pedir el server
 * component cada 30s para que el usuario vea el gol sin recargar a mano.
 * Solo se activa con status 'live' — en otros estados no hace nada.
 */
export function LiveMatchRefresh({ status }: { status: string }) {
  const router = useRouter()
  const [beat, setBeat] = useState(false)

  useEffect(() => {
    if (status !== 'live') return
    const id = setInterval(() => {
      setBeat(true)
      router.refresh()
      setTimeout(() => setBeat(false), 800)
    }, LIVE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [status, router])

  if (status !== 'live') return null

  return (
    <div className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5">
      <Radio className={`h-3 w-3 text-red-400 ${beat ? 'animate-ping' : 'animate-pulse'}`} />
      <span className="text-[11px] font-semibold text-red-400">
        Marcador en vivo · se actualiza solo
      </span>
    </div>
  )
}
