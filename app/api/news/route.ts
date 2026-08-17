import { NextRequest, NextResponse } from 'next/server'
import { newsService } from '@/services/sports/news/news.service'
import type { SportKey } from '@/services/sports/core/types'

export const runtime = 'nodejs'
export const revalidate = 900 // 15 min, el mismo TTL que la clase «news»

/**
 * GET /api/news?sport=futbol|baloncesto|tenis&scope=…&limit=…
 *
 * Frontera entre la interfaz y la capa de proveedores. El cliente pide por
 * DEPORTE, nunca por proveedor: quién sirve las noticias hoy (ESPN) es una
 * decisión de `core/registry`, y cambiarla no toca esta ruta ni el componente
 * que la consume.
 *
 * El ámbito lo valida el propio proveedor contra una lista blanca; aquí solo
 * se acota el deporte y el tamaño de página.
 */

const SPORTS: readonly SportKey[] = ['futbol', 'baloncesto', 'tenis']

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('sport')
  const sport = SPORTS.includes(raw as SportKey) ? (raw as SportKey) : 'futbol'
  const scope = req.nextUrl.searchParams.get('scope') ?? undefined
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 8, 1), 20)

  const result = await newsService.getNews({ sport, scope, limit })

  if (result.status === 'ok') {
    return NextResponse.json({
      articles: result.data,
      source: result.provenance.provider,
      fetchedAt: result.provenance.fetchedAt,
    })
  }

  // Ni «no cubierto» ni «error» son un 500: la página sigue en pie y la
  // sección de noticias simplemente no aparece. El motivo va en español y
  // sin detalle técnico, listo para pintarse tal cual.
  return NextResponse.json(
    { articles: [], reason: result.reason, unavailable: true },
    { status: result.status === 'unsupported' ? 200 : 503 },
  )
}
