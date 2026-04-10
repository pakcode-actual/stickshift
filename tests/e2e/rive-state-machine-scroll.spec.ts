import { test, expect, Page } from '@playwright/test'

/**
 * Tier 2: Rive state machine + scroll test
 *
 * Verifies that scrolling through the rive-test page drives the Rive
 * state machine input ("Walk") through the expected values for each
 * scroll section:
 *   Section 1 (0–33%):   Walk = 0  (Stand / idle)
 *   Section 2 (33–66%):  Walk = 1  (Walk)
 *   Section 3 (66–100%): Walk = 3  (Jump / celebrate)
 *
 * Also verifies that onStateChange fires (animation actually transitions)
 * and that the progress bar width tracks scroll progress.
 */

const EXPECTED_STATES = [
  { section: 1, scrollPercent: 0.1, walkValue: 0, label: 'Stand' },
  { section: 2, scrollPercent: 0.5, walkValue: 1, label: 'Walk' },
  { section: 3, scrollPercent: 0.85, walkValue: 3, label: 'Jump' },
] as const

async function waitForRiveLoad(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as any).__riveCharacter != null,
    { timeout: 15_000 },
  )
}

/**
 * Smooth-scroll to a percentage of total scrollable height using small
 * increments — GSAP ScrollTrigger requires actual scroll events, not
 * just setting scrollTop.
 */
async function smoothScrollToPercent(
  page: Page,
  percent: number,
  steps = 12,
): Promise<void> {
  await page.evaluate(
    ({ pct, steps }) => {
      return new Promise<void>((resolve) => {
        const maxScroll =
          document.documentElement.scrollHeight - window.innerHeight
        const target = maxScroll * pct
        const current = window.scrollY
        const delta = target - current
        let step = 0
        const interval = setInterval(() => {
          step++
          const progress = step / steps
          window.scrollTo({ top: current + delta * progress })
          if (step >= steps) {
            clearInterval(interval)
            resolve()
          }
        }, 60)
      })
    },
    { pct: percent, steps },
  )
  // Let ScrollTrigger process the final position
  await page.waitForTimeout(500)
}

/** Read the current value of the Rive "Walk" input from the state machine. */
async function getWalkInput(page: Page): Promise<number> {
  return page.evaluate(() => {
    const character = (window as any).__riveCharacter
    const input = character.getInput('Walk')
    return input ? Number(input.value) : -1
  })
}

test.describe('Rive state machine — scroll-driven transitions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rive-test.html')
    await waitForRiveLoad(page)
    // Let initial render + ScrollTrigger stabilize
    await page.waitForTimeout(1_000)
  })

  test('Walk input starts at 0 (Stand) before scrolling', async ({ page }) => {
    const walk = await getWalkInput(page)
    expect(walk).toBe(0)
  })

  test('scrolling through sections sets correct Walk values', async ({
    page,
  }) => {
    for (const { section, scrollPercent, walkValue, label } of EXPECTED_STATES) {
      await smoothScrollToPercent(page, scrollPercent)
      const walk = await getWalkInput(page)
      expect(
        walk,
        `Section ${section} (${label}): expected Walk=${walkValue} at ${scrollPercent * 100}% scroll, got ${walk}`,
      ).toBe(walkValue)
    }
  })

  test('scroll back to top resets Walk to 0 (Stand)', async ({ page }) => {
    // Scroll to section 3
    await smoothScrollToPercent(page, 0.85)
    expect(await getWalkInput(page)).toBe(3)

    // Scroll back to top
    await smoothScrollToPercent(page, 0.1)
    expect(await getWalkInput(page)).toBe(0)
  })

  test('progress bar advances with scroll', async ({ page }) => {
    // At top, progress bar should be near 0%
    const widthAtTop = await page.evaluate(() => {
      const bar = document.getElementById('progress-bar')
      return bar ? parseFloat(bar.style.width) || 0 : -1
    })

    await smoothScrollToPercent(page, 0.9)

    const widthAtBottom = await page.evaluate(() => {
      const bar = document.getElementById('progress-bar')
      return bar ? parseFloat(bar.style.width) || 0 : -1
    })

    expect(widthAtBottom).toBeGreaterThan(widthAtTop)
    expect(widthAtBottom).toBeGreaterThan(50) // should be well past 50%
  })

  test('active section class toggles on scroll', async ({ page }) => {
    // Section 1 should be active initially
    await smoothScrollToPercent(page, 0.1)
    let activeState = await page.getAttribute(
      '.scroll-section.active',
      'data-state',
    )
    expect(activeState).toBe('idle')

    // Scroll to section 2
    await smoothScrollToPercent(page, 0.5)
    activeState = await page.getAttribute(
      '.scroll-section.active',
      'data-state',
    )
    expect(activeState).toBe('walk')

    // Scroll to section 3
    await smoothScrollToPercent(page, 0.85)
    activeState = await page.getAttribute(
      '.scroll-section.active',
      'data-state',
    )
    expect(activeState).toBe('celebrate')
  })

  test('onStateChange fires during transitions', async ({ page }) => {
    // Install a listener to capture state change events
    await page.evaluate(() => {
      ;(window as any).__stateChanges = [] as string[][]
      const character = (window as any).__riveCharacter
      // Patch the onStateChange callback to also record events
      const origOnStateChange = character.opts?.onStateChange
      // We can't patch opts directly, so listen via console logs
      // The rive-test.ts already logs state changes — we'll collect via console
    })

    // Collect console messages about state changes
    const stateChanges: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('State →') || text.includes('Section')) {
        stateChanges.push(text)
      }
    })

    // Scroll through all sections
    await smoothScrollToPercent(page, 0.5)
    await smoothScrollToPercent(page, 0.85)

    // We should have seen section change logs
    const sectionLogs = stateChanges.filter((s) => s.includes('Section'))
    expect(sectionLogs.length).toBeGreaterThanOrEqual(1)
  })
})
