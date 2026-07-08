import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cronAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Diagnóstico TEMPORAL: comprueba si SPORTS_API_KEY (api-sports.io)
 * tiene acceso al API de baloncesto/NBA y qué temporadas permite el plan.
 * Se elimina tras decidir la integración. NO expone la clave.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const key = process.env.SPORTS_API_KEY
  if (!key) return NextResponse.json({ ok: false, error: 'SPORTS_API_KEY no configurada' })

  async function probe(host: string, path: string) {
    try {
      const res = await fetch(`https://${host}${path}`, {
        headers: { 'x-apisports-key': key! },
        cache: 'no-store',
      })
      const body = await res.json().catch(() => ({}))
      return {
        host, path, httpStatus: res.status,
        errors: body?.errors ?? null,
        results: body?.results ?? null,
        sample: Array.isArray(body?.response) ? body.response.slice(0, 3) : body?.response ?? null,
      }
    } catch (e: any) {
      return { host, path, error: e?.message?.slice(0, 120) }
    }
  }

  const [status, leagues, nbaStatus] = await Promise.all([
    probe('v1.basketball.api-sports.io', '/status'),
    probe('v1.basketball.api-sports.io', '/leagues?search=NBA'),
    probe('v2.nba.api-sports.io', '/'),
  ])

  return NextResponse.json({ status, leagues, nbaStatus })
}
