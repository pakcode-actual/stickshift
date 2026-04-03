import { test, expect } from '@playwright/test'

/**
 * Visual regression tests for key scroll positions.
 *
 * NOTE: Do not run these locally to generate baselines — font rendering
 * differs between macOS and Linux/CI. Generate baselines in CI instead.
 *
 * The HUD (#hud) is masked because the FPS counter changes every frame
 * and would cause false diff failures.
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

/** Wait for physics + animations to settle after scrolling. */
async function waitForSettle(page: import('@playwright/test').Page) {
  // Wait for a couple of animation frames to let physics + GSAP stabilize
  await page.waitForTimeout(1500)
}

test.describe('Visual regression: scroll states', () => {
  test.beforeEach(async ({ page }) => {
    // Use a consistent viewport
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await expect(page.locator('#hud')).toContainText(/\d+ fps/, { timeout: 15_000 })
  })

  test('initial state — hero spacer visible', async ({ page }) => {
    await waitForSettle(page)

    await expect(page).toHaveScreenshot('01-initial-state.png', {
      mask: [page.locator(HUD_MASK_SELECTOR)],
    })
  })

  test('scene 1 — first scene active', async ({ page }) => {
    // Scroll past the spacer into scene 1
    await smoothScroll(page, 600)
    await waitForSettle(page)

    await expect(page).toHaveScreenshot('02-scene-1-active.png', {
      mask: [page.locator(HUD_MASK_SELECTOR)],
    })
  })

  test('scene midpoint — mid-journey', async ({ page }) => {
    // Scroll roughly halfway through
    await smoothScroll(page, 2000, 25)
    await waitForSettle(page)

    await expect(page).toHaveScreenshot('03-scene-midpoint.png', {
      mask: [page.locator(HUD_MASK_SELECTOR)],
    })
  })

  test('end state — scrolled to bottom', async ({ page }) => {
    // Scroll to the very end
    await smoothScroll(page, 5000, 40)
    await waitForSettle(page)

    await expect(page).toHaveScreenshot('04-end-state.png', {
      mask: [page.locator(HUD_MASK_SELECTOR)],
    })
  })
})
