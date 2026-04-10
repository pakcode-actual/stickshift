import { test, expect } from '@playwright/test'

/**
 * Visual regression baselines for Rive animation states.
 *
 * Screenshots the rive-test.html canvas at four scroll positions
 * corresponding to distinct character states:
 *   0%  → Stand (idle)
 *   33% → Walk
 *   66% → Jump (celebrate)
 *  100% → Jump (end)
 *
 * Generate baselines on Linux (PKX) for CI consistency — macOS
 * font/canvas rendering produces different pixel output.
 *
 * Rive animations have non-deterministic idle behaviors, so we
 * screenshot during known state transitions (not idle loops).
 * The 5% tolerance handles anti-aliasing differences across platforms.
 */

const HUD_MASK_SELECTOR = '#hud'

/** Scroll down in small increments for ScrollTrigger compatibility. */
async function smoothScroll(page: import('@playwright/test').Page, deltaY: number, steps = 10) {
  const stepSize = deltaY / steps
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepSize)
    await page.waitForTimeout(80)
  }
}

/** Wait for Rive state change + animation to settle. */
async function waitForSettle(page: import('@playwright/test').Page) {
  await page.waitForTimeout(2000)
}

test.describe('Visual regression: Rive animation states', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/rive-test.html')

    // Wait for Rive to load and wire ScrollTrigger
    await expect(page.locator('#status')).toContainText('ScrollTrigger wired', {
      timeout: 15_000,
    })
  })

  test('state 0% — Stand (idle)', async ({ page }) => {
    await waitForSettle(page)

    await expect(page).toHaveScreenshot('rive-00-stand.png', {
      maxDiffPixelRatio: 0.05,
      mask: [page.locator(HUD_MASK_SELECTOR)],
    })
  })

  test('state 33% — Walk', async ({ page }) => {
    // Scroll to ~33% progress to trigger Walk state
    await smoothScroll(page, 1200, 15)
    await waitForSettle(page)

    await expect(page).toHaveScreenshot('rive-33-walk.png', {
      maxDiffPixelRatio: 0.05,
      mask: [page.locator(HUD_MASK_SELECTOR)],
    })
  })

  test('state 66% — Jump (celebrate)', async ({ page }) => {
    // Scroll to ~66% progress to trigger Jump state
    await smoothScroll(page, 2400, 25)
    await waitForSettle(page)

    await expect(page).toHaveScreenshot('rive-66-jump.png', {
      maxDiffPixelRatio: 0.05,
      mask: [page.locator(HUD_MASK_SELECTOR)],
    })
  })

  test('state 100% — end', async ({ page }) => {
    // Scroll to the very end
    await smoothScroll(page, 5000, 40)
    await waitForSettle(page)

    await expect(page).toHaveScreenshot('rive-100-end.png', {
      maxDiffPixelRatio: 0.05,
      mask: [page.locator(HUD_MASK_SELECTOR)],
    })
  })
})
