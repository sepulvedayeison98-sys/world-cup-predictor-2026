import type { MetadataRoute } from 'next'

/**
 * Web App Manifest — hace la web instalable en el celular ("Agregar a pantalla
 * de inicio" / "Instalar app"). Next.js lo sirve en /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Identidad de la casa (multi-deporte), no la de una sola competición:
    // es el nombre que queda en la pantalla de inicio al instalar la app.
    name: 'Veredicto · Inteligencia Deportiva',
    short_name: 'Veredicto',
    description: 'Predicción e inteligencia deportiva con métricas medidas: fútbol, NBA y tenis.',
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
