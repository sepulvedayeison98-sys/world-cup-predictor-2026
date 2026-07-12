import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { revalidateAfterResults } from '@/lib/revalidate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/revalidate — purga manual del caché ISR (docs/CACHE_STRATEGY.md).
 * Protegida con CRON_SECRET. Sin body purga todas las páginas de resultados;
 * con `?path=/ruta` purga solo esa ruta. Útil para forzar frescura puntual.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const path = req.nextUrl.searchParams.get('path')
  try {
    if (path) {
      revalidatePath(path)
      return NextResponse.json({ ok: true, revalidated: path })
    }
    revalidateAfterResults()
    return NextResponse.json({ ok: true, revalidated: 'result-paths' })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'revalidate failed' }, { status: 500 })
  }
}
