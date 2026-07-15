import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { syncMatchesYear, validateIntegrity } from '@/services/tennis/sackmann'
import { runTennisBacktest } from '@/services/tennis/backtest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/tennis/sync — ingesta del dominio Tennis (Fase 4), por pasos
 * para respetar el límite de ejecución de Vercel. Protegida con CRON_SECRET.
 *
 *   ?step=matches&tour=ATP&year=2025   → torneos + jugadores + partidos +
 *       stats + rankings observados (rank real a la fecha del torneo)
 *   ?step=validate                     → invariantes de integridad
 *   ?step=backtest&tour=ATP            → walk-forward del motor tennis-1.0
 *       sobre todo el histórico real; persiste métricas medidas (no promesas)
 *       en tennis_backtests + tennis_model_metrics
 * Fuente: TML-Database (solo ATP; WTA declarada pendiente de fuente).
 *
 * Vive bajo /api/tennis/ (dominio aislado; la barrera ESLint aplica aquí).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const sp = req.nextUrl.searchParams
  const step = sp.get('step')
  const tour = (sp.get('tour') ?? 'ATP').toUpperCase() as 'ATP' | 'WTA'
  if (tour !== 'ATP' && tour !== 'WTA') {
    return NextResponse.json({ error: 'tour inválido' }, { status: 400 })
  }
  try {
    if (step === 'matches') {
      const year = parseInt(sp.get('year') ?? '', 10)
      if (!Number.isFinite(year) || year < 1968 || year > 2100) {
        return NextResponse.json({ error: 'year inválido' }, { status: 400 })
      }
      return NextResponse.json(await syncMatchesYear(tour, year))
    }
    if (step === 'validate') return NextResponse.json(await validateIntegrity())
    if (step === 'backtest') {
      // variant=tennis-1.1 activa la siembra de ELO por ranking (cold-start)
      const variant = sp.get('variant') === 'tennis-1.1' ? 'tennis-1.1' : 'tennis-1.0'
      return NextResponse.json(await runTennisBacktest(tour, {
        modelVersion: variant,
        seedFromRanking: variant === 'tennis-1.1',
      }))
    }
    return NextResponse.json({ error: 'step requerido: matches|validate|backtest' }, { status: 400 })
  } catch (err: any) {
    console.error('[tennis/sync]', step, tour, err?.message)
    return NextResponse.json({ error: err?.message ?? 'sync failed' }, { status: 500 })
  }
}
