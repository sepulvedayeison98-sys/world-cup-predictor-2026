import { test, expect } from '@playwright/test'

/**
 * Humo de los flujos críticos. Diseñados para NO depender de datos del día
 * (los partidos cambian a diario): verifican estructura, no contenido.
 */

test('la raíz redirige al inicio global y renderiza los bloques núcleo', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Panel de Inteligencia' })).toBeVisible()
  await expect(page.getByText('Hoy en juego')).toBeVisible()
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
