import { initPhysics, stepPhysics, getObstacles } from './physics'
import { initCanvas, resizeCanvas, render } from './renderer'
import { prepareText, layoutText, renderTextToDOM, getLineHeight } from './pretext-layout'
import { initJourney } from './scene'
import { initProgressIndicator } from './progress-indicator'
import { drawKinematicSkeleton } from './kinematic-skeleton'
import type { PhysicsWorld } from './physics'
import type { JourneyController } from './scene'
import type { ProgressIndicator } from './progress-indicator'
import type { SceneBeat } from './scene-types'

// ─── Scene JSON Imports ─────────────────────────────────────────────────────

import scene01 from './scenes/01-the-fall.json'
import scene02 from './scenes/02-the-kick.json'
import scene03 from './scenes/03-the-climb.json'
import scene04 from './scenes/04-the-lecture.json'
import scene05 from './scenes/05-the-celebration.json'
import scene06 from './scenes/06-new-celebration.json'

// ─── DOM Elements ────────────────────────────────────────────────────────────

const sceneContainer = document.getElementById('scene-container')!
const textLayer = document.getElementById('text-layer')!
const canvas = document.getElementById('physics-canvas') as HTMLCanvasElement
const hud = document.getElementById('hud')!
const progressContainer = document.getElementById('progress-indicator')!

// ─── Text Layout Bounds ──────────────────────────────────────────────────────

const TEXT_PADDING = 60
const TEXT_TOP = 40

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rect = sceneContainer.getBoundingClientRect()
  const sceneWidth = rect.width
  const sceneHeight = rect.height

  // Initialize physics
  const physics = await initPhysics(sceneWidth, sceneHeight)

  // Initialize canvas
  const ctx = initCanvas(canvas)

  // Prepare text layout (expensive — done once)
  prepareText()

  // Load all scene beats
  const sceneBeats: SceneBeat[] = [
    scene01 as SceneBeat,
    scene02 as SceneBeat,
    scene03 as SceneBeat,
    scene04 as SceneBeat,
    scene05 as unknown as SceneBeat,
    scene06 as unknown as SceneBeat,
  ]

  // Initialize scroll-driven journey
  const journey = initJourney(sceneContainer, physics, sceneBeats)

  // Initialize progress indicator
  const progress = initProgressIndicator(progressContainer)

  // Handle resize
  window.addEventListener('resize', () => {
    resizeCanvas(canvas, ctx)
  })

  // Start the game loop
  gameLoop(physics, ctx, journey, progress, sceneWidth, sceneHeight)
}

// ─── Game Loop ───────────────────────────────────────────────────────────────

function gameLoop(
  physics: PhysicsWorld,
  ctx: CanvasRenderingContext2D,
  journey: JourneyController,
  progress: ProgressIndicator,
  sceneWidth: number,
  sceneHeight: number
): void {
  const TARGET_FRAME_TIME = 1000 / 60
  let lastTime = performance.now()
  let accumulator = 0
  let frameCount = 0
  let fpsDisplay = '0'
  let fpsTimer = 0

  function loop(now: number): void {
    const dt = now - lastTime
    lastTime = now
    accumulator += dt
    fpsTimer += dt

    if (fpsTimer > 500) {
      fpsDisplay = Math.round((frameCount / fpsTimer) * 1000).toString()
      frameCount = 0
      fpsTimer = 0
    }

    if (accumulator < TARGET_FRAME_TIME) {
      requestAnimationFrame(loop)
      return
    }
    accumulator -= TARGET_FRAME_TIME
    // Prevent spiral of death
    if (accumulator > TARGET_FRAME_TIME * 4) accumulator = 0
    frameCount++

    const simulating = journey.shouldSimulate()
    const globalProgress = journey.getProgress()
    const activeScene = journey.getActiveScene()

    // Step physics only when a scene is active
    if (simulating) {
      stepPhysics(physics)
    }

    // Get physics obstacles for text reflow
    const obstacles = simulating ? getObstacles(physics) : []

    // Get text content from active scene, or use default
    const textContent = activeScene?.beat.text.content
    const textMode = activeScene?.beat.text.mode ?? 'reflow'

    // Layout text around obstacles
    const containerLeft = TEXT_PADDING
    const containerRight = sceneWidth - TEXT_PADDING
    const containerTop = TEXT_TOP
    const containerBottom = physics.groundY - 20

    const lines = layoutText(
      obstacles,
      containerLeft,
      containerRight,
      containerTop,
      containerBottom,
      textContent,
      textMode,
      journey.getLocalProgress()
    )

    // Render text as DOM spans
    renderTextToDOM(textLayer, lines)

    // Apply canvas opacity for transitions
    const canvasOpacity = journey.getCanvasOpacity()
    canvas.style.opacity = canvasOpacity.toString()

    // Get camera transform
    const camera = journey.getCamera()

    // Build kinematic draw callback if scene uses kinematic mode
    let kinematicDraw: ((drawCtx: CanvasRenderingContext2D) => void) | undefined
    if (activeScene?.kinematicPose && activeScene?.kinematicPositions) {
      const pos = activeScene.kinematicPositions
      const headAngle = activeScene.kinematicPose.head
      kinematicDraw = (drawCtx) => drawKinematicSkeleton(drawCtx, pos, headAngle)
    }

    // Render physics objects on canvas
    render(ctx, canvas, physics, camera, activeScene?.dynamicBodies, kinematicDraw)

    // Update progress indicator
    progress.update(journey.getActiveSceneIndex(), journey.getSceneCount())

    // HUD
    const sceneTitle = journey.getSceneTitle()
    const sceneIndex = journey.getActiveSceneIndex()
    hud.textContent = `${fpsDisplay} fps · ${sceneTitle || 'none'} (${sceneIndex + 1}/${journey.getSceneCount()}) · ${(globalProgress * 100).toFixed(0)}%`

    // Expose debug state for E2E tests
    const torsoPos = physics.ragdoll.torso.translation()
    const torsoRot = physics.ragdoll.torso.rotation()
    ;(window as any).__ragdollDebug = {
      torsoX: torsoPos.x,
      torsoY: torsoPos.y,
      torsoRotation: torsoRot,
      scene: sceneTitle,
      progress: globalProgress,
    }

    requestAnimationFrame(loop)
  }

  requestAnimationFrame(loop)
}

// ─── Start ───────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Failed to initialize:', err)
  document.body.innerHTML = `
    <div style="color: #ff6b6b; padding: 2rem; font-family: monospace;">
      <h2>Failed to initialize</h2>
      <pre>${err instanceof Error ? err.message : String(err)}</pre>
    </div>
  `
})
