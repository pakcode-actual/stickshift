#!/usr/bin/env npx tsx
/**
 * Animation Critic — Vision model evaluation of stick figure animation frames.
 *
 * Usage:
 *   npx tsx scripts/animation-critic.ts <frames-dir> <scene-description>
 *
 * Reads auth token from ~/.openclaw/openclaw.json (gateway.auth.token).
 * Calls the OpenClaw local chat completions API at http://localhost:18789/v1/chat/completions.
 *
 * Selects key frames (every 30th, or first/middle/last), sends to vision model,
 * and returns structured quality assessment.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { fileURLToPath } from 'url'
import { pathToFileURL } from 'url'

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

export interface CriticIssue {
  frame: number
  description: string
}

export interface CriticResult {
  score: number
  issues: CriticIssue[]
  summary: string
}

// ── Transition ranges ─────────────────────────────────────────────────────

interface TransitionRange {
  startFrame: number
  endFrame: number
}

/**
 * Parse keyframes from a scene JSON to identify transition vs. hold ranges.
 * A transition is where the easing is not "none" — the pose is actively changing.
 * Returns frame ranges (0-300 scale) for transition keyframes.
 */
function parseTransitionRanges(sceneJsonPath?: string): TransitionRange[] {
  if (!sceneJsonPath) return []
  try {
    const raw = fs.readFileSync(sceneJsonPath, 'utf-8')
    const scene = JSON.parse(raw) as { mode?: string; keyframes?: Array<{ scrollRange: [number, number]; easing: string }> }
    if (scene.mode !== 'kinematic' || !scene.keyframes) return []

    const totalFrames = 300 // standard capture length
    return scene.keyframes
      .filter((kf) => kf.easing !== 'none')
      .map((kf) => ({
        startFrame: Math.round(kf.scrollRange[0] * totalFrames),
        endFrame: Math.round(kf.scrollRange[1] * totalFrames),
      }))
  } catch {
    return []
  }
}

function isInTransition(frame: number, transitions: TransitionRange[]): boolean {
  return transitions.some((t) => frame >= t.startFrame && frame <= t.endFrame)
}

// ── Frame selection ────────────────────────────────────────────────────────

function selectKeyFrames(
  dir: string,
  sceneFilter?: string,
  sceneJsonPath?: string
): { path: string; frame: number }[] {
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .filter((f) => !sceneFilter || f.startsWith(sceneFilter))
    .map((f) => {
      const match = f.match(/-frame-(\d+)\.png$/)
      return match ? { path: path.join(dir, f), frame: parseInt(match[1], 10) } : null
    })
    .filter((f): f is { path: string; frame: number } => f !== null)
    .sort((a, b) => a.frame - b.frame)

  if (files.length === 0) {
    throw new Error(`No frame PNGs found in ${dir}`)
  }

  const transitions = parseTransitionRanges(sceneJsonPath)
  const selected = new Map<number, { path: string; frame: number }>()

  if (transitions.length > 0) {
    // Dense sampling during transitions (every 5 frames = every other captured file),
    // sparse during holds (every 30 frames = every 3rd captured file)
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (isInTransition(f.frame, transitions)) {
        // Every 5 frames: files are captured every 10 frames, so include consecutive files
        // to approximate every-5-frame density (closest we can get with 10-frame captures)
        selected.set(f.frame, f)
      } else {
        // Every 30 frames during holds
        if (i % 3 === 0) selected.set(f.frame, f)
      }
    }
  } else {
    // Fallback: every 30th frame (original behavior)
    for (let i = 0; i < files.length; i++) {
      if (i % 3 === 0) selected.set(files[i].frame, files[i])
    }
  }

  // Always include first, middle, last
  const first = files[0]
  const last = files[files.length - 1]
  const mid = files[Math.floor(files.length / 2)]
  selected.set(first.frame, first)
  selected.set(mid.frame, mid)
  selected.set(last.frame, last)

  return Array.from(selected.values()).sort((a, b) => a.frame - b.frame)
}

// ── Vision API call ────────────────────────────────────────────────────────

export async function critiqueAnimation(
  framesDir: string,
  description: string,
  sceneFilter?: string,
  sceneJsonPath?: string
): Promise<CriticResult> {
  const token = loadAuthToken()
  const keyFrames = selectKeyFrames(framesDir, sceneFilter, sceneJsonPath)

  console.error(`Selected ${keyFrames.length} key frames: ${keyFrames.map((f) => f.frame).join(', ')}`)

  // Limit to 5 frames max for the overview evaluation
  const framesToUse = keyFrames.slice(0, Math.min(5, keyFrames.length))
  console.error(`Using ${framesToUse.length} frames for vision API call`)

  // Build OpenAI-compatible message content with vision
  const content: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = []

  content.push({
    type: 'text',
    text: `You are evaluating the SKELETAL ANIMATION quality of a stick figure — how the figure's body poses, moves, and transitions through a choreographed sequence.

The animation shows: ${description}

EVALUATE ONLY the skeleton's movement:
- Pose readability: Can you tell what the figure is doing at each key moment?
- Transition quality: Do joints move smoothly between poses? Are there jerky jumps?
- Timing: Do poses hold long enough to read? Are transitions too fast or too slow?
- Joint coordination: Do arms, legs, and torso move together in a way that looks intentional and natural?
- Storytelling: Does the sequence of poses clearly convey the intended action?

DO NOT evaluate:
- Physics behavior (gravity, floating, collisions, bouncing)
- Environmental interactions (ground contact, prop physics)
- Anything the skeleton's motor parameters cannot control

Rate the skeletal animation quality 1-10. List specific issues with frame numbers, focusing only on pose and movement quality.

Respond with ONLY valid JSON in this exact format:
{
  "score": <number 1-10>,
  "issues": [{"frame": <number>, "description": "<string>"}],
  "summary": "<string>"
}`,
  })

  for (const frame of framesToUse) {
    const imgData = fs.readFileSync(frame.path)
    const base64 = imgData.toString('base64')

    content.push({
      type: 'text',
      text: `Frame ${frame.frame}:`,
    })

    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${base64}`
      },
    })
  }

  const overviewResult = await callVisionAPI(token, content, 1024)

  // Sequential frame pair evaluation for transitions
  const transitions = parseTransitionRanges(sceneJsonPath)
  if (transitions.length > 0) {
    const transitionFrames = keyFrames.filter((f) => isInTransition(f.frame, transitions))
    const pairIssues = await evaluateTransitionPairs(token, transitionFrames, description)
    // Merge pair issues into the overview result
    overviewResult.issues.push(...pairIssues)
    // Adjust score down if transition pairs found problems
    if (pairIssues.length > 0) {
      const penalty = Math.min(2, pairIssues.length * 0.5)
      overviewResult.score = Math.max(1, Math.round((overviewResult.score - penalty) * 10) / 10)
      overviewResult.summary += ` Transition pair analysis found ${pairIssues.length} additional issue(s).`
    }
  }

  return overviewResult
}

async function callVisionAPI(
  token: string,
  content: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>,
  maxTokens: number
): Promise<CriticResult> {
  const response = await fetch('http://localhost:18789/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: 'openclaw',
      max_tokens: maxTokens,
      temperature: 0,
      messages: [{ role: 'user', content }],
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
    throw new Error('No text response from vision model')
  }

  let jsonStr = text.trim()
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim()
  }

  const result = JSON.parse(jsonStr) as CriticResult

  if (typeof result.score !== 'number' || !Array.isArray(result.issues) || typeof result.summary !== 'string') {
    throw new Error(`Invalid critic response structure: ${jsonStr}`)
  }

  return result
}

async function evaluateTransitionPairs(
  token: string,
  frames: { path: string; frame: number }[],
  description: string
): Promise<CriticIssue[]> {
  if (frames.length < 2) return []

  const issues: CriticIssue[] = []

  // Evaluate adjacent pairs (max 3 pairs to avoid excessive API calls)
  const pairs: [typeof frames[0], typeof frames[0]][] = []
  for (let i = 0; i < frames.length - 1 && pairs.length < 3; i++) {
    pairs.push([frames[i], frames[i + 1]])
  }

  for (const [frameA, frameB] of pairs) {
    const content: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = []

    content.push({
      type: 'text',
      text: `You are evaluating a TRANSITION between two adjacent frames of a stick figure animation: "${description}"

Between frame ${frameA.frame} and frame ${frameB.frame}, check:
- Do any limbs cross through the body?
- Do feet shift unexpectedly on the ground?
- Do arms or legs teleport or snap to a new position?
- Does the elbow pass through the torso?

Respond with ONLY valid JSON:
{
  "score": <number 1-10>,
  "issues": [{"frame": <number>, "description": "<string>"}],
  "summary": "<string>"
}`,
    })

    const imgA = fs.readFileSync(frameA.path)
    content.push({ type: 'text', text: `Frame ${frameA.frame}:` })
    content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${imgA.toString('base64')}` } })

    const imgB = fs.readFileSync(frameB.path)
    content.push({ type: 'text', text: `Frame ${frameB.frame}:` })
    content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${imgB.toString('base64')}` } })

    try {
      const pairResult = await callVisionAPI(token, content, 512)
      issues.push(...pairResult.issues)
    } catch (err) {
      console.error(`  Warning: transition pair evaluation failed for frames ${frameA.frame}-${frameB.frame}`)
    }
  }

  return issues
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Parse flags
  let sceneFilter: string | undefined
  let sceneJsonPath: string | undefined
  const filteredArgs: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scene' && i + 1 < args.length) {
      sceneFilter = args[++i]
    } else if (args[i] === '--scene-json' && i + 1 < args.length) {
      sceneJsonPath = args[++i]
    } else {
      filteredArgs.push(args[i])
    }
  }

  if (filteredArgs.length < 2) {
    console.error('Usage: npx tsx scripts/animation-critic.ts [--scene <prefix>] [--scene-json <path>] <frames-dir> <scene-description>')
    process.exit(1)
  }

  const [framesDir, ...descParts] = filteredArgs
  const description = descParts.join(' ')

  if (!fs.existsSync(framesDir)) {
    console.error(`Directory not found: ${framesDir}`)
    process.exit(1)
  }

  console.error(`Critiquing animation: "${description}"`)
  console.error(`Frames directory: ${framesDir}`)
  if (sceneFilter) console.error(`Scene filter: ${sceneFilter}`)
  if (sceneJsonPath) console.error(`Scene JSON: ${sceneJsonPath}`)

  const result = await critiqueAnimation(framesDir, description, sceneFilter, sceneJsonPath)

  // Output structured JSON to stdout
  console.log(JSON.stringify(result, null, 2))
}

// Only run main() if this file is executed directly (not imported as a module)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Error:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
