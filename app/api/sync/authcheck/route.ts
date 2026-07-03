import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * TEMPORAL — diagnóstico de credenciales del cron (eliminar tras resolver).
 * Compara el header recibido contra CRON_SECRET revelando SOLO longitudes
 * y si coinciden — nunca valores ni hashes.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? ''
  const auth = req.headers.get('authorization') ?? ''
  const received = auth.startsWith('Bearer ') ? auth.slice(7) : auth
  return NextResponse.json({
    receivedLength: received.length,
    expectedLength: secret.length,
    hasBearerPrefix: auth.startsWith('Bearer '),
    match: received === secret,
    receivedHasWhitespace: /\s/.test(received),
  })
}
