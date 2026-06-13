import { NextResponse, type NextRequest } from 'next/server'

/**
 * Acceso libre — sin autenticación requerida.
 * La raíz redirige al dashboard. Todas las rutas son públicas.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
