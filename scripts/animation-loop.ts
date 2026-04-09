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
import { fileURLToPath } from 'url'

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

interface KinematicKeyframe {
  scrollRange: [number, number]
  pose: {
    head: number
    shoulderL: number
    elbowL: number
    shoulderR: number
    elbowR: number
    hipL: number
    kneeL: number
    hipR: number
    kneeR: number
  }
  easing: string
}

interface SceneBeatJson {
  id: string
  title: string
  mode?: string
  keyframes?: KinematicKeyframe[]
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

function isKinematicScene(scene: SceneBeatJson): boolean {
  return scene.mode === 'kinematic' && Array.isArray(scene.keyframes) && scene.keyframes.length > 0
}

function hashParams(scene: SceneBeatJson): string {
  const json = isKinematicScene(scene)
    ? JSON.stringify(scene.keyframes)
    : JSON.stringify(scene.beats)
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

function buildKinematicPrompt(
  scene: SceneBeatJson,
  critique: CriticResult,
  description: string
): string {
  return `You are tuning the KINEMATIC CHOREOGRAPHY of a stick figure animation. The movement sequence is: "${description}"

Current keyframes (each has a scrollRange, a pose with joint angles in radians, and an easing):
${JSON.stringify(scene.keyframes, null, 2)}

Angle reference (all angles in radians, bones default direction is DOWNWARD):
  shoulderL=0: arm hangs down. shoulderL=-π/2: arm horizontal left. shoulderL=-π: arm straight up.
  elbowL is RELATIVE to shoulder. elbowL=0: forearm continues same direction as upper arm.

  Example: shoulderL=-0.8, elbowL=-1.5 → elbow at (13,-2), hand at (37,-23) = W-pose
  Example: shoulderL=-1.8, elbowL=-1.0 → elbow at (21,-31), hand at (32,-61) = air pump
  Example: shoulderL=0.15, elbowL=0 → arm hangs slightly forward = relaxed standing

  hipL=0: leg hangs straight down. hipL=-0.15: slight knee bend (crouch).
  kneeL is RELATIVE to hip. kneeL=-0.3: lower leg bends back slightly.

  Right side mirrors left: shoulderR positive = arm toward right.

COMMON BUGS TO AVOID:
- Elbow-at-zero with active shoulder: If shoulderL != 0, elbowL should NOT be 0 (forearm dangles unnaturally). Give elbows a deliberate angle.
- Shoulder crossing zero: If shoulder transitions from positive to negative (or vice versa), the elbow passes through the body. Add an intermediate keyframe or ensure shoulder stays on one side.
- Foot slide: If hipL or hipR changes during standing poses, feet shift on the ground. Keep hips at 0 during standing/holds.

A critic scored this animation ${critique.score}/10.
Issues:
${JSON.stringify(critique.issues, null, 2)}

Summary: ${critique.summary}

Your job: adjust the keyframes to improve pose readability and transition quality. You can tune:
- pose angles (all 9 joint angles per keyframe)
- scrollRange timing (when each pose starts/ends)
- easing functions ("none", "power2.inOut", "power2.out", etc.)

You CANNOT change: gravity, mass, density, collision, or the beats array.

Respond with ONLY valid JSON in this exact format:
{
  "keyframes": [<the complete modified keyframes array>],
  "adjustments": "<brief description of what you changed and why>"
}`
}

function buildMotorPrompt(
  scene: SceneBeatJson,
  critique: CriticResult,
  description: string
): string {
  return `You are tuning the SKELETAL CHOREOGRAPHY of a stick figure animation. The movement sequence is: "${description}"

Current Scene Beat JSON (the "beats" array controls the skeleton's movement):
${JSON.stringify(scene.beats, null, 2)}

A critic evaluated the skeletal animation quality and scored it ${critique.score}/10.
Issues found (all relate to the skeleton's poses and movement, NOT physics):
${JSON.stringify(critique.issues, null, 2)}

Summary: ${critique.summary}

Your job: adjust the beats to improve how the skeleton POSES and MOVES. You can tune:
- motorStiffness (how rigidly joints hold their target angles; 8 = loose/floppy, 200 = snappy/rigid, 600 = locked)
- motorBlend (0-1, interpolation strength toward target pose; 0 = limp, 1 = full motor control)
- scrollRange timing (when each pose/transition starts and ends — affects pacing and readability)
- pose references (which named pose the skeleton targets — e.g. "falling", "kick", "standing")

You CANNOT change and should NOT try to fix:
- Gravity, mass, or density (those are physics constants, not choreography)
- Collision behavior or ground contact (environment physics)
- Joint angular limits (structural skeleton constraints)

Focus on making the poses readable, transitions smooth, and timing feel natural.

Respond with ONLY valid JSON in this exact format:
{
  "beats": [<the complete modified beats array>],
  "adjustments": "<brief description of what you changed and why>"
}`
}

async function adjustParams(
  scene: SceneBeatJson,
  critique: CriticResult,
  description: string
): Promise<{ scene: SceneBeatJson; adjustments: string }> {
  const token = loadAuthToken()
  const kinematic = isKinematicScene(scene)

  const prompt = kinematic
    ? buildKinematicPrompt(scene, critique, description)
    : buildMotorPrompt(scene, critique, description)

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

  if (kinematic) {
    const result = JSON.parse(jsonStr) as { keyframes: KinematicKeyframe[]; adjustments: string }
    const adjusted = { ...scene, keyframes: result.keyframes }
    return { scene: adjusted, adjustments: result.adjustments }
  } else {
    const result = JSON.parse(jsonStr) as { beats: SceneBeatJson['beats']; adjustments: string }
    const adjusted = { ...scene, beats: result.beats }
    return { scene: adjusted, adjustments: result.adjustments }
  }
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

    // Post-process frames for vision model visibility
    console.error(`  Enhancing frames for vision model...`)
    const enhancedDir = path.join(capturesDir, 'enhanced')
    try {
      execSync(
        `python3 scripts/enhance-frames.py captures ${sceneId}`,
        { cwd: path.resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 }
      )
    } catch (err) {
      console.error(`  Warning: frame enhancement failed, using raw frames`)
    }

    // Run vision critic on enhanced frames (fall back to raw if enhanced dir missing)
    const criticDir = fs.existsSync(enhancedDir) ? enhancedDir : capturesDir
    console.error(`  Running vision critic on ${criticDir === enhancedDir ? 'enhanced' : 'raw'} frames...`)
    const critique = await critiqueAnimation(criticDir, description, sceneId, scenePath)
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
