import { defineConfig } from '@playwright/test'

/**
 * E2E de humo contra el build de producción local.
 * Correr: npm run build && npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    // Chromium preinstalado del entorno (no descargar navegadores)
    launchOptions: { executablePath: process.env.PW_CHROMIUM ?? undefined },
    viewport: { width: 390, height: 844 }, // móvil primero: así lo usa el dueño
  },
  webServer: {
    command: 'npm run start',
    port: 3000,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
