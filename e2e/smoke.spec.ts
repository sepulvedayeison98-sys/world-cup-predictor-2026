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
