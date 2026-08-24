import type { NextConfig } from 'next'

/**
 * Cabeceras de seguridad aplicadas a todas las respuestas.
 * Endurecen contra clickjacking, MIME-sniffing, fuga de referer y forzan HTTPS.
 * No incluimos una CSP restrictiva de scripts para no romper Next/Supabase;
 * sí fijamos frame-ancestors/base-uri/object-src que son seguros y de alto valor.
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
  },
]

const nextConfig: NextConfig = {
  // Oculta la cabecera `X-Powered-By: Next.js` (fingerprinting).
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'media.api-sports.io' },
      { protocol: 'https', hostname: 'flagcdn.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  /**
   * Rutas del Mundial 2026, archivado. El torneo ocupaba nueve rutas de
   * primer nivel; todas se consolidaron en /mundial, que es ahora su página
   * de archivo. Redirigir en vez de devolver 404 porque estas URLs ya
   * circulan —enlaces, marcadores, el índice de los buscadores— y un 404 las
   * rompe sin decir nada; el redirect las lleva al balance congelado.
   *
   * `permanent: false` (307) a propósito: el archivo es "por ahora". Un 308
   * lo cachea el navegador para siempre y desarchivar dejaría a los usuarios
   * atrapados en el redirect antiguo.
   *
   * /players/[id] NO está aquí: el perfil de jugador sigue vivo, ahora al
   * servicio de las plantillas de liga. Solo se archivó el índice /players,
   * que era la plantilla del Mundial.
   */
  async redirects() {
    const archivadas = [
      '/mundial/balance',
      '/mundial/rankings',
      '/bracket',
      '/champion',
      '/groups',
      '/scorers',
      '/players',
      '/simulation',
    ]
    return archivadas.map((source) => ({ source, destination: '/mundial', permanent: false }))
  },
}

export default nextConfig
