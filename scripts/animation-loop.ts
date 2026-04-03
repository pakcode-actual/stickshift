#!/usr/bin/env npx tsx
/**
 * Closed-Loop Animation Iteration — STI-7
 *
 * Runs a loop: capture frames → vision critic → adjust params → repeat
 * until animation quality reaches target score or max iterations hit.
 *
 * Usage:
 *   npx tsx scripts/animation-loop.ts <scene-json-path> <description> [--max-iterations N]
 *
 * Env:
 *   Reads auth token from ~/.openclaw/openclaw.json (gateway.auth.token)
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { critiqueAnimation, type CriticResult } from './animation-critic.js'
import { execSync } from 'child_process'
import * as crypto from 'crypto'

// ── OpenClaw auth ─────────────────────────────────────────────────────────

function loadAuthToken(): string {
  const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json')
  const raw = fs.readFileSync(configPath, 'utf-8')
  const config = JSON.parse(raw)
  const token = config?.gateway?.auth?.token
  if (!token) throw new Error('No gateway.auth.token found in ~/.openclaw/openclaw.json')
  return token as string
}

// ── Types ──────────────────────────────────────────────────────────────────

interface IterationLog {
  iteration: number
  params_hash: string
  score: number
  critique: CriticResult
  adjustments_made: string
}

interface SceneBeatJson {
  id: string
  title: string
  beats: Array<{
    scrollRange: [number, number]
    action: string
    target: string
    motorBlend?: number
    motorStiffness?: number
    pose?: string
    impulse?: [number, number]
    easing?: string
    [key: string]: unknown
  }>
  [key: string]: unknown
}

// ── Helpers ────────────────────────────────────────────────────────────────

function hashParams(scene: SceneBeatJson): string {
  const json = JSON.stringify(scene.beats)
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16)
}

function captureFramesViaPlaywright(sceneId: string): string {
  // Run the frame capture test for this specific scene
  // This uses the existing __deterministicCapture API in the sandbox
  const capturesDir = path.resolve(__dirname, '../captures')
  fs.mkdirSync(capturesDir, { recursive: true })

  console.error(`  Capturing frames for scene: ${sceneId}`)

  try {
    execSync(
      `npx playwright test tests/animation/frame-capture.spec.ts -g "${sceneId}" --reporter=list`,
      {
        cwd: path.resolve(__dirname, '..'),
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
      }
    )
  } catch (err: unknown) {
    // Playwright may exit non-zero even on success in some configs
    const error = err as { status?: number; stderr?: Buffer }
    if (error.status && error.status > 1) {
      console.error(`  Warning: Playwright exited with code ${error.status}`)
    }
  }

  return capturesDir
}

async function adjustParams(
  scene: SceneBeatJson,
  critique: CriticResult,
  description: string
): Promise<{ scene: SceneBeatJson; adjustments: string }> {
  const token = loadAuthToken()

  const prompt = `You are tuning a stick figure physics animation. The animation is described as: "${description}"

Current Scene Beat JSON (the "beats" array controls the animation):
${JSON.stringify(scene.beats, null, 2)}

The vision critic scored this animation ${critique.score}/10 and reported these issues:
${JSON.stringify(critique.issues, null, 2)}

Summary: ${critique.summary}

Suggest specific modifications to the beats array to improve the animation quality. You can adjust:
- motorStiffness (higher = snappier pose changes, typical range 30-200)
- motorBlend (0-1, how strongly the motor drives toward the target pose)
- scrollRange timing (adjust when actions start/end)
- impulse vectors (direction and magnitude)

Respond with ONLY valid JSON in this exact format:
{
  "beats": [<the complete modified beats array>],
  "adjustments": "<brief description of what you changed and why>"
}`

  const response = await fetch('http://localhost:18789/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: 'openclaw',
      max_tokens: 2048,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenClaw API error ${response.status}: ${body}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) {
    throw new Error('No text response from model')
  }

  let jsonStr = text.trim()
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) jsonStr = fenceMatch[1].trim()

  const result = JSON.parse(jsonStr) as { beats: SceneBeatJson['beats']; adjustments: string }

  const adjusted = { ...scene, beats: result.beats }
  return { scene: adjusted, adjustments: result.adjustments }
}

// ── Main Loop ──────────────────────────────────────────────────────────────

async function runLoop(
  scenePath: string,
  description: string,
  maxIterations: number
): Promise<void> {
  const capturesDir = path.resolve(__dirname, '../captures')
  const raw = fs.readFileSync(scenePath, 'utf-8')
  let scene = JSON.parse(raw) as SceneBeatJson

  const sceneId = scene.id
  const iterationLog: IterationLog[] = []
  let bestScore = 0
  let bestScene = scene

  console.error(`Starting closed-loop iteration for "${scene.title}" (${sceneId})`)
  console.error(`Target: score >= 7, max iterations: ${maxIterations}`)

  for (let i = 1; i <= maxIterations; i++) {
    console.error(`\n--- Iteration ${i}/${maxIterations} ---`)

    // Write current scene JSON to the source location so sandbox picks it up
    const srcScenePath = path.resolve(__dirname, '..', 'src', 'scenes', path.basename(scenePath))
    fs.writeFileSync(srcScenePath, JSON.stringify(scene, null, 2))

    // Capture frames
    captureFramesViaPlaywright(sceneId)

    // Run vision critic
    console.error(`  Running vision critic...`)
    const critique = await critiqueAnimation(capturesDir, description, sceneId)
    console.error(`  Score: ${critique.score}/10`)
    console.error(`  Summary: ${critique.summary}`)

    const paramsHash = hashParams(scene)

    const entry: IterationLog = {
      iteration: i,
      params_hash: paramsHash,
      score: critique.score,
      critique,
      adjustments_made: i === 1 ? 'initial' : iterationLog[iterationLog.length - 1]?.adjustments_made ?? 'initial',
    }

    if (critique.score > bestScore) {
      bestScore = critique.score
      bestScene = JSON.parse(JSON.stringify(scene))
    }

    if (critique.score >= 7) {
      entry.adjustments_made = 'target score reached'
      iterationLog.push(entry)
      console.error(`\n  Target score reached! (${critique.score}/10)`)
      break
    }

    if (i < maxIterations) {
      // Adjust params using Claude text model
      console.error(`  Adjusting parameters...`)
      const { scene: adjusted, adjustments } = await adjustParams(scene, critique, description)
      entry.adjustments_made = adjustments
      scene = adjusted
      console.error(`  Adjustments: ${adjustments}`)
    }

    iterationLog.push(entry)
  }

  // Save iteration log
  const logPath = path.join(capturesDir, `${sceneId}-iteration-log.json`)
  fs.writeFileSync(logPath, JSON.stringify(iterationLog, null, 2))
  console.error(`\nIteration log saved to: ${logPath}`)

  // Save optimized scene JSON
  const optimizedPath = path.join(capturesDir, `${sceneId}-optimized.json`)
  fs.writeFileSync(optimizedPath, JSON.stringify(bestScene, null, 2))
  console.error(`Optimized scene JSON saved to: ${optimizedPath}`)
  console.error(`Best score: ${bestScore}/10`)

  // Output final result to stdout
  console.log(JSON.stringify({
    bestScore,
    iterations: iterationLog.length,
    logPath,
    optimizedScenePath: optimizedPath,
  }, null, 2))
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  let maxIterations = 5
  const filteredArgs: string[] = []

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-iterations' && i + 1 < args.length) {
      maxIterations = parseInt(args[++i], 10)
    } else {
      filteredArgs.push(args[i])
    }
  }

  if (filteredArgs.length < 2) {
    console.error('Usage: npx tsx scripts/animation-loop.ts [--max-iterations N] <scene-json-path> <description>')
    process.exit(1)
  }

  const [scenePath, ...descParts] = filteredArgs
  const description = descParts.join(' ')

  if (!fs.existsSync(scenePath)) {
    console.error(`Scene file not found: ${scenePath}`)
    process.exit(1)
  }

  await runLoop(scenePath, description, maxIterations)
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
