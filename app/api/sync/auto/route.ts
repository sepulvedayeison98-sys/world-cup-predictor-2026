import { NextRequest, NextResponse } from 'next/server'
import { getSyncWindow } from '@/lib/syncWindow'
import { syncResults } from '@/services/sync/results'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/auto — punto unico para pingers externos (cron-job.org, etc).
 *
 * Hace el chequeo de ventana y, si corresponde, sincroniza resultados en la
 * misma llamada. Pensado para reemplazar el patron de 2 pasos (window +
 * results) cuando el disparador externo solo puede pegarle a una URL fija sin
 * logica condicional — asi un ping de alta frecuencia (ej. cada 5 min) no
 * gasta cuota de The Odds API salvo que haya partido en ventana de juego.
 *
 * Protegido por CRON_SECRET (mismo header que los otros /api/sync/*).
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const window = await getSyncWindow()
    if (!window.shouldSyncResults) {
      return NextResponse.json({ skipped: true, window })
    }
    const result = await syncResults()
    return NextResponse.json({ skipped: false, window, ...result })
  } catch (err: any) {
    console.error('[GET /api/sync/auto]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
