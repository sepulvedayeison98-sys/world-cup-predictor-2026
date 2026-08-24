import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { QueryProvider } from '@/components/layout/QueryProvider'
import { MobileNavProvider } from '@/components/layout/MobileNavContext'
import { ScrollProvider } from '@/components/layout/ScrollContext'
import { BottomNavProvider } from '@/components/layout/BottomNavContext'
import { MainScrollArea } from '@/components/layout/MainScrollArea'
import { Toaster } from '@/components/ui/sonner'
import { SITE_URL } from '@/lib/constants'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  // SEO (playbook Sofascore, QW1): URLs canónicas y OG absolutas.
  // Identidad: la casa es "Veredicto · Inteligencia Deportiva" y es
  // multi-deporte. El Mundial fue su primera competición y está archivado;
  // ni la descripción ni las palabras clave lo nombran, porque anunciarlo
  // atraería a quien busca un torneo que aquí ya no se cubre.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Veredicto · Inteligencia Deportiva',
    // La plantilla añade la marca UNA vez: las páginas declaran solo su
    // nombre ("Ranking ATP"), nunca el sufijo, o saldría duplicado.
    template: '%s | Veredicto',
  },
  description:
    'Predicción e inteligencia deportiva con métricas medidas: grandes ligas europeas, Liga BetPlay, Copa Libertadores, NBA y tenis ATP.',
  keywords: [
    'predicciones deportivas', 'inteligencia deportiva', 'grandes ligas',
    'Liga BetPlay', 'Copa Libertadores', 'NBA', 'tenis ATP',
    'análisis de datos deportivos',
  ],
  manifest: '/manifest.webmanifest',
  applicationName: 'Veredicto',
  appleWebApp: {
    capable: true,
    title: 'Veredicto',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon-192.png',
    shortcut: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <QueryProvider>
            <MobileNavProvider>
              <ScrollProvider>
                <BottomNavProvider>
                  {/* Salto al contenido (WCAG 2.4.1): invisible hasta recibir
                      foco por teclado, entonces aparece sobre la interfaz. */}
                  <a
                    href="#contenido"
                    className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]
                               focus:rounded-lg focus:border focus:border-emerald-500/40 focus:bg-zinc-900
                               focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-emerald-300"
                  >
                    Saltar al contenido
                  </a>
                  <div className="flex h-screen overflow-hidden pt-[env(safe-area-inset-top)]">
                    <Sidebar />
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <Topbar />
                      <MainScrollArea>{children}</MainScrollArea>
                    </div>
                  </div>
                  <BottomNav />
                </BottomNavProvider>
              </ScrollProvider>
            </MobileNavProvider>
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
