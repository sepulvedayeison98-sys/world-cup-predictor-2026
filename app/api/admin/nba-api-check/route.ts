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

  const H = 'v1.basketball.api-sports.io'
  const results: Record<string, any> = {}
  // Probar temporadas de más reciente a más antigua para hallar la accesible
  for (const season of ['2024-2025', '2023-2024', '2022-2023', '2021-2022']) {
    const teams = await probe(H, `/teams?league=12&season=${season}`)
    results[season] = { teamsResults: teams.results, errors: teams.errors, sampleTeam: Array.isArray(teams.sample) ? teams.sample[0] : null }
    if (teams.results && teams.results > 0) {
      results[season].games = await probe(H, `/games?league=12&season=${season}`).then((g) => ({ results: g.results, sample: Array.isArray(g.sample) ? g.sample[0] : null }))
      results[season].standings = await probe(H, `/standings?league=12&season=${season}`).then((s) => ({ results: s.results, errors: s.errors }))
      break
    }
  }

  return NextResponse.json({ results })
}
