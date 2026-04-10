import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Rive page — Accessibility audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rive-test.html')
    // Wait for Rive to load (status updates from "Loading..." to something else)
    await expect(page.locator('#status')).not.toContainText('Loading', {
      timeout: 15_000,
    })
  })

  test('full axe audit — initial load', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze()

    // Log all violations for the audit report
    for (const v of results.violations) {
      console.log(
        `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} instances)`
      )
      for (const node of v.nodes) {
        console.log(`  → ${node.target.join(' > ')}`)
        console.log(`    ${node.failureSummary}`)
      }
    }

    // Log incomplete (needs-review) items
    if (results.incomplete.length > 0) {
      console.log('\n--- Needs review ---')
      for (const inc of results.incomplete) {
        console.log(
          `[review] ${inc.id}: ${inc.help} (${inc.nodes.length} instances)`
        )
      }
    }

    console.log(`\nTotal violations: ${results.violations.length}`)
    console.log(`Total passes: ${results.passes.length}`)
    console.log(`Needs review: ${results.incomplete.length}`)

    // Assert zero critical/serious violations
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(
      serious,
      `Critical/serious a11y violations: ${serious.map((v) => v.id).join(', ')}`
    ).toHaveLength(0)
  })

  test('axe audit — after scrolling through sections', async ({ page }) => {
    // Scroll through all three sections
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, 200)
      await page.waitForTimeout(50)
    }
    await page.waitForTimeout(500)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    for (const v of results.violations) {
      console.log(
        `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} instances)`
      )
      for (const node of v.nodes) {
        console.log(`  → ${node.target.join(' > ')}`)
      }
    }

    console.log(`\nTotal violations: ${results.violations.length}`)

    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(
      serious,
      `Critical/serious a11y violations after scroll: ${serious.map((v) => v.id).join(', ')}`
    ).toHaveLength(0)
  })

  test('canvas has accessible alternative', async ({ page }) => {
    const canvas = page.locator('#rive-canvas')
    // Canvas should have a role or aria-label for screen readers
    const hasRole = await canvas.getAttribute('role')
    const hasAriaLabel = await canvas.getAttribute('aria-label')
    const hasAriaLabelledBy = await canvas.getAttribute('aria-labelledby')

    console.log(
      `Canvas accessibility: role=${hasRole}, aria-label=${hasAriaLabel}, aria-labelledby=${hasAriaLabelledBy}`
    )

    // Report — canvas should have some accessible name
    expect(
      hasRole || hasAriaLabel || hasAriaLabelledBy,
      'Canvas element should have an accessible role or label'
    ).toBeTruthy()
  })

  test('scroll sections have proper semantics', async ({ page }) => {
    const sections = page.locator('.scroll-section')
    const count = await sections.count()

    for (let i = 0; i < count; i++) {
      const section = sections.nth(i)
      const tagName = await section.evaluate((el) => el.tagName.toLowerCase())
      const hasHeading =
        (await section.locator('h1, h2').count()) > 0
      console.log(
        `Section ${i}: tag=${tagName}, hasHeading=${hasHeading}`
      )
    }

    // All sections should use semantic <section> tag
    for (let i = 0; i < count; i++) {
      const tagName = await sections
        .nth(i)
        .evaluate((el) => el.tagName.toLowerCase())
      expect(tagName).toBe('section')
    }
  })

  test('page has proper keyboard navigation', async ({ page }) => {
    // Tab through focusable elements
    const focusableElements: string[] = []
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => {
        const el = document.activeElement
        return el
          ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ')[0] : ''}`
          : 'none'
      })
      focusableElements.push(focused)
    }
    console.log('Tab order:', focusableElements.join(' → '))
  })

  test('reduced motion is respected', async ({ page }) => {
    // Emulate prefers-reduced-motion
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/rive-test.html')
    await expect(page.locator('#status')).not.toContainText('Loading', {
      timeout: 15_000,
    })

    // Page should still be functional with reduced motion
    const status = await page.locator('#status').textContent()
    console.log(`Status with reduced-motion: ${status}`)

    // Check if transitions are disabled
    const hasTransitions = await page.evaluate(() => {
      const sections = document.querySelectorAll('.scroll-section')
      let transitionFound = false
      sections.forEach((s) => {
        const style = getComputedStyle(s)
        if (
          style.transition &&
          style.transition !== 'none' &&
          style.transitionDuration !== '0s'
        ) {
          transitionFound = true
        }
      })
      return transitionFound
    })
    console.log(`Transitions active with reduced-motion: ${hasTransitions}`)
    expect(
      hasTransitions,
      'Transitions should be disabled with prefers-reduced-motion'
    ).toBe(false)
  })
})
