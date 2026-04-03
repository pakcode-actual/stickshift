import { test, expect } from '@playwright/test'

declare global {
  interface Window {
    __physicsHash?: string
    __stepAndHash?: (frames: number) => Promise<string>
  }
}

test.describe('Physics determinism', () => {
  const FRAME_COUNT = 120

  async function getHashForScene(page: any, beatId: string, frames: number): Promise<string> {
    await page.goto('/sandbox.html')
    await page.waitForFunction(() => typeof window.__stepAndHash === 'function', {
      timeout: 15_000,
    })

    // Select the scene (needed so __stepAndHash knows which beat to reload)
    await page.selectOption('#beat-selector', beatId)
    await page.waitForTimeout(100)

    // Run the deterministic step+hash (internally reloads the scene from clean state)
    const hash = await page.evaluate(async (f: number) => {
      return window.__stepAndHash!(f)
    }, frames)

    return hash
  }

  test('physics simulation produces identical hashes across two runs', async ({ page }) => {
    // Run 1
    const hash1 = await getHashForScene(page, 'the-fall', FRAME_COUNT)
    expect(hash1).toBeTruthy()
    expect(hash1).toMatch(/^[0-9a-f]{64}$/)

    // Verify window.__physicsHash was set
    const windowHash1 = await page.evaluate(() => window.__physicsHash)
    expect(windowHash1).toBe(hash1)

    // Run 2 — full page reload
    const hash2 = await getHashForScene(page, 'the-fall', FRAME_COUNT)

    // Hashes must be identical
    expect(hash2).toBe(hash1)
  })

  test('hash changes when running different frame counts', async ({ page }) => {
    const hash120 = await getHashForScene(page, 'the-fall', 120)
    const hash60 = await getHashForScene(page, 'the-fall', 60)

    // Different frame counts should produce different hashes
    expect(hash60).not.toBe(hash120)
  })
})
