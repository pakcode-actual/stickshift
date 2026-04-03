import { initPhysics, stepPhysics, seedRng } from './physics'
import { initCanvas, resizeCanvas, render } from './renderer'
import type { PhysicsWorld } from './physics'
import type { SceneBeat } from './scene-types'
import type { SceneInstance } from './scene-interpreter'
import {
  createSceneInstance,
  activateScene,
  deactivateScene,
  updateScene,
  getLocalProgress,
} from './scene-interpreter'
import { SandboxDriver } from './playback'

// ─── Window augmentation for determinism testing ───────────────────────────

interface FrameCapture {
  frame: number
  timestamp: number
  hash: string
  dataUrl: string
}

declare global {
  interface Window {
    __physicsHash?: string
    __stepAndHash?: (frames: number) => Promise<string>
    __deterministicCapture?: (
      totalFrames: number,
      captureEvery: number
    ) => Promise<FrameCapture[]>
  }
}

async function hashSnapshot(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Scene JSON Imports ─────────────────────────────────────────────────────

import scene01 from './scenes/01-the-fall.json'
import scene02 from './scenes/02-the-kick.json'
import scene03 from './scenes/03-the-climb.json'
import scene04 from './scenes/04-the-lecture.json'
import scene05 from './scenes/05-the-celebration.json'

// ─── Available Beats ────────────────────────────────────────────────────────

interface BeatEntry {
  id: string
  title: string
  beat: SceneBeat
}

function loadAvailableBeats(): BeatEntry[] {
  const all = [scene01, scene02, scene03, scene04, scene05] as SceneBeat[]
  return all.map((b) => ({ id: b.id, title: b.title, beat: b }))
}

// ─── DOM Elements ───────────────────────────────────────────────────────────

const canvas = document.getElementById('sandbox-canvas') as HTMLCanvasElement
const emptyState = document.getElementById('empty-state')!
const hudEl = document.getElementById('sandbox-hud')!
const beatSelector = document.getElementById('beat-selector') as HTMLSelectElement
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement
const btnPause = document.getElementById('btn-pause') as HTMLButtonElement
const btnStep = document.getElementById('btn-step') as HTMLButtonElement
const scrubber = document.getElementById('timeline-scrubber') as HTMLInputElement
const frameDisplay = document.getElementById('frame-display')!
const tuningPanel = document.getElementById('tuning-panel')!
const jointSelect = document.getElementById('joint-select') as HTMLSelectElement
const sliderStiffness = document.getElementById('slider-stiffness') as HTMLInputElement
const sliderDamping = document.getElementById('slider-damping') as HTMLInputElement
const sliderAngle = document.getElementById('slider-angle') as HTMLInputElement
const valStiffness = document.getElementById('val-stiffness')!
const valDamping = document.getElementById('val-damping')!
const valAngle = document.getElementById('val-angle')!
const toggleTargetSkeleton = document.getElementById('toggle-target-skeleton') as HTMLInputElement
const toggleRapierDebug = document.getElementById('toggle-rapier-debug') as HTMLInputElement

// ─── Joint Names ────────────────────────────────────────────────────────────

const JOINT_NAMES = [
  'neck', 'shoulderL', 'elbowL', 'shoulderR', 'elbowR',
  'hipL', 'kneeL', 'hipR', 'kneeR',
]

// ─── State ──────────────────────────────────────────────────────────────────

interface JointOverride {
  stiffness: number
  damping: number
  targetAngle: number
}

interface SandboxState {
  physics: PhysicsWorld
  ctx: CanvasRenderingContext2D
  driver: SandboxDriver | null
  activeScene: SceneInstance | null
  beats: BeatEntry[]
  jointOverrides: Map<number, JointOverride>
  selectedJoint: number | null
  pendingStep: boolean
  debug: {
    showTargetSkeleton: boolean
    showRapierDebug: boolean
  }
}

let state: SandboxState | null = null

// ─── Bootstrap ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rect = canvas.parentElement!.getBoundingClientRect()
  seedRng(42)
  const physics = await initPhysics(rect.width, rect.height)
  const ctx = initCanvas(canvas)

  const beats = loadAvailableBeats()

  state = {
    physics,
    ctx,
    driver: null,
    activeScene: null,
    beats,
    jointOverrides: new Map(),
    selectedJoint: null,
    pendingStep: false,
    debug: {
      showTargetSkeleton: false,
      showRapierDebug: false,
    },
  }

  // Populate beat selector
  for (const entry of beats) {
    const opt = document.createElement('option')
    opt.value = entry.id
    opt.textContent = entry.title
    beatSelector.appendChild(opt)
  }

  // Populate joint selector
  for (let i = 0; i < JOINT_NAMES.length; i++) {
    const opt = document.createElement('option')
    opt.value = String(i)
    opt.textContent = JOINT_NAMES[i]
    jointSelect.appendChild(opt)
  }

  // Wire up controls
  wireControls()

  // Handle resize
  window.addEventListener('resize', () => {
    resizeCanvas(canvas, ctx)
  })

  // Disable transport initially
  setTransportEnabled(false)

  // Expose deterministic step+hash for Playwright tests.
  // Reinitializes physics from scratch, loads the beat, then steps exactly N frames.
  window.__stepAndHash = async (frames: number): Promise<string> => {
    if (!state) throw new Error('Sandbox not initialized')

    const currentBeatId = beatSelector.value
    if (!currentBeatId) throw new Error('No beat selected')

    // Tear down existing scene
    if (state.activeScene && state.activeScene.lifecycle === 'active') {
      deactivateScene(state.activeScene, state.physics)
    }
    if (state.driver) {
      state.driver.destroy()
    }
    state.jointOverrides.clear()

    // Reinitialize physics world from scratch for full determinism
    seedRng(42)
    const rect = canvas.parentElement!.getBoundingClientRect()
    const freshPhysics = await initPhysics(rect.width, rect.height)
    state.physics = freshPhysics

    const entry = state.beats.find((b) => b.id === currentBeatId)!
    const instance = createSceneInstance(entry.beat)
    activateScene(instance, freshPhysics)
    state.activeScene = instance

    const totalFrames = 300
    const driver = new SandboxDriver(totalFrames)
    driver.setLooping(false)
    driver.play()
    state.driver = driver

    // Step exactly N frames
    for (let i = 0; i < frames; i++) {
      driver.tick()
      const localP = getLocalProgress(instance, remapProgressToScroll(instance, driver.getProgress()))
      updateScene(instance, localP, freshPhysics)
      stepPhysics(freshPhysics)
    }

    driver.pause()

    const snapshot = freshPhysics.world.takeSnapshot()
    const hash = await hashSnapshot(snapshot)
    window.__physicsHash = hash
    return hash
  }

  // Expose deterministic frame capture for Playwright frame-capture tests.
  // Reinitializes physics, steps frame-by-frame, captures canvas + hash at intervals.
  window.__deterministicCapture = async (
    totalFrames: number,
    captureEvery: number
  ): Promise<FrameCapture[]> => {
    if (!state) throw new Error('Sandbox not initialized')

    const currentBeatId = beatSelector.value
    if (!currentBeatId) throw new Error('No beat selected')

    // Tear down existing scene
    if (state.activeScene && state.activeScene.lifecycle === 'active') {
      deactivateScene(state.activeScene, state.physics)
    }
    if (state.driver) {
      state.driver.destroy()
    }
    state.jointOverrides.clear()

    // Reinitialize physics world from scratch for full determinism
    seedRng(42)
    const rect = canvas.parentElement!.getBoundingClientRect()
    const freshPhysics = await initPhysics(rect.width, rect.height)
    state.physics = freshPhysics

    const entry = state.beats.find((b) => b.id === currentBeatId)!
    const instance = createSceneInstance(entry.beat)
    activateScene(instance, freshPhysics)
    state.activeScene = instance

    const driverFrames = 300
    const driver = new SandboxDriver(driverFrames)
    driver.setLooping(false)
    driver.play()
    state.driver = driver

    const captures: FrameCapture[] = []
    const startTime = performance.now()

    for (let i = 1; i <= totalFrames; i++) {
      driver.tick()
      const localP = getLocalProgress(
        instance,
        remapProgressToScroll(instance, driver.getProgress())
      )
      updateScene(instance, localP, freshPhysics)
      stepPhysics(freshPhysics)

      if (i % captureEvery === 0) {
        // Render the current state to the canvas
        render(state.ctx, canvas, freshPhysics, undefined, instance.dynamicBodies)

        const dataUrl = canvas.toDataURL('image/png')
        const snapshot = freshPhysics.world.takeSnapshot()
        const hash = await hashSnapshot(snapshot)

        captures.push({
          frame: i,
          timestamp: performance.now() - startTime,
          hash,
          dataUrl,
        })
      }
    }

    driver.pause()
    return captures
  }

  // Start game loop
  gameLoop()
}

// ─── Beat Loading ───────────────────────────────────────────────────────────

function loadBeat(beatId: string): void {
  if (!state) return

  const entry = state.beats.find((b) => b.id === beatId)
  if (!entry) return

  // Cleanup previous scene
  if (state.activeScene && state.activeScene.lifecycle === 'active') {
    deactivateScene(state.activeScene, state.physics)
  }
  if (state.driver) {
    state.driver.destroy()
  }

  // Clear joint overrides
  state.jointOverrides.clear()
  state.selectedJoint = null

  // Reset deterministic RNG for reproducibility
  seedRng(42)

  // Create new scene instance
  let instance: SceneInstance
  try {
    instance = createSceneInstance(entry.beat)
    activateScene(instance, state.physics)
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err))
    return
  }

  state.activeScene = instance

  // Create sandbox driver — estimate total frames from beat duration
  // Use 300 frames (~5 seconds at 60fps) as default playback length
  const totalFrames = 300
  const driver = new SandboxDriver(totalFrames)
  driver.setLooping(true)
  state.driver = driver

  // Wire driver progress to scene-interpreter
  driver.onProgressChange((progress: number) => {
    if (!state || !state.activeScene || state.activeScene.lifecycle !== 'active') return
    const localP = getLocalProgress(state.activeScene, remapProgressToScroll(state.activeScene, progress))
    updateScene(state.activeScene, localP, state.physics)
  })

  // Show UI
  emptyState.style.display = 'none'
  tuningPanel.style.display = 'block'
  setTransportEnabled(true)
  updateFrameDisplay()

  // Auto-play
  driver.play()
  updateTransportButtons()
}

function unloadBeat(): void {
  if (!state) return

  if (state.activeScene && state.activeScene.lifecycle === 'active') {
    deactivateScene(state.activeScene, state.physics)
  }
  if (state.driver) {
    state.driver.destroy()
  }

  state.activeScene = null
  state.driver = null
  state.jointOverrides.clear()
  state.selectedJoint = null

  emptyState.style.display = ''
  tuningPanel.style.display = 'none'
  setTransportEnabled(false)
  updateFrameDisplay()
}

/** Remap sandbox progress [0,1] into the scene's scrollRange for the interpreter */
function remapProgressToScroll(instance: SceneInstance, progress: number): number {
  const [start, end] = instance.beat.scrollRange
  return start + progress * (end - start)
}

function showError(message: string): void {
  emptyState.style.display = ''
  emptyState.innerHTML = `
    <h2 style="color: #ff6b6b;">Error Loading Beat</h2>
    <p style="color: #ff6b6b; font-family: monospace; font-size: 12px; max-width: 400px; word-wrap: break-word;">${message}</p>
  `
}

// ─── Controls Wiring ────────────────────────────────────────────────────────

function wireControls(): void {
  beatSelector.addEventListener('change', () => {
    if (beatSelector.value) {
      loadBeat(beatSelector.value)
    } else {
      unloadBeat()
    }
  })

  btnPlay.addEventListener('click', () => {
    state?.driver?.play()
    updateTransportButtons()
  })

  btnPause.addEventListener('click', () => {
    state?.driver?.pause()
    updateTransportButtons()
  })

  btnStep.addEventListener('click', () => {
    if (state) {
      state.pendingStep = true
      state.driver?.stepForward()
    }
    updateTransportButtons()
  })

  // Timeline scrubber
  let scrubbing = false
  scrubber.addEventListener('input', () => {
    if (!state?.driver) return
    scrubbing = true
    state.driver.seek(parseFloat(scrubber.value))
  })
  scrubber.addEventListener('change', () => {
    scrubbing = false
  })

  // Sync scrubber with driver progress
  setInterval(() => {
    if (!scrubbing && state?.driver) {
      scrubber.value = String(state.driver.getProgress())
      updateFrameDisplay()
    }
  }, 1000 / 30) // 30hz UI update

  // Joint tuning
  jointSelect.addEventListener('change', () => {
    if (!state) return
    const idx = parseInt(jointSelect.value, 10)
    state.selectedJoint = isNaN(idx) ? null : idx
    syncSliders()
  })

  sliderStiffness.addEventListener('input', () => applyJointOverride())
  sliderDamping.addEventListener('input', () => applyJointOverride())
  sliderAngle.addEventListener('input', () => applyJointOverride())

  // Debug toggles
  toggleTargetSkeleton.addEventListener('change', () => {
    if (state) state.debug.showTargetSkeleton = toggleTargetSkeleton.checked
  })
  toggleRapierDebug.addEventListener('change', () => {
    if (state) state.debug.showRapierDebug = toggleRapierDebug.checked
  })
}

function setTransportEnabled(enabled: boolean): void {
  btnPlay.disabled = !enabled
  btnPause.disabled = !enabled
  btnStep.disabled = !enabled
  scrubber.disabled = !enabled
}

function updateTransportButtons(): void {
  if (!state?.driver) return
  const playing = state.driver.isPlaying()
  btnPlay.disabled = playing
  btnPause.disabled = !playing
}

function updateFrameDisplay(): void {
  if (!state?.driver) {
    frameDisplay.textContent = '0 / 0'
    return
  }
  const frame = state.driver.getCurrentFrame()
  const total = state.driver.getTotalFrames()
  frameDisplay.textContent = `${frame} / ${total}`
}

// ─── Joint Override Logic ───────────────────────────────────────────────────

function syncSliders(): void {
  if (!state || state.selectedJoint === null) return
  const idx = state.selectedJoint
  const existing = state.jointOverrides.get(idx)

  if (existing) {
    sliderStiffness.value = String(existing.stiffness)
    sliderDamping.value = String(existing.damping)
    sliderAngle.value = String(existing.targetAngle)
  } else {
    // Read current values from the Rapier joint
    const rj = state.physics.ragdoll.joints[idx]
    if (rj) {
      sliderStiffness.value = '600'
      sliderDamping.value = '60'
      sliderAngle.value = String(rj.standAngle)
    }
  }
  updateSliderLabels()
}

function applyJointOverride(): void {
  if (!state || state.selectedJoint === null) return

  const override: JointOverride = {
    stiffness: parseFloat(sliderStiffness.value),
    damping: parseFloat(sliderDamping.value),
    targetAngle: parseFloat(sliderAngle.value),
  }

  state.jointOverrides.set(state.selectedJoint, override)
  updateSliderLabels()
}

function updateSliderLabels(): void {
  valStiffness.textContent = sliderStiffness.value
  valDamping.textContent = sliderDamping.value
  valAngle.textContent = parseFloat(sliderAngle.value).toFixed(2)
}

function applyJointOverrides(): void {
  if (!state || state.jointOverrides.size === 0) return

  for (const [idx, override] of state.jointOverrides) {
    const rj = state.physics.ragdoll.joints[idx]
    if (rj) {
      rj.joint.configureMotorPosition(override.targetAngle, override.stiffness, override.damping)
    }
  }
}

// ─── Debug Rendering ────────────────────────────────────────────────────────

function renderDebug(ctx: CanvasRenderingContext2D): void {
  if (!state) return

  if (state.debug.showRapierDebug) {
    renderRapierDebug(ctx)
  }

  if (state.debug.showTargetSkeleton) {
    renderTargetSkeleton(ctx)
  }
}

function renderRapierDebug(ctx: CanvasRenderingContext2D): void {
  if (!state) return
  const { world } = state.physics

  const debugRender = world.debugRender()
  const vertices = debugRender.vertices
  const colors = debugRender.colors

  ctx.lineWidth = 1
  for (let i = 0; i < vertices.length / 4; i++) {
    const x1 = vertices[i * 4]
    const y1 = vertices[i * 4 + 1]
    const x2 = vertices[i * 4 + 2]
    const y2 = vertices[i * 4 + 3]

    const r = Math.floor(colors[i * 8] * 255)
    const g = Math.floor(colors[i * 8 + 1] * 255)
    const b = Math.floor(colors[i * 8 + 2] * 255)

    ctx.strokeStyle = `rgb(${r},${g},${b})`
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
}

// Named poses (duplicated from scene-interpreter for target skeleton rendering)
const POSES: Record<string, number[]> = {
  standing:  [0, 0.15, 0, -0.15, 0, 0, 0, 0, 0],
  pointing:  [0.1, 0.15, 0, -1.2, 0.1, 0, 0, 0, 0],
  victory:   [0, -2.2, -0.3, 2.2, 0.3, 0, 0, 0, 0],
  running0:  [0, 0.3, -0.5, -0.5, -0.3, 0.6, -0.8, -0.3, -0.1],
  running1:  [0, -0.5, -0.3, 0.3, -0.5, -0.3, -0.1, 0.6, -0.8],
  kick:      [0, 0.3, -0.5, -0.5, -0.3, -0.3, -0.1, 1.2, -0.1],
  climbing0: [0, -1.0, -1.5, 0.8, -0.5, 0.8, -1.0, -0.2, -0.3],
  climbing1: [0, 0.8, -0.5, -1.0, -1.5, -0.2, -0.3, 0.8, -1.0],
}

function renderTargetSkeleton(ctx: CanvasRenderingContext2D): void {
  if (!state) return

  // Compute target joint angles from current active beat steps
  const ragdoll = state.physics.ragdoll
  const torsoPos = ragdoll.torso.translation()

  // Draw target skeleton in cyan
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = '#00e5ff'
  ctx.lineWidth = 1.5

  // Draw current target pose as wireframe from torso position
  // Use the joint stand angles or current motor targets
  const joints = ragdoll.joints

  // Draw angle labels for each joint
  for (let i = 0; i < joints.length; i++) {
    const rj = joints[i]
    // Compute actual joint angle from body rotations
    const body1Rot = rj.joint.body1().rotation()
    const body2Rot = rj.joint.body2().rotation()
    const actual = body2Rot - body1Rot
    const target = rj.standAngle

    // Get joint anchor position (approximate from body positions)
    const body2 = rj.joint.body2()
    const pos = body2.translation()

    ctx.globalAlpha = 0.8
    ctx.font = '10px Inter, monospace'
    ctx.fillStyle = '#00e5ff'
    ctx.fillText(
      `${JOINT_NAMES[i]}: ${actual.toFixed(1)} / ${target.toFixed(1)}`,
      pos.x + 8,
      pos.y - 4
    )
  }

  ctx.restore()
}

// ─── Game Loop ──────────────────────────────────────────────────────────────

function gameLoop(): void {
  if (!state) return

  const TARGET_FRAME_TIME = 1000 / 60
  let lastTime = performance.now()
  let accumulator = 0
  let frameCount = 0
  let fpsDisplay = '0'
  let fpsTimer = 0

  function loop(now: number): void {
    if (!state) return

    const dt = now - lastTime
    lastTime = now
    accumulator += dt

    // FPS counter (counts actual update ticks, not rAF calls)
    fpsTimer += dt

    if (accumulator >= TARGET_FRAME_TIME) {
      accumulator -= TARGET_FRAME_TIME
      // Prevent spiral of death
      if (accumulator > TARGET_FRAME_TIME * 4) accumulator = 0

      frameCount++

      const { physics, ctx: renderCtx, driver, activeScene } = state

      // Advance driver (auto-play tick)
      let driverTicked = false
      if (driver && driver.isPlaying()) {
        driver.tick()
        driverTicked = true
      }

      // Step physics ONLY when the driver ticked (play mode or manual step)
      // This locks physics to the driver's frame count — no free-running
      if (activeScene && activeScene.lifecycle === 'active' && (driverTicked || state.pendingStep)) {
        stepPhysics(physics)
        state.pendingStep = false

        // Apply joint overrides after scene-interpreter has set poses
        applyJointOverrides()
      }

      // Render
      render(renderCtx, canvas, physics, undefined, activeScene?.dynamicBodies)

      // Debug overlays
      renderDebug(renderCtx)

      // HUD
      const beatTitle = activeScene ? activeScene.beat.title : 'none'
      const progress = driver ? (driver.getProgress() * 100).toFixed(0) : '0'
      hudEl.textContent = `${fpsDisplay} fps · ${beatTitle} · ${progress}%`
    }

    if (fpsTimer > 500) {
      fpsDisplay = Math.round((frameCount / fpsTimer) * 1000).toString()
      frameCount = 0
      fpsTimer = 0
    }

    requestAnimationFrame(loop)
  }

  requestAnimationFrame(loop)
}

// ─── Start ──────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Failed to initialize sandbox:', err)
  document.body.innerHTML = `
    <div style="color: #ff6b6b; padding: 2rem; font-family: monospace;">
      <h2>Failed to initialize Animation Gym</h2>
      <pre>${err instanceof Error ? err.message : String(err)}</pre>
    </div>
  `
})
