#!/usr/bin/env npx tsx
/**
 * Animation Critic — Vision model evaluation of stick figure animation frames.
 *
 * Usage:
 *   npx tsx scripts/animation-critic.ts <frames-dir> <scene-description>
 *
 * Env:
 *   ANTHROPIC_API_KEY — required
 *
 * Selects key frames (every 30th, or first/middle/last), sends to Claude vision,
 * and returns structured quality assessment.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'

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
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required')
  }

  const client = new Anthropic({ apiKey })
  const keyFrames = selectKeyFrames(framesDir, sceneFilter)

  console.error(`Selected ${keyFrames.length} key frames: ${keyFrames.map((f) => f.frame).join(', ')}`)

  // Build content blocks: text prompt + images
  const content: Anthropic.MessageCreateParams['messages'][0]['content'] = []

  content.push({
    type: 'text',
    text: `This is a stick figure animation of ${description}. The following frames show the sequence in order. Rate the animation quality 1-10. List specific issues with frame numbers.

Respond with ONLY valid JSON in this exact format:
{
  "score": <number 1-10>,
  "issues": [{"frame": <number>, "description": "<string>"}],
  "summary": "<string>"
}`,
  })

  for (const frame of keyFrames) {
    const data = fs.readFileSync(frame.path)
    const base64 = data.toString('base64')

    content.push({
      type: 'text',
      text: `Frame ${frame.frame}:`,
    })
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: base64,
      },
    })
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    temperature: 0,
    messages: [{ role: 'user', content }],
  })

  // Extract text response
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from vision model')
  }

  // Parse JSON from response (handle markdown code fences)
  let jsonStr = textBlock.text.trim()
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

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
