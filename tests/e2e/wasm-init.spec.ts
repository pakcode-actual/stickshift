import { test, expect } from '@playwright/test'

test.describe('Rapier WASM initialization', () => {
  test('page loads without errors and physics initializes', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/')

    // Wait for the physics canvas to be present (signals main() completed)
    const canvas = page.locator('#physics-canvas')
    await expect(canvas).toBeVisible({ timeout: 15_000 })

    // Wait for the HUD to show an FPS reading — proves the game loop is running
    await expect(page.locator('#hud')).toContainText(/\d+ fps/, { timeout: 10_000 })

    // No uncaught errors during init
    expect(errors).toEqual([])
  })

  test('scene container and text layer exist', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#scene-container')).toBeVisible()
    await expect(page.locator('#text-layer')).toBeVisible()
  })

  test('progress indicator renders scene dots', async ({ page }) => {
    await page.goto('/')
    // Wait for game loop to populate progress dots
    await expect(page.locator('#hud')).toContainText(/\d+ fps/, { timeout: 10_000 })

    const dots = page.locator('#progress-indicator .progress-dot')
    await expect(dots.first()).toBeVisible()
    expect(await dots.count()).toBeGreaterThanOrEqual(1)
  })
})
