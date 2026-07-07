'use client'

import { useEffect } from 'react'

const INTERVAL_MS = 60 * 1000

/**
 * Keepalive global del sync (scheduler confiable sin dependencias externas).
 *
 * Problema: el cron de GitHub programado cada 15 min corre en realidad cada
 * 70–90 min, así que sin visitantes en la página del partido, un final de
 * partido podía tardar más de una hora en disparar la cadena (bracket,
 * recalibración).
 *
 * Solución: cualquier visitante, en cualquier página, hace ping a
 * /api/sync/live cada 60s. El endpoint decide todo del lado servidor:
 *   · sin partidos en ventana de juego → no-op inmediato (milisegundos)
 *   · throttle GLOBAL de 20s en BD → mil pestañas ≠ mil llamadas a ESPN
 *   · transición a finished → corre la cadena post-resultado completa
 * El cron de GitHub queda como respaldo para las horas sin tráfico.
 */
export function SyncKeepalive() {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      fetch('/api/sync/live', { cache: 'no-store' }).catch(() => {})
    }
    tick()
    const id = setInterval(tick, INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return null
}
