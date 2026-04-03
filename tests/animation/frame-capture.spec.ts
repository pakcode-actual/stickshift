import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface FrameCapture {
  frame: number
  timestamp: number
  hash: string
  dataUrl: string
}

declare global {
  interface Window {
    __deterministicCapture?: (
      totalFrames: number,
      captureEvery: number
    ) => Promise<FrameCapture[]>
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

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
  return Buffer.from(base64, 'base64')
}

async function captureScene(
  page: any,
  sceneId: string
): Promise<FrameCapture[]> {
  await page.goto('/sandbox.html')
  await page.setViewportSize({ width: 1280, height: 720 })

  // Wait for sandbox to initialize
  await page.waitForFunction(
    () => typeof window.__deterministicCapture === 'function',
    { timeout: 15_000 }
  )

  // Select scene via dropdown
  await page.selectOption('#beat-selector', sceneId)
  await page.waitForTimeout(200)

  // Click step button to verify UI interaction works (btn-step)
  await page.click('#btn-step')
  await page.waitForTimeout(50)

  // Run deterministic capture sequence
  const captures: FrameCapture[] = await page.evaluate(
    async ([frames, interval]: [number, number]) => {
      return window.__deterministicCapture!(frames, interval)
    },
    [TOTAL_FRAMES, CAPTURE_EVERY] as [number, number]
  )

  return captures
}

test.describe('Frame capture pipeline', () => {
  test.beforeAll(() => {
    fs.mkdirSync(CAPTURES_DIR, { recursive: true })
  })

  for (const scene of SCENES) {
    test(`capture and verify determinism for ${scene.label}`, async ({
      page,
    }) => {
      // Run 1 — capture frames
      const run1 = await captureScene(page, scene.id)
      expect(run1.length).toBe(TOTAL_FRAMES / CAPTURE_EVERY)

      // Save Run 1 frames to disk
      for (const capture of run1) {
        const filename = `${scene.id}-frame-${capture.frame}.png`
        const filepath = path.join(CAPTURES_DIR, filename)
        fs.writeFileSync(filepath, dataUrlToBuffer(capture.dataUrl))
      }

      // Run 2 — full page reload for clean state
      const run2 = await captureScene(page, scene.id)
      expect(run2.length).toBe(run1.length)

      // Assert pixel-identical screenshots (determinism proof)
      for (let i = 0; i < run1.length; i++) {
        const buf1 = dataUrlToBuffer(run1[i].dataUrl)
        const buf2 = dataUrlToBuffer(run2[i].dataUrl)

        expect(
          buf1.equals(buf2),
          `Frame ${run1[i].frame} of ${scene.id} differs between runs`
        ).toBe(true)

        // Physics hashes must also match
        expect(run2[i].hash).toBe(run1[i].hash)
      }

      // Export frame sequence metadata as JSON
      const metadata = run1.map((c) => ({
        frame: c.frame,
        timestamp: c.timestamp,
        physicsHash: c.hash,
      }))

      const metadataPath = path.join(
        CAPTURES_DIR,
        `${scene.id}-metadata.json`
      )
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
    })
  }
})
