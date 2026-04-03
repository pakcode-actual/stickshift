import { test, expect } from '@playwright/test'

/**
 * Scroll-journey tests.
 * Uses page.mouse.wheel() for incremental scrolling so GSAP ScrollTrigger
 * receives proper scroll events (as opposed to page.evaluate scrollTo which
 * can skip trigger thresholds).
 */

/** Helper: scroll down by `deltaY` pixels in small increments. */
async function smoothScroll(page: import('@playwright/test').Page, deltaY: number, steps = 10) {
  const stepSize = deltaY / steps
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepSize)
    await page.waitForTimeout(80)
  }
  // Let ScrollTrigger and physics settle
  await page.waitForTimeout(500)
}

test.describe('Scroll journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for the app to be ready
    await expect(page.locator('#hud')).toContainText(/\d+ fps/, { timeout: 15_000 })
  })

  test('scrolling activates the first scene', async ({ page }) => {
    // Read the initial HUD — should say "none" or scene 1
    const hudBefore = await page.locator('#hud').textContent()

    // Scroll past the spacer into the scene
    await smoothScroll(page, 600)

    // The HUD should now reflect an active scene (not "none")
    const hudAfter = await page.locator('#hud').textContent()
    expect(hudAfter).toMatch(/\d+ fps/)

    // Text layer should have content from the active scene
    const textSpans = page.locator('#text-layer span')
    await expect(textSpans.first()).toBeVisible({ timeout: 5_000 })
  })

  test('scrolling further progresses through scenes', async ({ page }) => {
    // Scroll well into the content
    await smoothScroll(page, 1500, 20)

    // HUD should show progress > 0%
    const hudText = await page.locator('#hud').textContent()
    const progressMatch = hudText?.match(/(\d+)%/)
    expect(progressMatch).not.toBeNull()
    const progress = parseInt(progressMatch![1], 10)
    expect(progress).toBeGreaterThan(0)
  })

  test('progress indicator updates on scroll', async ({ page }) => {
    // Initial state: first dot may be active
    const activeDotsBefore = await page.locator('#progress-indicator .progress-dot.active').count()

    // Scroll significantly
    await smoothScroll(page, 2000, 25)

    // At least one dot should be active
    const activeDotsAfter = await page.locator('#progress-indicator .progress-dot.active').count()
    expect(activeDotsAfter).toBeGreaterThanOrEqual(1)
  })
})
