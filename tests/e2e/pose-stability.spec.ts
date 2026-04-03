import { test, expect } from '@playwright/test'

/**
 * Tests that the ragdoll achieves stable poses at key scroll positions
 * instead of gyrating/flailing. Reads debug state exposed via window.__ragdollDebug.
 */

/** Scroll down in small increments for ScrollTrigger compatibility. */
async function smoothScroll(page: import('@playwright/test').Page, deltaY: number, steps = 10) {
  const stepSize = deltaY / steps
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepSize)
    await page.waitForTimeout(80)
  }
}

/** Wait for physics to settle after scrolling. */
async function waitForSettle(page: import('@playwright/test').Page) {
  await page.waitForTimeout(2000)
}

interface RagdollDebug {
  torsoX: number
  torsoY: number
  torsoRotation: number
  jointAngles: number[]
  scene: string
  progress: number
}

async function getDebug(page: import('@playwright/test').Page): Promise<RagdollDebug> {
  return page.evaluate(() => (window as any).__ragdollDebug)
}

/**
 * Sample torso rotation over multiple frames to check for stability.
 * Returns the max absolute rotation seen and the standard deviation.
 */
async function measureStability(page: import('@playwright/test').Page, samples = 10, intervalMs = 100) {
  const rotations: number[] = []
  const positions: { x: number; y: number }[] = []
  for (let i = 0; i < samples; i++) {
    const debug = await getDebug(page)
    if (debug) {
      rotations.push(debug.torsoRotation)
      positions.push({ x: debug.torsoX, y: debug.torsoY })
    }
    await page.waitForTimeout(intervalMs)
  }

  const meanRot = rotations.reduce((a, b) => a + b, 0) / rotations.length
  const rotVariance = rotations.reduce((sum, r) => sum + (r - meanRot) ** 2, 0) / rotations.length
  const rotStdDev = Math.sqrt(rotVariance)
  const maxAbsRot = Math.max(...rotations.map(Math.abs))

  return { rotations, positions, meanRot, rotStdDev, maxAbsRot }
}

test.describe('Ragdoll pose stability (STI-5)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await expect(page.locator('#hud')).toContainText(/\d+ fps/, { timeout: 15_000 })
  })

  test('torso stays near-upright during "The Fall" scene', async ({ page }) => {
    // Scroll into scene 1 (The Fall)
    await smoothScroll(page, 400)
    await waitForSettle(page)

    const stability = await measureStability(page)
    // Torso rotation should stay within ~1 radian of upright (not spinning wildly)
    expect(stability.maxAbsRot).toBeLessThan(1.5)
    // Rotation shouldn't be oscillating wildly (std dev < 0.5 rad)
    expect(stability.rotStdDev).toBeLessThan(0.5)
  })

  test('figure holds kick pose in "The Kick" scene', async ({ page }) => {
    // Scroll to scene 2 (The Kick) — need enough scroll to reach 20-40% range
    await smoothScroll(page, 2200, 25)
    await waitForSettle(page)

    const debug = await getDebug(page)
    expect(debug).toBeTruthy()
    expect(debug.scene).toContain('Kick')

    const stability = await measureStability(page)
    // Should be stable, not gyrating
    expect(stability.maxAbsRot).toBeLessThan(1.5)
    expect(stability.rotStdDev).toBeLessThan(0.5)
  })

  test('figure holds climbing pose in "The Climb" scene', async ({ page }) => {
    // Scroll to scene 3 (The Climb)
    await smoothScroll(page, 3200, 35)
    await waitForSettle(page)

    const debug = await getDebug(page)
    expect(debug).toBeTruthy()

    const stability = await measureStability(page)
    // Climbing involves some natural body tilt, so allow slightly more rotation
    expect(stability.maxAbsRot).toBeLessThan(2.0)
    expect(stability.rotStdDev).toBeLessThan(0.5)
  })

  test('figure holds lecture pose in "The Lecture" scene', async ({ page }) => {
    // Scroll to scene 4 (The Lecture)
    await smoothScroll(page, 4500, 40)
    await waitForSettle(page)

    const debug = await getDebug(page)
    expect(debug).toBeTruthy()

    const stability = await measureStability(page)
    expect(stability.maxAbsRot).toBeLessThan(1.6)
    expect(stability.rotStdDev).toBeLessThan(0.5)
  })

  test('figure holds victory pose in "The Celebration" scene', async ({ page }) => {
    // Scroll to scene 5 (The Celebration)
    await smoothScroll(page, 5800, 50)
    await waitForSettle(page)

    const debug = await getDebug(page)
    expect(debug).toBeTruthy()

    const stability = await measureStability(page)
    // Celebration has confetti particles impacting the ragdoll, allow slightly more tilt
    expect(stability.maxAbsRot).toBeLessThan(2.0)
    expect(stability.rotStdDev).toBeLessThan(0.5)
  })

  test('ragdoll does not fall through the ground', async ({ page }) => {
    // Scroll through all scenes and check torso Y never exceeds ground
    for (const scrollAmount of [400, 1400, 2400, 3400, 4500]) {
      await smoothScroll(page, scrollAmount === 400 ? 400 : scrollAmount - 400, 15)
      await waitForSettle(page)

      const debug = await getDebug(page)
      if (debug && debug.torsoY) {
        // Ground is at sceneHeight - 80 (720 - 80 = 640). Torso should be above it.
        expect(debug.torsoY).toBeLessThan(700)
      }
    }
  })
})
