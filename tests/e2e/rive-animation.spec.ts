import { test, expect, Page } from '@playwright/test'

/**
 * Tier 2 animation test — verify scroll produces visually different states.
 *
 * Takes screenshots at 3 scroll positions (0%, 50%, 100%) and asserts
 * that at least 2 of the 3 pairs differ, catching the "just bouncing" bug
 * where the character looks identical regardless of scroll position.
 */

async function waitForRiveLoad(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    return (window as any).__riveCharacter != null
  }, { timeout: 15_000 })
}

/** Scroll the page to a percentage of total scrollable height. */
async function scrollToPercent(page: Page, percent: number): Promise<void> {
  await page.evaluate((pct) => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: maxScroll * pct, behavior: 'instant' })
  }, percent)
}

/** Take a screenshot of the Rive canvas element. */
async function screenshotCanvas(page: Page): Promise<Buffer> {
  const canvas = page.locator('#rive-canvas')
  return await canvas.screenshot()
}

/**
 * Count the fraction of bytes that differ between two PNG buffers.
 * This is a rough proxy for pixel difference — sufficient to distinguish
 * "completely identical" from "visually different animation states".
 */
function bufferDiffRatio(a: Buffer, b: Buffer): number {
  const len = Math.max(a.length, b.length)
  if (len === 0) return 0
  let diffs = 0
  for (let i = 0; i < len; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) diffs++
  }
  return diffs / len
}

test.describe('Rive animation — scroll-driven state changes', () => {
  test('state machine has at least 1 input', async ({ page }) => {
    await page.goto('/rive-test.html')
    await waitForRiveLoad(page)

    const inputNames: string[] = await page.evaluate(() => {
      return (window as any).__riveCharacter.getInputNames()
    })

    expect(inputNames.length).toBeGreaterThanOrEqual(1)
  })

  test('scroll produces visually different states', async ({ page }) => {
    await page.goto('/rive-test.html')
    await waitForRiveLoad(page)

    // Wait for initial render to stabilize
    await page.waitForTimeout(1_500)

    // Screenshot at 0% scroll
    await scrollToPercent(page, 0)
    await page.waitForTimeout(1_000)
    const shot0 = await screenshotCanvas(page)

    // Screenshot at 50% scroll
    await scrollToPercent(page, 0.5)
    await page.waitForTimeout(1_000)
    const shot50 = await screenshotCanvas(page)

    // Screenshot at 100% scroll
    await scrollToPercent(page, 1.0)
    await page.waitForTimeout(1_000)
    const shot100 = await screenshotCanvas(page)

    // Compare each pair
    const diff_0_50 = bufferDiffRatio(shot0, shot50)
    const diff_0_100 = bufferDiffRatio(shot0, shot100)
    const diff_50_100 = bufferDiffRatio(shot50, shot100)

    const threshold = 0.05 // 5% byte difference
    const pairsAboveThreshold = [diff_0_50, diff_0_100, diff_50_100]
      .filter((d) => d > threshold).length

    // At least 2 of 3 pairs must differ — catches "just bouncing" bug
    expect(
      pairsAboveThreshold,
      `Expected at least 2 screenshot pairs to differ by >${threshold * 100}% ` +
      `but got ${pairsAboveThreshold}. Diffs: 0↔50=${(diff_0_50 * 100).toFixed(1)}%, ` +
      `0↔100=${(diff_0_100 * 100).toFixed(1)}%, 50↔100=${(diff_50_100 * 100).toFixed(1)}%`
    ).toBeGreaterThanOrEqual(2)
  })
})
