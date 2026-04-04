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

// ── Frame selection ────────────────────────────────────────────────────────

function selectKeyFrames(dir: string, sceneFilter?: string): { path: string; frame: number }[] {
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

  // Select every 30th frame from the sorted list
  const every30 = files.filter((_, i) => i % 3 === 0) // frames are captured every 10, so every 3rd = every 30th frame

  // Ensure first, middle, and last are included
  const first = files[0]
  const last = files[files.length - 1]
  const mid = files[Math.floor(files.length / 2)]

  const selected = new Map<number, { path: string; frame: number }>()
  for (const f of every30) selected.set(f.frame, f)
  selected.set(first.frame, first)
  selected.set(mid.frame, mid)
  selected.set(last.frame, last)

  return Array.from(selected.values()).sort((a, b) => a.frame - b.frame)
}

// ── Vision API call ────────────────────────────────────────────────────────

export async function critiqueAnimation(
  framesDir: string,
  description: string,
  sceneFilter?: string
): Promise<CriticResult> {
  const token = loadAuthToken()
  const keyFrames = selectKeyFrames(framesDir, sceneFilter)

  console.error(`Selected ${keyFrames.length} key frames: ${keyFrames.map((f) => f.frame).join(', ')}`)
  
  // Limit to 5 frames max to avoid API issues with too many images
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
    const data = fs.readFileSync(frame.path)
    const base64 = data.toString('base64')

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

  const response = await fetch('http://localhost:18789/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: 'openclaw',
      max_tokens: 1024,
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

  // Parse JSON from response (handle markdown code fences)
  let jsonStr = text.trim()
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim()
  }

  const result = JSON.parse(jsonStr) as CriticResult

  // Validate structure
  if (typeof result.score !== 'number' || !Array.isArray(result.issues) || typeof result.summary !== 'string') {
    throw new Error(`Invalid critic response structure: ${jsonStr}`)
  }

  return result
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Parse --scene flag
  let sceneFilter: string | undefined
  const filteredArgs: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scene' && i + 1 < args.length) {
      sceneFilter = args[++i]
    } else {
      filteredArgs.push(args[i])
    }
  }

  if (filteredArgs.length < 2) {
    console.error('Usage: npx tsx scripts/animation-critic.ts [--scene <prefix>] <frames-dir> <scene-description>')
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

  const result = await critiqueAnimation(framesDir, description, sceneFilter)

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
