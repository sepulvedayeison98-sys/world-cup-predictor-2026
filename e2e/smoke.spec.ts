import { test, expect } from '@playwright/test'

/**
 * Humo de los flujos críticos. Diseñados para NO depender de datos del día
 * (los partidos cambian a diario): verifican estructura, no contenido.
 */

test('la raíz redirige al dashboard y renderiza los widgets núcleo', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Panel de Inteligencia' })).toBeVisible()
  await expect(page.getByText('Cuadro Eliminatorio')).toBeVisible()
  await expect(page.getByText('Rendimiento del Modelo')).toBeVisible()
  // Sin desborde horizontal en móvil (regresión del fix de overflow)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
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
