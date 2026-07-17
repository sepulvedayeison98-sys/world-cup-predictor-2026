import { test, expect } from '@playwright/test'

/**
 * Humo del dominio TENIS. Estructural (no depende de datos del día): hub,
 * ranking, perfil con índices de saque/resto, resultados, detalle y H2H con
 * mercados simulados (Monte Carlo).
 */

test('tenis: hub con ranking, resultados y medición del motor', async ({ page }) => {
  await page.goto('/tennis')
  await expect(page.getByRole('heading', { name: 'ATP Tour' })).toBeVisible()
  await expect(page.getByText('Precisión del motor')).toBeVisible()
  await expect(page.getByText('Ranking ATP').first()).toBeVisible()
  await expect(page.getByText('Resultados recientes')).toBeVisible()
})

test('tenis: ranking completo con filas y enlaces a perfiles', async ({ page }) => {
  await page.goto('/tennis/ranking')
  await expect(page.getByRole('heading', { name: /Ranking/ })).toBeVisible()
  const rows = page.locator('tbody tr')
  expect(await rows.count()).toBeGreaterThan(50) // ranking honesto: cientos de jugadores
  const href = await page.locator('a[href^="/tennis/jugadores/"]').first().getAttribute('href')
  expect(href).toMatch(/^\/tennis\/jugadores\/[0-9a-f-]{36}$/)
})

test('tenis: perfil de jugador con métricas medidas e índices saque/resto', async ({ page }) => {
  test.slow() // primer render ISR de perfiles bajo carga paralela
  await page.goto('/tennis/ranking')
  const href = await page.locator('a[href^="/tennis/jugadores/"]').first().getAttribute('href')
  await page.goto(href!)
  await expect(page.getByText('Win %')).toBeVisible()
  await expect(page.getByText('Hold % (saque)')).toBeVisible()
  // Cableado serveReturn: índices 0-100 declarados
  await expect(page.getByRole('heading', { name: 'Saque y devolución' })).toBeVisible()
  await expect(page.getByText('Forma reciente')).toBeVisible()
})

test('tenis: navegador de resultados con filtro y detalle de partido', async ({ page }) => {
  await page.goto('/tennis/partidos')
  await expect(page.getByRole('heading', { name: /Resultados|Partidos/ })).toBeVisible()
  const link = page.locator('a[href^="/tennis/partidos/"]').first()
  const href = await link.getAttribute('href')
  expect(href).toMatch(/^\/tennis\/partidos\/[0-9a-f-]{36}$/)
  await page.goto(href!)
  await expect(page.getByText('resultado')).toBeVisible()
  await expect(page.getByText(/TML-Database/)).toBeVisible()
})

test('tenis: H2H con mercados simulados Monte Carlo', async ({ page }) => {
  test.slow() // el simulador corre server-side en el primer render
  // Dos perfiles reales desde el ranking (ids estables de BD)
  await page.goto('/tennis/ranking')
  const links = page.locator('a[href^="/tennis/jugadores/"]')
  const id = (h: string | null) => h?.split('/').pop()
  const p1 = id(await links.nth(0).getAttribute('href'))
  const p2 = id(await links.nth(1).getAttribute('href'))
  expect(p1 && p2 && p1 !== p2).toBeTruthy()

  await page.goto(`/tennis/h2h?p1=${p1}&p2=${p2}`)
  await expect(page.getByRole('heading', { name: 'Cara a cara' })).toBeVisible()
  await expect(page.getByText('Mercados simulados')).toBeVisible()
  // Con perfiles del top del ranking, el panel completo debe renderizar
  await expect(page.getByText('prob. de victoria')).toBeVisible()
  await expect(page.getByText('Marcador (sets)')).toBeVisible()
  await expect(page.getByText('Juegos totales')).toBeVisible()
  await expect(page.getByText('Hándicap de juegos')).toBeVisible()
  await expect(page.getByText(/Sin cuotas/)).toBeVisible()
})

test('tenis: dashboard raíz muestra la franja ATP', async ({ page }) => {
  await page.goto('/dashboard')
  const strip = page.getByRole('region', { name: 'Tenis ATP' })
  await expect(strip).toBeVisible()
  await expect(strip.getByText('Cabeza del ranking')).toBeVisible()
  await expect(strip.getByRole('link', { name: /hub del tenis/ })).toBeVisible()
})

test('tenis: buscador global encuentra tenistas', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Buscar equipo o competición' }).click()
  await expect(page.getByRole('dialog', { name: 'Buscador global' })).toBeVisible()
  // Un apellido presente en cualquier histórico ATP reciente
  await page.getByPlaceholder('Buscar equipo o competición…').fill('Alcaraz')
  await expect(page.getByText('Tenistas')).toBeVisible({ timeout: 10_000 })
  const player = page.getByRole('button', { name: /Alcaraz/ }).first()
  await expect(player).toBeVisible()
})
