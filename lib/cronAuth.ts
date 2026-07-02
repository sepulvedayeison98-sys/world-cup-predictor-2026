import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

/**
 * Autorización de las rutas /api/sync/*: header `Authorization: Bearer <CRON_SECRET>`.
 * Comparación en tiempo constante para no filtrar información del secreto
 * por diferencias de timing.
 */
export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // sin secret configurado, no se permite
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(auth)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
