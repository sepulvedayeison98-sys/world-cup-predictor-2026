import type { MetadataRoute } from 'next'

/**
 * Web App Manifest — hace la web instalable en el celular ("Agregar a pantalla
 * de inicio" / "Instalar app"). Next.js lo sirve en /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'World Cup Predictor 2026',
    short_name: 'WC Predictor',
    description: 'Análisis y predicciones en vivo del Mundial FIFA 2026',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    lang: 'es',
    categories: ['sports'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
