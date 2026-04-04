import RAPIER from '@dimforge/rapier2d-compat'
import type { PhysicsWorld } from './physics'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SkeletonPose {
  head: number       // neck joint angle
  shoulderL: number  // left shoulder angle
  elbowL: number     // left elbow angle
  shoulderR: number  // right shoulder angle
  elbowR: number     // right elbow angle
  hipL: number       // left hip angle
  kneeL: number      // left knee angle
  hipR: number       // right hip angle
  kneeR: number      // right knee angle
}

interface Point {
  x: number
  y: number
}

export interface SkeletonPositions {
  head: Point
  torso: Point
  upperArmL: Point
  lowerArmL: Point
  upperArmR: Point
  lowerArmR: Point
  upperLegL: Point
  lowerLegL: Point
  upperLegR: Point
  lowerLegR: Point
}

// ─── Bone geometry from physics.ts ──────────────────────────────────────────
// All values sourced from createRagdoll joint anchors and capsule dimensions

const HEAD_RADIUS = 14

// Joint attachment points on torso (from physics.ts joint anchor1 values)
const NECK = { x: 0, y: -30 }
const SHOULDER_L = { x: -10, y: -24 }
const SHOULDER_R = { x: 10, y: -24 }
const HIP_L = { x: -6, y: 30 }
const HIP_R = { x: 6, y: 30 }

// Bone half-lengths (capsule halfH values from physics.ts)
const UPPER_ARM_HALF = 16
const LOWER_ARM_HALF = 16
const UPPER_LEG_HALF = 20
const LOWER_LEG_HALF = 20

// ─── Forward Kinematics ────────────────────────────────────────────────────

function rotateVec(angle: number, dx: number, dy: number): Point {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: dx * c - dy * s, y: dx * s + dy * c }
}

export function computeFK(pose: SkeletonPose, root: Point): SkeletonPositions {
  const torso = root

  // Head: extends upward from neck joint
  const neck = { x: torso.x + NECK.x, y: torso.y + NECK.y }
  const headOff = rotateVec(pose.head, 0, -HEAD_RADIUS)
  const head = { x: neck.x + headOff.x, y: neck.y + headOff.y }

  // Left arm: shoulder → upper arm center → elbow → lower arm center
  const shL = { x: torso.x + SHOULDER_L.x, y: torso.y + SHOULDER_L.y }
  const uaOffL = rotateVec(pose.shoulderL, 0, UPPER_ARM_HALF)
  const upperArmL = { x: shL.x + uaOffL.x, y: shL.y + uaOffL.y }
  const elOffL = rotateVec(pose.shoulderL, 0, UPPER_ARM_HALF * 2)
  const elbowL = { x: shL.x + elOffL.x, y: shL.y + elOffL.y }
  const laOffL = rotateVec(pose.shoulderL + pose.elbowL, 0, LOWER_ARM_HALF)
  const lowerArmL = { x: elbowL.x + laOffL.x, y: elbowL.y + laOffL.y }

  // Right arm
  const shR = { x: torso.x + SHOULDER_R.x, y: torso.y + SHOULDER_R.y }
  const uaOffR = rotateVec(pose.shoulderR, 0, UPPER_ARM_HALF)
  const upperArmR = { x: shR.x + uaOffR.x, y: shR.y + uaOffR.y }
  const elOffR = rotateVec(pose.shoulderR, 0, UPPER_ARM_HALF * 2)
  const elbowR = { x: shR.x + elOffR.x, y: shR.y + elOffR.y }
  const laOffR = rotateVec(pose.shoulderR + pose.elbowR, 0, LOWER_ARM_HALF)
  const lowerArmR = { x: elbowR.x + laOffR.x, y: elbowR.y + laOffR.y }

  // Left leg: hip → upper leg center → knee → lower leg center
  const hL = { x: torso.x + HIP_L.x, y: torso.y + HIP_L.y }
  const ulOffL = rotateVec(pose.hipL, 0, UPPER_LEG_HALF)
  const upperLegL = { x: hL.x + ulOffL.x, y: hL.y + ulOffL.y }
  const knOffL = rotateVec(pose.hipL, 0, UPPER_LEG_HALF * 2)
  const kneeL = { x: hL.x + knOffL.x, y: hL.y + knOffL.y }
  const llOffL = rotateVec(pose.hipL + pose.kneeL, 0, LOWER_LEG_HALF)
  const lowerLegL = { x: kneeL.x + llOffL.x, y: kneeL.y + llOffL.y }

  // Right leg
  const hR = { x: torso.x + HIP_R.x, y: torso.y + HIP_R.y }
  const ulOffR = rotateVec(pose.hipR, 0, UPPER_LEG_HALF)
  const upperLegR = { x: hR.x + ulOffR.x, y: hR.y + ulOffR.y }
  const knOffR = rotateVec(pose.hipR, 0, UPPER_LEG_HALF * 2)
  const kneeR = { x: hR.x + knOffR.x, y: hR.y + knOffR.y }
  const llOffR = rotateVec(pose.hipR + pose.kneeR, 0, LOWER_LEG_HALF)
  const lowerLegR = { x: kneeR.x + llOffR.x, y: kneeR.y + llOffR.y }

  return {
    head, torso,
    upperArmL, lowerArmL, upperArmR, lowerArmR,
    upperLegL, lowerLegL, upperLegR, lowerLegR,
  }
}

/** Compute root Y so the figure stands on the ground line.
 *  Standing foot offset: hip.y(30) + upperLeg(40) + halfLowerLeg(20) = 90 */
export function computeRootY(groundY: number): number {
  return groundY - 93
}

// ─── Canvas Drawing (matches renderer.ts style) ────────────────────────────

export function drawKinematicSkeleton(
  ctx: CanvasRenderingContext2D,
  positions: SkeletonPositions,
  headAngle: number
): void {
  const {
    head, torso,
    upperArmL, lowerArmL, upperArmR, lowerArmR,
    upperLegL, lowerLegL, upperLegR, lowerLegR,
  } = positions

  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const limbs: [Point, Point][] = [
    [head, torso],
    [torso, upperArmL],
    [upperArmL, lowerArmL],
    [torso, upperArmR],
    [upperArmR, lowerArmR],
    [torso, upperLegL],
    [upperLegL, lowerLegL],
    [torso, upperLegR],
    [upperLegR, lowerLegR],
  ]

  for (const [a, b] of limbs) {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  // Hands
  drawDot(ctx, lowerArmL, 3, '#e0e0e0')
  drawDot(ctx, lowerArmR, 3, '#e0e0e0')

  // Feet
  drawDot(ctx, lowerLegL, 3.5, '#e0e0e0')
  drawDot(ctx, lowerLegR, 3.5, '#e0e0e0')

  // Head circle
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 2.5
  ctx.fillStyle = '#0a0a0a'
  ctx.beginPath()
  ctx.arc(head.x, head.y, HEAD_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Eyes
  const eyeOffsetX = Math.cos(headAngle) * 5
  const eyeOffsetY = Math.sin(headAngle) * 5
  drawDot(ctx, { x: head.x - eyeOffsetY - eyeOffsetX * 0.4, y: head.y + eyeOffsetX - eyeOffsetY * 0.4 - 2 }, 1.5, '#e0e0e0')
  drawDot(ctx, { x: head.x - eyeOffsetY + eyeOffsetX * 0.4, y: head.y + eyeOffsetX + eyeOffsetY * 0.4 - 2 }, 1.5, '#e0e0e0')

  // Subtle glow (matches renderer.ts)
  ctx.shadowColor = 'rgba(224, 224, 224, 0.15)'
  ctx.shadowBlur = 6
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 2.5
  for (const [a, b] of limbs) {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
}

function drawDot(ctx: CanvasRenderingContext2D, pos: Point, radius: number, color: string): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
  ctx.fill()
}

// ─── Sensor Colliders for Confetti Interaction ─────────────────────────────

const WORLD_COLLISION_GROUP = (0xFFFF << 16) | 0x0002

export interface KinematicColliders {
  bodies: RAPIER.RigidBody[]
}

export function createKinematicColliders(physics: PhysicsWorld): KinematicColliders {
  const bodies: RAPIER.RigidBody[] = []

  // Order: torso, head, upperArmL, upperArmR, lowerArmL, lowerArmR,
  //        upperLegL, upperLegR, lowerLegL, lowerLegR
  bodies.push(createKinematicLimb(physics, 8, 30, false))     // torso
  bodies.push(createKinematicLimb(physics, HEAD_RADIUS, 0, true)) // head (ball)
  bodies.push(createKinematicLimb(physics, 5, UPPER_ARM_HALF, false))  // upper arm L
  bodies.push(createKinematicLimb(physics, 5, UPPER_ARM_HALF, false))  // upper arm R
  bodies.push(createKinematicLimb(physics, 4, LOWER_ARM_HALF, false))  // lower arm L
  bodies.push(createKinematicLimb(physics, 4, LOWER_ARM_HALF, false))  // lower arm R
  bodies.push(createKinematicLimb(physics, 5, UPPER_LEG_HALF, false))  // upper leg L
  bodies.push(createKinematicLimb(physics, 5, UPPER_LEG_HALF, false))  // upper leg R
  bodies.push(createKinematicLimb(physics, 4, LOWER_LEG_HALF, false))  // lower leg L
  bodies.push(createKinematicLimb(physics, 4, LOWER_LEG_HALF, false))  // lower leg R

  return { bodies }
}

function createKinematicLimb(
  physics: PhysicsWorld,
  halfW: number,
  halfH: number,
  isCircle: boolean
): RAPIER.RigidBody {
  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(-500, -500)
  const body = physics.world.createRigidBody(bodyDesc)

  const colliderDesc = isCircle
    ? RAPIER.ColliderDesc.ball(halfW)
    : RAPIER.ColliderDesc.capsule(halfH, halfW)

  colliderDesc
    .setFriction(0.5)
    .setRestitution(0.1)
    .setCollisionGroups(WORLD_COLLISION_GROUP)

  physics.world.createCollider(colliderDesc, body)
  return body
}

export function updateKinematicColliders(
  colliders: KinematicColliders,
  positions: SkeletonPositions,
  pose: SkeletonPose
): void {
  const mapping: { pos: Point; rot: number }[] = [
    { pos: positions.torso, rot: 0 },
    { pos: positions.head, rot: pose.head },
    { pos: positions.upperArmL, rot: pose.shoulderL },
    { pos: positions.upperArmR, rot: pose.shoulderR },
    { pos: positions.lowerArmL, rot: pose.shoulderL + pose.elbowL },
    { pos: positions.lowerArmR, rot: pose.shoulderR + pose.elbowR },
    { pos: positions.upperLegL, rot: pose.hipL },
    { pos: positions.upperLegR, rot: pose.hipR },
    { pos: positions.lowerLegL, rot: pose.hipL + pose.kneeL },
    { pos: positions.lowerLegR, rot: pose.hipR + pose.kneeR },
  ]

  for (let i = 0; i < colliders.bodies.length; i++) {
    const { pos, rot } = mapping[i]
    colliders.bodies[i].setTranslation(new RAPIER.Vector2(pos.x, pos.y), true)
    colliders.bodies[i].setRotation(rot, true)
  }
}

export function destroyKinematicColliders(
  physics: PhysicsWorld,
  colliders: KinematicColliders
): void {
  for (const body of colliders.bodies) {
    physics.world.removeRigidBody(body)
  }
  colliders.bodies.length = 0
}
