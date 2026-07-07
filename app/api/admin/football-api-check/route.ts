import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cronAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * TEMPORAL — diagnóstico de credenciales de API-Football/SPORTS_API
 * (eliminar tras resolver). Prueba las variables existentes contra el
 * endpoint /status (gratis, no consume cuota de partidos) y devuelve
 * SOLO metadata de cuenta (plan, límites) — nunca la clave.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = process.env.SPORTS_API_KEY
  const host = process.env.SPORTS_API_HOST || 'v3.football.api-sports.io'
  const league = process.env.SPORTS_API_LEAGUE
  const season = process.env.SPORTS_API_SEASON

  if (!key) {
    return NextResponse.json({ ok: false, error: 'SPORTS_API_KEY no está configurada' })
  }

  const isRapidApi = host.includes('rapidapi')
  const headers: Record<string, string> = isRapidApi
    ? { 'x-rapidapi-key': key, 'x-rapidapi-host': host }
    : { 'x-apisports-key': key }

  try {
    const res = await fetch(`https://${host}/status`, { headers, cache: 'no-store' })
    const body = await res.json()
    return NextResponse.json({
      ok: res.ok,
      httpStatus: res.status,
      hostUsed: host,
      authStyle: isRapidApi ? 'rapidapi' : 'api-sports.io directo',
      envVarsPresent: { key: true, host: !!process.env.SPORTS_API_HOST, league: !!league, season: !!season },
      accountInfo: body?.response ?? body,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message, hostUsed: host })
  }
}
