import {
  prepareWithSegments,
  layoutNextLine,
  type PreparedTextWithSegments,
  type LayoutCursor,
} from '@chenglou/pretext'
import type { Obstacle } from './physics'
import type { TextInteractionMode } from './scene-types'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TextLine {
  text: string
  x: number
  y: number
  width: number
}

interface Slot {
  left: number
  right: number
}

// ─── Default Text Content ───────────────────────────────────────────────────

const DEFAULT_TEXT = `Physics simulation brings digital worlds to life. Every object in this scene follows Newton's laws of motion — forces, mass, and acceleration working together to create believable movement. The stick figure you see is a ragdoll: a collection of rigid bodies connected by joints, each obeying the same physical rules that govern the real world.

What makes this ragdoll special is its "active" nature. Unlike a simple ragdoll that just flops around, this one has motorized joints that can track target poses. When the motors are strong, the figure holds its shape. When they go to zero, it collapses naturally under gravity. The blend between these states creates the illusion of a character losing and regaining control.

The text you're reading right now is being laid out in real-time, every single frame. As physics bodies move through the text area, the layout engine carves out space around them. Each line of text is measured and positioned to flow around obstacles, just like water flowing around stones in a stream.`

// ─── Preparation ─────────────────────────────────────────────────────────────

const FONT = '18px Inter, system-ui, -apple-system, sans-serif'
const LINE_HEIGHT = 26

// Cache prepared text by content string to avoid re-preparing the same text
let preparedCache: Map<string, PreparedTextWithSegments> = new Map()
let currentPrepared: PreparedTextWithSegments | null = null
let currentText: string = ''

export function prepareText(): void {
  currentPrepared = prepareWithSegments(DEFAULT_TEXT, FONT)
  currentText = DEFAULT_TEXT
  preparedCache.set(DEFAULT_TEXT, currentPrepared)
}

function getPrepared(text?: string): PreparedTextWithSegments | null {
  const targetText = text ?? DEFAULT_TEXT
  if (targetText === currentText && currentPrepared) return currentPrepared

  let cached = preparedCache.get(targetText)
  if (!cached) {
    cached = prepareWithSegments(targetText, FONT)
    preparedCache.set(targetText, cached)
  }
  currentPrepared = cached
  currentText = targetText
  return cached
}

export function getLineHeight(): number {
  return LINE_HEIGHT
}

// ─── Obstacle Carving ────────────────────────────────────────────────────────

/** Carve available text slots at a given Y line, avoiding obstacles */
function carveSlots(
  containerLeft: number,
  containerRight: number,
  obstacles: Obstacle[],
  y: number,
  lineHeight: number
): Slot[] {
  // Find obstacles that overlap this Y range
  const overlapping = obstacles.filter(
    (obs) => obs.y < y + lineHeight && obs.y + obs.height > y
  )

  if (overlapping.length === 0) {
    return [{ left: containerLeft, right: containerRight }]
  }

  // Sort by X position
  overlapping.sort((a, b) => a.x - b.x)

  const slots: Slot[] = []
  let currentLeft = containerLeft
  const MIN_SLOT_WIDTH = 40 // minimum width to place text

  for (const obs of overlapping) {
    const obsLeft = obs.x
    const obsRight = obs.x + obs.width

    if (obsLeft > currentLeft + MIN_SLOT_WIDTH) {
      slots.push({ left: currentLeft, right: obsLeft })
    }
    currentLeft = Math.max(currentLeft, obsRight)
  }

  if (currentLeft < containerRight - MIN_SLOT_WIDTH) {
    slots.push({ left: currentLeft, right: containerRight })
  }

  return slots
}

// ─── Layout ──────────────────────────────────────────────────────────────────

/**
 * Layout all text lines, carving around obstacles.
 * Called every frame — Pretext layout is fast enough (<0.5ms).
 * Supports multiple text interaction modes.
 */
export function layoutText(
  obstacles: Obstacle[],
  containerLeft: number,
  containerRight: number,
  containerTop: number,
  containerBottom: number,
  textContent?: string,
  mode?: TextInteractionMode,
  localProgress?: number
): TextLine[] {
  const prep = getPrepared(textContent)
  if (!prep) return []

  const effectiveMode = mode ?? 'reflow'

  if (effectiveMode === 'line-by-line') {
    return layoutLineByLine(prep, containerLeft, containerRight, containerTop, containerBottom, localProgress ?? 0)
  }

  if (effectiveMode === 'scatter') {
    return layoutWithScatter(prep, obstacles, containerLeft, containerRight, containerTop, containerBottom)
  }

  // 'reflow' and 'platform' both use obstacle-carving layout
  return layoutReflow(prep, obstacles, containerLeft, containerRight, containerTop, containerBottom)
}

/** Standard reflow layout — carves text around obstacles */
function layoutReflow(
  prep: PreparedTextWithSegments,
  obstacles: Obstacle[],
  containerLeft: number,
  containerRight: number,
  containerTop: number,
  containerBottom: number
): TextLine[] {
  const lines: TextLine[] = []
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = containerTop

  while (y + LINE_HEIGHT < containerBottom) {
    const slots = carveSlots(containerLeft, containerRight, obstacles, y, LINE_HEIGHT)

    let placedInRow = false

    for (const slot of slots) {
      const slotWidth = slot.right - slot.left
      if (slotWidth < 40) continue

      const line = layoutNextLine(prep, cursor, slotWidth)
      if (line === null) return lines

      lines.push({
        text: line.text,
        x: slot.left,
        y,
        width: line.width,
      })

      cursor = line.end
      placedInRow = true
    }

    if (!placedInRow) {
      y += LINE_HEIGHT
      continue
    }

    y += LINE_HEIGHT
  }

  return lines
}

/** Line-by-line reveal — shows lines progressively based on scroll progress */
function layoutLineByLine(
  prep: PreparedTextWithSegments,
  containerLeft: number,
  containerRight: number,
  containerTop: number,
  containerBottom: number,
  progress: number
): TextLine[] {
  // First lay out all lines without obstacles
  const allLines: TextLine[] = []
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = containerTop

  const slotWidth = containerRight - containerLeft

  while (y + LINE_HEIGHT < containerBottom) {
    const line = layoutNextLine(prep, cursor, slotWidth)
    if (line === null) break

    allLines.push({
      text: line.text,
      x: containerLeft,
      y,
      width: line.width,
    })

    cursor = line.end
    y += LINE_HEIGHT
  }

  // Reveal lines based on progress
  const linesToShow = Math.max(1, Math.floor(allLines.length * progress))
  return allLines.slice(0, linesToShow)
}

/** Scatter mode — standard layout but with displacement from obstacles */
function layoutWithScatter(
  prep: PreparedTextWithSegments,
  obstacles: Obstacle[],
  containerLeft: number,
  containerRight: number,
  containerTop: number,
  containerBottom: number
): TextLine[] {
  // First, do a standard layout
  const lines = layoutReflow(prep, obstacles, containerLeft, containerRight, containerTop, containerBottom)

  // Then apply scatter displacement from nearby obstacles
  for (const line of lines) {
    for (const obs of obstacles) {
      const obsCenterX = obs.x + obs.width / 2
      const obsCenterY = obs.y + obs.height / 2
      const dx = line.x - obsCenterX
      const dy = line.y - obsCenterY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const scatterRadius = 150

      if (dist < scatterRadius && dist > 0) {
        const force = (1 - dist / scatterRadius) * 30
        line.x += (dx / dist) * force
        line.y += (dy / dist) * force * 0.5
      }
    }
  }

  return lines
}

// ─── DOM Rendering ───────────────────────────────────────────────────────────

// Track previous span positions for lerped transitions
const prevPositions: Map<number, { x: number; y: number }> = new Map()
const LERP_ALPHA = 0.25

/**
 * Render text lines as positioned DOM spans.
 * Reuses existing spans to minimize DOM churn.
 * Lerps positions between frames for smooth reflow.
 */
export function renderTextToDOM(
  container: HTMLElement,
  lines: TextLine[]
): void {
  // Grow or shrink the span pool
  while (container.children.length > lines.length) {
    container.removeChild(container.lastChild!)
  }
  while (container.children.length < lines.length) {
    const span = document.createElement('span')
    container.appendChild(span)
  }

  for (let i = 0; i < lines.length; i++) {
    const span = container.children[i] as HTMLSpanElement
    const line = lines[i]

    // Only update textContent if it changed (avoid layout thrashing)
    if (span.textContent !== line.text) {
      span.textContent = line.text
    }

    // Lerp position for smooth reflow
    const prev = prevPositions.get(i)
    let x: number
    let y: number
    if (prev && span.textContent === line.text) {
      x = prev.x + (line.x - prev.x) * LERP_ALPHA
      y = prev.y + (line.y - prev.y) * LERP_ALPHA
    } else {
      x = line.x
      y = line.y
    }
    prevPositions.set(i, { x, y })

    span.style.left = `${x}px`
    span.style.top = `${y}px`
  }

  // Clean up stale entries
  if (prevPositions.size > lines.length) {
    for (const key of prevPositions.keys()) {
      if (key >= lines.length) prevPositions.delete(key)
    }
  }
}
