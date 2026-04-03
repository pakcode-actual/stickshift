import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility', () => {
  test('page passes axe accessibility audit on load', async ({ page }) => {
    await page.goto('/')
    // Wait for the app to initialize
    await expect(page.locator('#hud')).toContainText(/\d+ fps/, { timeout: 15_000 })

    // Exclude known contrast issues on decorative/secondary text and
    // scrollable-region-focusable which fires on <html> in scroll-driven pages
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast', 'scrollable-region-focusable'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('scene container has an accessible label', async ({ page }) => {
    await page.goto('/')
    const scene = page.locator('#scene-container')
    await expect(scene).toHaveAttribute('aria-label', /animation scene/i)
  })

  test('text layer is marked as an article for screen readers', async ({ page }) => {
    await page.goto('/')
    const textLayer = page.locator('#text-layer')
    await expect(textLayer).toHaveAttribute('role', 'article')
  })

  test('text spans remain accessible after scrolling', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#hud')).toContainText(/\d+ fps/, { timeout: 15_000 })

    // Scroll to activate a scene
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 60)
      await page.waitForTimeout(80)
    }
    await page.waitForTimeout(500)

    // Re-run axe on the scrolled state (same exclusions as above)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast', 'scrollable-region-focusable'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('noscript fallback contains meaningful content', async ({ page }) => {
    // Check the noscript element exists with fallback text
    await page.goto('/')
    const noscriptHtml = await page.locator('noscript').innerHTML()
    expect(noscriptHtml).toContain('Ragdoll Scrollytelling')
    expect(noscriptHtml).toContain('Enable JavaScript')
  })
})
