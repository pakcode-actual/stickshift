import { test } from '@playwright/test'

test('debug ragdoll rendering', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER:', msg.text()))
  
  await page.goto('/sandbox.html')
  await page.setViewportSize({ width: 1280, height: 720 })
  
  await page.waitForFunction(
    () => typeof (window as any).__deterministicCapture === 'function',
    { timeout: 15_000 }
  )

  await page.selectOption('#beat-selector', 'the-fall')
  await page.waitForTimeout(200)
  
  // Click play a few times and take a screenshot via Playwright (not canvas)
  await page.click('#btn-step')
  await page.waitForTimeout(50)
  await page.click('#btn-step')
  await page.waitForTimeout(50)
  await page.click('#btn-step')
  await page.waitForTimeout(50)
  
  // Take a Playwright screenshot (captures the entire page, not just canvas)
  await page.screenshot({ path: 'captures/debug-page-screenshot.png' })
  
  // Also take just the canvas element
  const canvas = page.locator('#sandbox-canvas')
  await canvas.screenshot({ path: 'captures/debug-canvas-screenshot.png' })
  
  console.log('Screenshots saved')
})
