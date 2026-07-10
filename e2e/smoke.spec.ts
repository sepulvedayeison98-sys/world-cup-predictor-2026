import { test, expect } from '@playwright/test'

/**
 * Humo de los flujos críticos. Diseñados para NO depender de datos del día
 * (los partidos cambian a diario): verifican estructura, no contenido.
 */

test('la raíz redirige al inicio global y renderiza los bloques núcleo', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Panel de Inteligencia' })).toBeVisible()
  await expect(page.getByText('Próximos partidos')).toBeVisible()
  await expect(page.getByText('Confianza del motor')).toBeVisible()
  await expect(page.getByText('El pick del día')).toBeVisible()
  await expect(page.getByText('Actividad del motor')).toBeVisible()
  // Sin desborde horizontal en móvil (regresión del fix de overflow)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})

test('hub del Mundial: estado vital, widgets del torneo y secciones', async ({ page }) => {
  await page.goto('/mundial')
  await expect(page.getByRole('heading', { name: 'Mundial 2026' })).toBeVisible()
  await expect(page.getByText('Favorito al título')).toBeVisible()
  await expect(page.getByText('Precisión del motor')).toBeVisible()
  await expect(page.getByRole('link', { name: /Eliminatorias/ }).first()).toBeVisible()
})

test('inteligencia: precisión verificable con líneas base y metodología', async ({ page }) => {
  await page.goto('/inteligencia')
  await expect(page.getByRole('heading', { name: 'Inteligencia' })).toBeVisible()
  await expect(page.getByText('Precisión por competición')).toBeVisible()
  await expect(page.getByText(/azar 33%/).first()).toBeVisible()
  await expect(page.getByText('Cómo predice el motor')).toBeVisible()
})

test('detalle de partido: 4 pestañas fusionadas con secciones internas', async ({ page, request }) => {
  // Un partido real del Mundial vía la API pública (ids estables en BD)
  const res = await request.get('/api/predictions')
  const body = await res.json()
  const matchId = body?.data?.[0]?.match_id
  expect(matchId, 'la API de predicciones debe devolver al menos un partido').toBeTruthy()

  await page.goto(`/matches/${matchId}`)
  // Exactamente 4 pestañas (fusión T4) — las 8 antiguas ya no existen
  for (const tab of ['Predicción', 'Análisis del modelo', 'Estadísticas', 'Cuotas']) {
    await expect(page.getByRole('button', { name: tab })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Digital Twin' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Monte Carlo' })).toHaveCount(0)
  // Predicción incluye el bloque de Smart Bets
  await expect(page.getByText('Smart Bets del partido')).toBeVisible()
  // Análisis del modelo agrupa las tres secciones con títulos honestos
  await page.getByRole('button', { name: 'Análisis del modelo' }).click()
  await expect(page.getByText('Gemelo estadístico del partido')).toBeVisible()
  await expect(page.getByText('Distribución de resultados (Monte Carlo)')).toBeVisible()
  await expect(page.getByText('Integridad de los datos')).toBeVisible()
  // Estadísticas absorbe Alineaciones
  await page.getByRole('button', { name: 'Estadísticas' }).click()
  await expect(page.getByText('Alineaciones y bajas')).toBeVisible()
})

test('value bets: historial de aciertos de Smart Bets visible', async ({ page }) => {
  await page.goto('/value-bets')
  await expect(page.getByText('Historial de aciertos')).toBeVisible()
  // Con o sin datos, el bloque siempre dice algo: panel acumulativo
  // (Efectividad) o el estado vacío honesto. .or() auto-espera al render.
  await expect(
    page.getByText('Efectividad').first().or(page.getByText('Aún no hay recomendaciones registradas')),
  ).toBeVisible()
})

test('nba: hub con standings por conferencia (primer deporte no-fútbol)', async ({ page }) => {
  await page.goto('/nba')
  await expect(page.getByRole('heading', { name: 'NBA', exact: true })).toBeVisible()
  await expect(page.getByText('Conferencia Este')).toBeVisible()
  await expect(page.getByText('Conferencia Oeste')).toBeVisible()
  await expect(page.getByText('Precisión del motor')).toBeVisible()
  // 30 franquicias repartidas en dos conferencias (15 filas cada tabla)
  await expect(page.locator('tbody tr')).toHaveCount(30)
  await expect(page.getByText('Playoffs directo (1-6)').first()).toBeVisible()
  // Calendario navegable presente
  await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible()
  // Tarjetas de sección del dominio NBA
  for (const s of ['Rankings', 'Tendencias', 'Predicciones']) {
    await expect(page.getByRole('main').getByRole('link', { name: new RegExp(s) }).first()).toBeVisible()
  }
})

test('nba: secciones del dominio con métricas reales', async ({ page }) => {
  // Primer render de rutas dinámicas sin caché ISR, bajo carga paralela
  test.slow()
  // Rankings: 30 franquicias por ELO
  await page.goto('/nba/rankings')
  await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(30)
  // Del ranking al perfil del equipo: se valida el href real de la tabla
  // y se navega directo (el clic client-side es flaky bajo la carga
  // paralela del sandbox; el destino y el contenido son lo que se prueba)
  const teamHref = await page.locator('tbody a[href^="/nba/equipos/"]').first().getAttribute('href')
  expect(teamHref).toMatch(/^\/nba\/equipos\/[0-9a-f-]{36}$/)
  await page.goto(teamHref!)
  await expect(page).toHaveURL(/\/nba\/equipos\/[0-9a-f-]{36}/)
  await expect(page.getByText('Récord', { exact: true })).toBeVisible()
  await expect(page.getByText('Local / visitante')).toBeVisible()
  await expect(page.getByText('Perfil por cuarto')).toBeVisible()
  // Predicciones: calibración honesta del modelo
  await page.goto('/nba/predicciones')
  await expect(page.getByText('Calibración: lo prometido vs lo cumplido')).toBeVisible()
  await expect(page.getByText(/azar 50%/)).toBeVisible()
  // Estadísticas y tendencias de liga
  await page.goto('/nba/estadisticas')
  await expect(page.getByRole('heading', { name: 'Estadísticas de la liga' })).toBeVisible()
  await expect(page.getByText('Anotación por cuarto (promedio liga)')).toBeVisible()
  await page.goto('/nba/tendencias')
  await expect(page.getByText('Rachas positivas')).toBeVisible()
  await expect(page.getByText(/clutch/)).toBeVisible()
})

test('nba: detalle de partido con moneyline, cuartos y veredicto (sin paneles de fútbol)', async ({ page }) => {
  await page.goto('/matches/b39bc056-85ff-419f-a17b-367e81609d42') // Spurs 125-118 Raptors
  await expect(page.getByRole('main').getByRole('link', { name: /NBA/ })).toBeVisible()
  await expect(page.getByText('Ganador (moneyline)')).toBeVisible()
  await expect(page.getByText('Hándicap', { exact: true })).toBeVisible()
  await expect(page.getByText('Desglose por cuarto')).toBeVisible()
  await expect(page.getByText('Veredicto del partido')).toBeVisible({ timeout: 20_000 })
  // Las pestañas de fútbol NO aplican al baloncesto (ni Análisis ni Cuotas)
  await expect(page.getByRole('button', { name: 'Análisis del modelo' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cuotas' })).toHaveCount(0)
  // La comparación de temporada NBA sustituye a los paneles de fútbol
  await page.getByRole('button', { name: 'Estadísticas' }).click()
  await expect(page.getByText('Comparación de temporada')).toBeVisible()
})

test('detalle universal: partido de liga clicable con veredicto y timeline', async ({ page }) => {
  await page.goto('/ligas/premier-league')
  // Clic en el primer partido del calendario (jornada por defecto)
  await page.locator('a[href^="/matches/"]').first().click()
  await expect(page).toHaveURL(/\/matches\/[0-9a-f-]{36}/)
  // Cabecera universal: contexto de liga, regreso a la competición y credencial ELO
  await expect(page.getByText(/Jornada \d+/)).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: /Premier League/ })).toBeVisible()
  await expect(page.getByText(/ELO \d+/).first()).toBeVisible()
  // Pick del motor visible con su estado (partido finalizado)
  await expect(page.getByText('Pick del motor:')).toBeVisible()
  await expect(page.getByText(/Acertado|Fallado/)).toBeVisible()
  // Veredicto post-partido (primera vez se genera; hasta 15 s)
  await expect(page.getByText('Veredicto del partido')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Predicción vs realidad')).toBeVisible({ timeout: 15_000 })
  // Línea de tiempo presente (con eventos o con su estado honesto)
  await expect(page.getByText('Línea de tiempo')).toBeVisible()
  // Las 4 pestañas universales también aplican a ligas
  await expect(page.getByRole('button', { name: 'Análisis del modelo' })).toBeVisible()
})

test('buscador global: abre desde la topbar y lista competiciones', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Buscar equipo o competición' }).click()
  await expect(page.getByRole('dialog', { name: 'Buscador global' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Premier League/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('la página de partidos carga con filtros y tabla', async ({ page }) => {
  await page.goto('/matches')
  await expect(page.getByRole('heading', { name: 'Partidos' })).toBeVisible()
  // La tabla responde aunque no haya partidos hoy (mensaje contextual o filas)
  await expect(page.locator('table')).toBeVisible({ timeout: 15_000 })
})

test('value bets muestra el aviso de responsabilidad', async ({ page }) => {
  await page.goto('/value-bets')
  await expect(page.getByText(/Pinnacle/).first()).toBeVisible()
  await expect(page.getByText(/\+18/).first()).toBeVisible()
})

test('el panel admin pide clave y lista partidos', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Cargar Resultados' })).toBeVisible()
  await expect(page.getByPlaceholder(/Clave de administración/)).toBeVisible()
})

test('ligas: overview con las 5 grandes ligas', async ({ page }) => {
  await page.goto('/ligas')
  await expect(page.getByRole('heading', { name: 'Ligas' })).toBeVisible()
  for (const liga of ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']) {
    await expect(page.getByRole('button', { name: liga })).toBeVisible()
  }
  // La Liga: 20 filas; Bundesliga: 18 (sin el rival del playoff de descenso)
  await page.getByRole('button', { name: 'La Liga' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(20)
  await page.getByRole('button', { name: 'Bundesliga' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(18)
  await expect(page.getByText('Descenso')).toBeVisible()
})

test('ligas: detalle con calendario por jornada y modelo', async ({ page }) => {
  await page.goto('/ligas/premier-league')
  await expect(page.getByRole('heading', { name: 'Premier League' })).toBeVisible()
  await expect(page.getByText('Tabla de posiciones')).toBeVisible()
  await expect(page.getByText('Precisión del modelo')).toBeVisible()
  // Navegación de jornadas
  const select = page.getByLabel('Seleccionar jornada')
  await expect(select).toBeVisible()
  await select.selectOption('20')
  await expect(page.locator('li').filter({ hasText: '-' }).first()).toBeVisible()
})

test('mundial: ranking ELO con las 48 selecciones y contraste FIFA', async ({ page }) => {
  await page.goto('/mundial/rankings')
  await expect(page.getByRole('heading', { name: 'Ranking ELO' })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(48)
  // Contraste con FIFA y fase alcanzada presentes en la cabecera
  await expect(page.locator('th', { hasText: 'FIFA' })).toBeVisible()
  await expect(page.locator('th', { hasText: 'Fase' })).toBeVisible()
})

test('seo: sitemap dinámico con partidos y robots.txt', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.status()).toBe(200)
  const xml = await sitemap.text()
  expect(xml).toContain('<urlset')
  expect(xml).toContain('/matches/')
  expect(xml).toContain('/mundial/rankings')

  const robots = await request.get('/robots.txt')
  expect(robots.status()).toBe(200)
  expect(await robots.text()).toContain('sitemap.xml')
})

test('móvil: bottom nav con destinos principales', async ({ page }) => {
  await page.goto('/dashboard')
  const nav = page.getByRole('navigation', { name: 'Navegación inferior' })
  await expect(nav).toBeVisible()
  for (const label of ['Inicio', 'Partidos', 'Smart Bets', 'Más']) {
    await expect(nav.getByText(label, { exact: true })).toBeVisible()
  }
})

test('mundial: balance del modelo con precisión y calibración', async ({ page }) => {
  await page.goto('/mundial/balance')
  await expect(page.getByRole('heading', { name: 'Cómo le fue al modelo' })).toBeVisible()
  // Con partidos resueltos del torneo, deben verse KPIs y calibración
  await expect(page.getByText('Precisión 1X2')).toBeVisible()
  await expect(page.getByText('Precisión por fase')).toBeVisible()
})

test('ligas: equipo clicable → perfil con récord y forma', async ({ page }) => {
  await page.goto('/ligas/premier-league')
  await expect(page.getByText('Tabla de posiciones')).toBeVisible()
  // Primer equipo de la tabla enlaza a su perfil de fútbol
  const teamLink = page.locator('tbody a[href^="/equipos/"]').first()
  const href = await teamLink.getAttribute('href')
  expect(href).toMatch(/^\/equipos\/[0-9a-f-]{36}$/)
  await page.goto(href!)
  await expect(page.getByText('Récord (G-E-P)')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Forma' })).toBeVisible()
  await expect(page.getByText('Local / visitante')).toBeVisible()
  await expect(page.getByText('Últimos partidos')).toBeVisible()
})
