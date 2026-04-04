import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

declare global {
  interface Window {
    __deterministicCapture?: (
      totalFrames: number,
      captureEvery: number
    ) => Promise<Array<{ frame: number; timestamp: number; hash: string; dataUrl: string }>>
  }
}

const CAPTURES_DIR = path.resolve(__dirname, '../../captures')
const TOTAL_FRAMES = 300
const CAPTURE_EVERY = 10

const SCENES = [
  { id: 'the-fall', label: 'The Fall' },
  { id: 'the-kick', label: 'The Kick' },
  { id: 'the-climb', label: 'The Climb' },
  { id: 'the-lecture', label: 'The Lecture' },
  { id: 'the-celebration', label: 'The Celebration' },
]

test.describe('Frame capture pipeline', () => {
  test.beforeAll(() => {
    fs.mkdirSync(CAPTURES_DIR, { recursive: true })
  })

  for (const scene of SCENES) {
    test(`capture and verify determinism for ${scene.label}`, async ({
      page,
    }) => {
      // ── Run 1: Playwright element screenshots (visible to vision models) ──
      await page.goto('/sandbox.html')
      await page.setViewportSize({ width: 1280, height: 720 })

      await page.waitForFunction(
        () => typeof window.__deterministicCapture === 'function',
        { timeout: 15_000 }
      )

      await page.selectOption('#beat-selector', scene.id)
      await page.waitForTimeout(200)

      // Step frame-by-frame using the sandbox Step button
      // and capture Playwright element screenshots at intervals
      const canvasEl = page.locator('#sandbox-canvas')

      for (let i = 0; i < TOTAL_FRAMES; i++) {
        await page.click('#btn-step')

        if ((i + 1) % CAPTURE_EVERY === 0) {
          const filename = `${scene.id}-frame-${i + 1}.png`
          const filepath = path.join(CAPTURES_DIR, filename)
          await canvasEl.screenshot({ path: filepath })
        }
      }

      // ── Run 2: Hash-based determinism verification ──
      // Reload for a clean physics state
      await page.goto('/sandbox.html')
      await page.waitForFunction(
        () => typeof window.__deterministicCapture === 'function',
        { timeout: 15_000 }
      )
      await page.selectOption('#beat-selector', scene.id)
      await page.waitForTimeout(200)

      // Get hashes from run 1 (clean deterministic capture)
      const run1 = await page.evaluate(
        async ([frames, interval]: [number, number]) => {
          const results = await window.__deterministicCapture!(frames, interval)
          return results.map((r) => ({ frame: r.frame, hash: r.hash }))
        },
        [TOTAL_FRAMES, CAPTURE_EVERY] as [number, number]
      )

      // Reload and verify hashes match
      await page.goto('/sandbox.html')
      await page.waitForFunction(
        () => typeof window.__deterministicCapture === 'function',
        { timeout: 15_000 }
      )
      await page.selectOption('#beat-selector', scene.id)
      await page.waitForTimeout(200)

      const run2 = await page.evaluate(
        async ([frames, interval]: [number, number]) => {
          const results = await window.__deterministicCapture!(frames, interval)
          return results.map((r) => ({ frame: r.frame, hash: r.hash }))
        },
        [TOTAL_FRAMES, CAPTURE_EVERY] as [number, number]
      )

      expect(run1.length).toBe(TOTAL_FRAMES / CAPTURE_EVERY)
      expect(run2.length).toBe(run1.length)

      for (let i = 0; i < run1.length; i++) {
        expect(run2[i].hash).toBe(run1[i].hash)
      }

      // Export metadata
      const metadata = run1.map((c) => ({
        frame: c.frame,
        physicsHash: c.hash,
      }))

      fs.writeFileSync(
        path.join(CAPTURES_DIR, `${scene.id}-metadata.json`),
        JSON.stringify(metadata, null, 2)
      )
    })
  }
})
