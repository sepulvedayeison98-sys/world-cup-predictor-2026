import { NextRequest, NextResponse } from 'next/server'
import { ingestSquads, ingestInjuries, ingestLineups } from '@/services/sync/football-roster'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { logSyncError } from '@/lib/syncLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/sync/roster?entity=squads|injuries|lineups&league=premier_league
 *
 * Ingesta de plantillas, lesiones y alineaciones de fútbol.
 *
 * `entity` es OBLIGATORIO y solo admite una por corrida. No es rigidez: las
 * plantillas cuestan una petición por equipo y las alineaciones una por
 * partido, así que encadenar las tres en una sola invocación se comería el
 * techo de 60 s de Vercel Hobby. Cada entidad tiene además su propia cadencia
 * natural — una plantilla cambia en el mercado de fichajes, una alineación
 * una hora antes del partido.
 *
 * `league` acota la corrida y con ella el gasto de cuota. Sin él corre las
 * seis ligas, que en plantillas son 120 peticiones y casi seguro se corta por
 * presupuesto de tiempo: la respuesta lo dirá con `truncated: true` y basta
 * con volver a llamar, porque el proceso es idempotente.
 *
 * Orden que importa: las lesiones y las alineaciones referencian jugadores,
 * así que `squads` va primero. Si no, las filas se descartan y salen en
 * `skipped`.
 *
 * Protegida por CRON_SECRET.
 */

const ENTITIES = ['squads', 'injuries', 'lineups'] as const
type Entity = (typeof ENTITIES)[number]

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const entity = req.nextUrl.searchParams.get('entity') as Entity | null
  if (!entity || !ENTITIES.includes(entity)) {
    return NextResponse.json(
      { error: `entity debe ser una de: ${ENTITIES.join(', ')}` },
      { status: 400 },
    )
  }

  const leagueParam = req.nextUrl.searchParams.get('league')
  const leagues = leagueParam
    ? leagueParam.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined

  try {
    const result =
      entity === 'squads' ? await ingestSquads(leagues)
      : entity === 'injuries' ? await ingestInjuries(leagues)
      : await ingestLineups({
          leagues,
          windowHours: Number(req.nextUrl.searchParams.get('windowHours')) || undefined,
          maxMatches: Number(req.nextUrl.searchParams.get('maxMatches')) || undefined,
        })

    // `truncated` no es un fallo: es trabajo pendiente. Se responde 200 con
    // la bandera para que quien orqueste sepa que debe volver a llamar.
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await logSyncError('api_football', `roster:${entity}`, e, { leagues: leagues ?? 'todas' })
    return NextResponse.json({ ok: false, entity, error: message }, { status: 500 })
  }
}
