import { test, expect } from '@playwright/test'

/**
 * Wait for Rive to finish loading by watching console logs.
 * The status element text gets overwritten by state changes before
 * Playwright can reliably catch "Loaded", so we listen for the
 * console log that rive-test.ts emits on load.
 */
async function waitForRiveLoad(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(() => {
    // __riveCharacter is set in the onLoad callback
    return (window as any).__riveCharacter != null
  }, { timeout: 15_000 })
}

test.describe('Rive character rendering', () => {
  test('loads without Rive/WASM console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text().toLowerCase()
        if (text.includes('rive') || text.includes('wasm')) {
          errors.push(msg.text())
        }
      }
    })

    await page.goto('/rive-test.html')
    await waitForRiveLoad(page)

    // No rive/wasm errors
    expect(errors).toEqual([])
  })

  test('renders non-blank content to canvas', async ({ page }) => {
    await page.goto('/rive-test.html')
    await waitForRiveLoad(page)

    // Wait for Rive async render — needs at least a couple frames
    await page.waitForTimeout(2_000)

    const canvas = page.locator('#rive-canvas')
    await expect(canvas).toBeVisible()

    // Primary check: count non-transparent pixels via canvas pixel data
    const nonTransparentPixels = await page.evaluate(() => {
      const c = document.getElementById('rive-canvas') as HTMLCanvasElement
      const ctx = c.getContext('2d')
      if (!ctx) return -1
      const imageData = ctx.getImageData(0, 0, c.width, c.height)
      let count = 0
      // Check alpha channel (every 4th byte starting at index 3)
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) count++
      }
      return count
    })

    // Rive uses its own WebGL/Canvas2D context — getImageData on a 2D context
    // may return all-transparent if Rive is using WebGL. In that case, fall
    // back to screenshot file-size check.
    if (nonTransparentPixels > 1_000) {
      expect(nonTransparentPixels).toBeGreaterThan(1_000)
    } else {
      // Fallback: element screenshot file size (blank ≈ 2KB, rendered > 10KB)
      const screenshot = await canvas.screenshot()
      expect(screenshot.byteLength).toBeGreaterThan(5_000)
    }
  })

  test('exposes __riveCharacter on window', async ({ page }) => {
    await page.goto('/rive-test.html')
    await waitForRiveLoad(page)

    const hasCharacter = await page.evaluate(() => {
      return typeof (window as any).__riveCharacter === 'object' &&
        (window as any).__riveCharacter !== null
    })
    expect(hasCharacter).toBe(true)
  })
})
