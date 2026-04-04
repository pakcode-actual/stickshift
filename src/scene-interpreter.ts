import RAPIER from '@dimforge/rapier2d-compat'
import type { SceneBeat, BeatStep, Actor, SceneLifecycle, CameraConfig } from './scene-types'
import type { PhysicsWorld, Ragdoll } from './physics'
import {
  teleportRagdoll,
  freezeRagdoll,
  unfreezeRagdoll,
  setMotorBlend,
  setMotorPose,
  goLimp,
  launchBeachBall,
  hideBeachBall,
  createDynamicProp,
  destroyAllSceneBodies,
  applyImpulse,
  setGravityOverride,
  createParticleBatch,
} from './physics'
import type { SkeletonPose, SkeletonPositions, KinematicColliders } from './kinematic-skeleton'
import { computeFK, computeRootY, createKinematicColliders, updateKinematicColliders, destroyKinematicColliders } from './kinematic-skeleton'
import type { AnimationDriver } from './animation-driver'
import { createAnimationDriver } from './animation-driver'

// Default motor stiffness (matches MOTOR_STIFFNESS in physics.ts)
const MOTOR_STIFFNESS_DEFAULT = 600

// ─── Named Poses ────────────────────────────────────────────────────────────
// Joint order: neck, shoulderL, elbowL, shoulderR, elbowR, hipL, kneeL, hipR, kneeR

const POSES: Record<string, number[]> = {
  standing:  [0, 0.15, 0, -0.15, 0, 0, 0, 0, 0],
  pointing:  [0.1, 0.15, 0, -1.2, 0.1, 0, 0, 0, 0],
  victory:   [0, -2.2, -0.3, 2.2, 0.3, 0, 0, 0, 0],
  running0:  [0, 0.3, -0.5, -0.5, -0.3, 0.6, -0.8, -0.3, -0.1],
  running1:  [0, -0.5, -0.3, 0.3, -0.5, -0.3, -0.1, 0.6, -0.8],
  kick:      [0, 0.3, -0.5, -0.5, -0.3, -0.3, -0.1, 1.2, -0.1],
  climbing0: [0, -1.0, -1.5, 0.8, -0.5, 0.8, -1.0, -0.2, -0.3],
  climbing1: [0, 0.8, -0.5, -1.0, -1.5, -0.2, -0.3, 0.8, -1.0],

  // The Fall poses
  falling:   [-0.3, -2.2, -0.8, 2.2, 0.8, 0.15, 0, -0.15, 0],
  crouching: [0.2, 0.5, -1.0, -0.5, 1.0, -0.3, -1.2, -0.3, -1.2],

  // The Kick poses
  windup:        [0.1, 0.6, -0.8, -0.6, 0.8, -0.2, -1.0, -0.2, -1.0],
  'kick-extend': [0, 0.3, -0.4, -0.4, 0.3, 0.2, -0.2, -0.5, 0],
  landing:       [0, 0.2, -0.3, -0.2, 0.3, 0, -0.4, 0, -0.4],
}

// ─── Scene Instance ─────────────────────────────────────────────────────────

export interface SceneInstance {
  beat: SceneBeat
  lifecycle: SceneLifecycle
  dynamicBodies: RAPIER.RigidBody[]
  executedActions: Set<string>
  transitionOpacity: number
  // Kinematic mode state
  animationDriver: AnimationDriver | null
  kinematicColliders: KinematicColliders | null
  kinematicPose: SkeletonPose | null
  kinematicPositions: SkeletonPositions | null
  kinematicRoot: { x: number; y: number } | null
}

// ─── Scene Interpreter ──────────────────────────────────────────────────────

export function createSceneInstance(beat: SceneBeat): SceneInstance {
  return {
    beat,
    lifecycle: 'unloaded',
    dynamicBodies: [],
    executedActions: new Set(),
    transitionOpacity: 0,
    animationDriver: null,
    kinematicColliders: null,
    kinematicPose: null,
    kinematicPositions: null,
    kinematicRoot: null,
  }
}

/** Activate a scene: create physics bodies, position ragdoll */
export function activateScene(
  instance: SceneInstance,
  physics: PhysicsWorld
): void {
  instance.lifecycle = 'active'
  instance.executedActions.clear()
  instance.transitionOpacity = 1

  // Apply scene-level physics overrides
  if (instance.beat.physics?.gravity) {
    setGravityOverride(physics, instance.beat.physics.gravity)
  }

  // Kinematic mode: skeleton is canvas-drawn, not a Rapier body
  if (instance.beat.mode === 'kinematic' && instance.beat.keyframes) {
    // Park ragdoll off-screen and freeze it
    teleportRagdoll(physics.ragdoll, -500, -500)
    freezeRagdoll(physics.ragdoll)
    hideBeachBall(physics)

    // Create animation driver from keyframe definitions
    instance.animationDriver = createAnimationDriver(instance.beat.keyframes)

    // Create kinematic colliders for confetti interaction
    instance.kinematicColliders = createKinematicColliders(physics)

    // Compute root position: centered horizontally, feet on ground
    const ragdollActor = instance.beat.actors.find(a => a.type === 'ragdoll')
    const rootX = ragdollActor
      ? ragdollActor.position[0] * physics.sceneWidth
      : physics.sceneWidth / 2
    instance.kinematicRoot = { x: rootX, y: computeRootY(physics.groundY) }

    // Still process non-ragdoll actors (particle emitters, props)
    for (const actor of instance.beat.actors) {
      if (actor.type === 'prop') {
        const px = actor.position[0] * physics.sceneWidth
        const py = actor.position[1] * physics.sceneHeight
        const body = createDynamicProp(physics, actor.propType ?? 'box', px, py, actor.physics)
        if (actor.velocity) {
          body.setLinvel(new RAPIER.Vector2(actor.velocity[0], actor.velocity[1]), true)
        }
        instance.dynamicBodies.push(body)
      }
    }
    return
  }

  // Process actors — positions in JSON are normalized [0,1], scale to pixels
  for (const actor of instance.beat.actors) {
    const px = actor.position[0] * physics.sceneWidth
    const py = actor.position[1] * physics.sceneHeight

    if (actor.type === 'ragdoll') {
      freezeRagdoll(physics.ragdoll)
      teleportRagdoll(physics.ragdoll, px, py)
      setMotorBlend(physics.ragdoll, 1.0)
    } else if (actor.type === 'prop') {
      const body = createDynamicProp(
        physics,
        actor.propType ?? 'box',
        px,
        py,
        actor.physics
      )
      if (actor.velocity) {
        body.setLinvel(
          new RAPIER.Vector2(actor.velocity[0], actor.velocity[1]),
          true
        )
      }
      instance.dynamicBodies.push(body)
    } else if (actor.type === 'particle-emitter') {
      // Particles are created lazily via beat steps, not on activation
    }
  }
}

/** Deactivate a scene: destroy all dynamic bodies, reset state */
export function deactivateScene(
  instance: SceneInstance,
  physics: PhysicsWorld
): void {
  destroyAllSceneBodies(physics, instance.dynamicBodies)
  instance.dynamicBodies = []
  instance.lifecycle = 'unloaded'
  instance.transitionOpacity = 0

  // Clean up kinematic mode state
  if (instance.animationDriver) {
    instance.animationDriver.destroy()
    instance.animationDriver = null
  }
  if (instance.kinematicColliders) {
    destroyKinematicColliders(physics, instance.kinematicColliders)
    instance.kinematicColliders = null
  }
  instance.kinematicPose = null
  instance.kinematicPositions = null
  instance.kinematicRoot = null

  // Reset gravity to default
  setGravityOverride(physics, [0, 980])
}

/** Compute local progress within a scene given global scroll progress */
export function getLocalProgress(instance: SceneInstance, globalProgress: number): number {
  const [start, end] = instance.beat.scrollRange
  const range = end - start
  if (range <= 0) return 0
  return Math.max(0, Math.min(1, (globalProgress - start) / range))
}

/** Execute beat steps for the current local progress */
export function updateScene(
  instance: SceneInstance,
  localProgress: number,
  physics: PhysicsWorld
): void {
  if (instance.lifecycle !== 'active') return

  // Update kinematic animation if applicable
  if (instance.animationDriver && instance.kinematicRoot) {
    instance.kinematicPose = instance.animationDriver.update(localProgress)
    instance.kinematicPositions = computeFK(instance.kinematicPose, instance.kinematicRoot)
    if (instance.kinematicColliders) {
      updateKinematicColliders(instance.kinematicColliders, instance.kinematicPositions, instance.kinematicPose)
    }
  }

  for (const step of instance.beat.beats) {
    const [stepStart, stepEnd] = step.scrollRange
    const actionKey = `${step.action}:${step.target}:${stepStart}`

    if (localProgress >= stepStart && localProgress <= stepEnd) {
      // Within this step's range — execute/update
      const stepProgress = stepEnd > stepStart
        ? (localProgress - stepStart) / (stepEnd - stepStart)
        : 1

      executeStep(step, stepProgress, instance, physics, actionKey)
    } else if (localProgress < stepStart && instance.executedActions.has(actionKey)) {
      // Scrolled back before this step — revert
      revertStep(step, instance, physics, actionKey)
    }
  }
}

function executeStep(
  step: BeatStep,
  stepProgress: number,
  instance: SceneInstance,
  physics: PhysicsWorld,
  actionKey: string
): void {
  const ragdoll = physics.ragdoll
  const easedProgress = applyEasing(stepProgress, step.easing ?? 'linear')

  switch (step.action) {
    case 'freeze':
      if (!instance.executedActions.has(actionKey)) {
        freezeRagdoll(ragdoll)
        instance.executedActions.add(actionKey)
      }
      break

    case 'drop':
      if (!instance.executedActions.has(actionKey)) {
        unfreezeRagdoll(ragdoll)
        const actor = instance.beat.actors.find(a => a.id === step.target)
        if (actor) {
          teleportRagdoll(ragdoll, actor.position[0] * physics.sceneWidth, actor.position[1] * physics.sceneHeight)
        }
        setMotorBlend(ragdoll, step.motorBlend ?? 0.8, step.motorStiffness)
        instance.executedActions.add(actionKey)
      }
      break

    case 'go-limp':
      if (!instance.executedActions.has(actionKey)) {
        goLimp(ragdoll)
        instance.executedActions.add(actionKey)
      }
      break

    case 'stand-up':
      // Continuous — ramp motor blend over the step range
      // Smoothly ramp stiffness from freefall-level to active-level
      {
        const targetStiff = step.motorStiffness ?? MOTOR_STIFFNESS_DEFAULT
        const rampedStiff = 10 + (targetStiff - 10) * easedProgress
        setMotorBlend(ragdoll, easedProgress * (step.motorBlend ?? 1.0), rampedStiff)
      }
      instance.executedActions.add(actionKey)
      break

    case 'hold-pose':
      if (step.pose && POSES[step.pose]) {
        setMotorPose(ragdoll, POSES[step.pose], step.motorBlend ?? 1.0, step.motorStiffness)
      } else {
        setMotorBlend(ragdoll, step.motorBlend ?? 1.0, step.motorStiffness)
      }
      instance.executedActions.add(actionKey)
      break

    case 'launch-ball':
      if (!instance.executedActions.has(actionKey)) {
        launchBeachBall(physics)
        instance.executedActions.add(actionKey)
      }
      break

    case 'hide-ball':
      if (!instance.executedActions.has(actionKey)) {
        hideBeachBall(physics)
        instance.executedActions.add(actionKey)
      }
      break

    case 'impulse': {
      if (!instance.executedActions.has(actionKey) && step.impulse) {
        // Find the prop body by matching actor id to creation order
        const actorIndex = instance.beat.actors
          .filter(a => a.type === 'prop')
          .findIndex(a => a.id === step.target)
        if (actorIndex >= 0 && actorIndex < instance.dynamicBodies.length) {
          applyImpulse(instance.dynamicBodies[actorIndex], step.impulse)
        }
        // Also apply impulse to ragdoll if target is ragdoll
        const isRagdoll = instance.beat.actors.find(a => a.id === step.target && a.type === 'ragdoll')
        if (isRagdoll) {
          ragdoll.torso.applyImpulse(
            new RAPIER.Vector2(step.impulse[0], step.impulse[1]),
            true
          )
        }
        instance.executedActions.add(actionKey)
      }
      break
    }

    case 'run': {
      // Alternate between running poses based on progress
      const phase = Math.floor(easedProgress * 8) % 2
      const poseName = phase === 0 ? 'running0' : 'running1'
      setMotorPose(ragdoll, POSES[poseName], step.motorBlend ?? 0.9, step.motorStiffness)
      // Move ragdoll horizontally
      const actor = instance.beat.actors.find(a => a.id === step.target)
      if (actor) {
        const startX = actor.position[0] * physics.sceneWidth
        const endX = physics.sceneWidth * 0.6
        const targetX = startX + (endX - startX) * easedProgress
        const torsoPos = ragdoll.torso.translation()
        const dx = targetX - torsoPos.x
        ragdoll.torso.setLinvel(new RAPIER.Vector2(dx * 3, ragdoll.torso.linvel().y), true)
      }
      instance.executedActions.add(actionKey)
      break
    }

    case 'kick': {
      if (!instance.executedActions.has(actionKey)) {
        setMotorPose(ragdoll, POSES['kick'], step.motorBlend ?? 1.0, step.motorStiffness)
        instance.executedActions.add(actionKey)
      }
      break
    }

    case 'ramp-pose': {
      // Gradually ramp motor blend toward a named pose over the step range
      // Also ramp stiffness from freefall-level to target
      const poseName = step.pose
      if (poseName && POSES[poseName]) {
        const targetStiff = step.motorStiffness ?? MOTOR_STIFFNESS_DEFAULT
        const rampedStiff = 10 + (targetStiff - 10) * easedProgress
        setMotorPose(ragdoll, POSES[poseName], easedProgress * (step.motorBlend ?? 1.0), rampedStiff)
      }
      instance.executedActions.add(actionKey)
      break
    }

    case 'climb': {
      const phase = Math.floor(easedProgress * 6) % 2
      const poseName = phase === 0 ? 'climbing0' : 'climbing1'
      setMotorPose(ragdoll, POSES[poseName], step.motorBlend ?? 0.9, step.motorStiffness)
      // Move ragdoll upward
      const torsoPos = ragdoll.torso.translation()
      const targetY = physics.groundY - 100 - easedProgress * 300
      const dy = targetY - torsoPos.y
      ragdoll.torso.setLinvel(new RAPIER.Vector2(ragdoll.torso.linvel().x, dy * 2), true)
      instance.executedActions.add(actionKey)
      break
    }

    case 'spawn-particles': {
      if (!instance.executedActions.has(actionKey)) {
        const actor = instance.beat.actors.find(a => a.id === step.target && a.type === 'particle-emitter')
        if (actor) {
          const particles = createParticleBatch(
            physics,
            actor.count ?? 80,
            actor.position[0] * physics.sceneWidth,
            actor.position[1] * physics.sceneHeight,
            physics.sceneWidth * 0.8,
            actor.physics
          )
          instance.dynamicBodies.push(...particles)
        }
        instance.executedActions.add(actionKey)
      }
      break
    }

    default:
      // Unknown action — no-op
      break
  }
}

function revertStep(
  step: BeatStep,
  instance: SceneInstance,
  physics: PhysicsWorld,
  actionKey: string
): void {
  instance.executedActions.delete(actionKey)

  switch (step.action) {
    case 'drop':
      freezeRagdoll(physics.ragdoll)
      break
    case 'go-limp':
      setMotorBlend(physics.ragdoll, 0.8)
      break
    case 'launch-ball':
    case 'hide-ball':
      hideBeachBall(physics)
      break
    default:
      break
  }
}

function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case 'ease-in':
      return t * t
    case 'ease-out':
      return 1 - (1 - t) * (1 - t)
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    default:
      return t
  }
}

/** Compute transition opacity for crossfade between scenes */
export function computeTransitionOpacity(
  instance: SceneInstance,
  globalProgress: number
): number {
  const [start, end] = instance.beat.scrollRange
  const range = end - start
  const transInDur = (instance.beat.transitionIn?.duration ?? 0.05) * range
  const transOutDur = (instance.beat.transitionOut?.duration ?? 0.05) * range

  if (globalProgress < start) return 0
  if (globalProgress > end) return 0

  // Fade in
  if (globalProgress < start + transInDur) {
    return (globalProgress - start) / transInDur
  }
  // Fade out
  if (globalProgress > end - transOutDur) {
    return (end - globalProgress) / transOutDur
  }

  return 1
}

/** Get the camera config for the active scene, with interpolated follow */
export function getSceneCamera(
  instance: SceneInstance,
  localProgress: number,
  physics: PhysicsWorld
): { offsetX: number; offsetY: number; scale: number } {
  const cam = instance.beat.camera
  if (!cam || cam.type === 'static') {
    return { offsetX: 0, offsetY: 0, scale: 1 }
  }

  const scale = cam.scale ?? 1
  const baseOffsetX = cam.offset?.[0] ?? 0
  const baseOffsetY = cam.offset?.[1] ?? 0

  if (cam.type === 'follow') {
    const torsoPos = physics.ragdoll.torso.translation()
    const centerX = physics.sceneWidth / 2
    const centerY = physics.sceneHeight / 2
    return {
      offsetX: (centerX - torsoPos.x) * 0.3 + baseOffsetX,
      offsetY: (centerY - torsoPos.y) * 0.2 + baseOffsetY,
      scale,
    }
  }

  if (cam.type === 'pan') {
    return {
      offsetX: baseOffsetX,
      offsetY: baseOffsetY * localProgress,
      scale,
    }
  }

  if (cam.type === 'zoom') {
    const zoomProgress = 1 + (scale - 1) * localProgress
    return { offsetX: baseOffsetX, offsetY: baseOffsetY, scale: zoomProgress }
  }

  return { offsetX: 0, offsetY: 0, scale: 1 }
}
