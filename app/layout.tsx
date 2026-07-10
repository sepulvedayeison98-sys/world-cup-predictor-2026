import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { QueryProvider } from '@/components/layout/QueryProvider'
import { MobileNavProvider } from '@/components/layout/MobileNavContext'
import { Toaster } from '@/components/ui/sonner'
import { AutoRefresh } from '@/components/ui/AutoRefresh'
import { SyncKeepalive } from '@/components/layout/SyncKeepalive'
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
  // SEO (playbook Sofascore, QW1): URLs canónicas y OG absolutas
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'World Cup Predictor 2026',
    template: '%s | WC Predictor',
  },
  description: 'Plataforma profesional de análisis y predicción — FIFA World Cup 2026',
  keywords: ['mundial 2026', 'predicciones fútbol', 'análisis deportivo', 'apuestas valor'],
  manifest: '/manifest.webmanifest',
  applicationName: 'WC Predictor',
  appleWebApp: {
    capable: true,
    title: 'WC Predictor',
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
              <div className="flex h-screen overflow-hidden pt-[env(safe-area-inset-top)]">
                <Sidebar />
                <div className="flex flex-1 flex-col overflow-hidden">
                  <Topbar />
                  <main className="flex-1 overflow-y-auto overflow-x-hidden bg-zinc-950">
                    <AutoRefresh />
                    <SyncKeepalive />
                    {children}
                  </main>
                </div>
              </div>
            </MobileNavProvider>
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
