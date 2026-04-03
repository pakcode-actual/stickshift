import RAPIER from '@dimforge/rapier2d-compat'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RagdollJoint {
  joint: RAPIER.RevoluteImpulseJoint
  standAngle: number
}

export interface Ragdoll {
  head: RAPIER.RigidBody
  torso: RAPIER.RigidBody
  upperArmL: RAPIER.RigidBody
  lowerArmL: RAPIER.RigidBody
  upperArmR: RAPIER.RigidBody
  lowerArmR: RAPIER.RigidBody
  upperLegL: RAPIER.RigidBody
  lowerLegL: RAPIER.RigidBody
  upperLegR: RAPIER.RigidBody
  lowerLegR: RAPIER.RigidBody
  bodies: RAPIER.RigidBody[]
  joints: RagdollJoint[]
}

export interface BeachBall {
  body: RAPIER.RigidBody
  radius: number
}

export interface PhysicsWorld {
  rapier: typeof RAPIER
  world: RAPIER.World
  eventQueue: RAPIER.EventQueue
  ragdoll: Ragdoll
  beachBall: BeachBall
  ground: RAPIER.RigidBody
  groundY: number
  sceneWidth: number
  sceneHeight: number
}

export interface Obstacle {
  x: number
  y: number
  width: number
  height: number
}

// ─── Deterministic PRNG (mulberry32) ────────────────────────────────────────

let _rngState = 42

export function seedRng(seed: number): void {
  _rngState = seed | 0
}

function deterministicRandom(): number {
  _rngState = (_rngState + 0x6d2b79f5) | 0
  let t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BODY_FRICTION = 0.5
const BODY_RESTITUTION = 0.1
const BODY_DENSITY = 1.5
const LIMB_DAMPING = 3.0
const ANGULAR_DAMPING = 12.0

// Motor control — must be strong enough to overcome gravity (980) on dense limbs
const MOTOR_STIFFNESS = 600.0
const MOTOR_DAMPING = 60.0

// Collision groups: ragdoll limbs don't collide with each other
// Format: upper 16 bits = filter (what groups I interact with), lower 16 bits = membership
const RAGDOLL_COLLISION_GROUP = (0xFFFE << 16) | 0x0001  // member of group 0, interacts with all EXCEPT group 0
const WORLD_COLLISION_GROUP = (0xFFFF << 16) | 0x0002    // member of group 1, interacts with all

// ─── Initialization ──────────────────────────────────────────────────────────

export async function initPhysics(
  sceneWidth: number,
  sceneHeight: number
): Promise<PhysicsWorld> {
  await RAPIER.init()

  const gravity = new RAPIER.Vector2(0.0, 980.0) // px/s², Y-down
  const world = new RAPIER.World(gravity)
  world.timestep = 1 / 60

  const eventQueue = new RAPIER.EventQueue(true)

  const groundY = sceneHeight - 80
  const ground = createGround(world, sceneWidth, groundY)

  // Create walls to keep things in-frame
  createWalls(world, sceneWidth, sceneHeight)

  const ragdoll = createRagdoll(world, sceneWidth / 2, -200)
  const beachBall = createBeachBall(world, sceneWidth * 0.75, -400)

  return {
    rapier: RAPIER,
    world,
    eventQueue,
    ragdoll,
    beachBall,
    ground,
    groundY,
    sceneWidth,
    sceneHeight,
  }
}

// ─── Ground & Walls ──────────────────────────────────────────────────────────

function createGround(
  world: RAPIER.World,
  sceneWidth: number,
  groundY: number
): RAPIER.RigidBody {
  const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
    sceneWidth / 2,
    groundY
  )
  const body = world.createRigidBody(bodyDesc)
  const colliderDesc = RAPIER.ColliderDesc.cuboid(sceneWidth / 2, 20)
    .setFriction(0.8)
    .setRestitution(0.1)
    .setCollisionGroups(WORLD_COLLISION_GROUP)
  world.createCollider(colliderDesc, body)
  return body
}

function createWalls(
  world: RAPIER.World,
  sceneWidth: number,
  sceneHeight: number
): void {
  // Left wall
  const leftDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(-10, sceneHeight / 2)
  const leftBody = world.createRigidBody(leftDesc)
  world.createCollider(RAPIER.ColliderDesc.cuboid(10, sceneHeight).setCollisionGroups(WORLD_COLLISION_GROUP), leftBody)

  // Right wall
  const rightDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(sceneWidth + 10, sceneHeight / 2)
  const rightBody = world.createRigidBody(rightDesc)
  world.createCollider(RAPIER.ColliderDesc.cuboid(10, sceneHeight).setCollisionGroups(WORLD_COLLISION_GROUP), rightBody)
}

// ─── Ragdoll Creation ────────────────────────────────────────────────────────

function createDynamicBody(
  world: RAPIER.World,
  x: number,
  y: number,
  halfW: number,
  halfH: number,
  isCircle: boolean = false
): RAPIER.RigidBody {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y)
    .setLinearDamping(LIMB_DAMPING)
    .setAngularDamping(ANGULAR_DAMPING)

  const body = world.createRigidBody(bodyDesc)

  const colliderDesc = isCircle
    ? RAPIER.ColliderDesc.ball(halfW)
    : RAPIER.ColliderDesc.capsule(halfH, halfW)

  colliderDesc
    .setFriction(BODY_FRICTION)
    .setRestitution(BODY_RESTITUTION)
    .setDensity(BODY_DENSITY)
    .setCollisionGroups(RAGDOLL_COLLISION_GROUP)

  world.createCollider(colliderDesc, body)
  return body
}

function createRevoluteJoint(
  world: RAPIER.World,
  body1: RAPIER.RigidBody,
  body2: RAPIER.RigidBody,
  anchor1: { x: number; y: number },
  anchor2: { x: number; y: number },
  standAngle: number,
  limits?: [number, number]
): RagdollJoint {
  const params = RAPIER.JointData.revolute(
    new RAPIER.Vector2(anchor1.x, anchor1.y),
    new RAPIER.Vector2(anchor2.x, anchor2.y)
  )

  const joint = world.createImpulseJoint(
    params, body1, body2, true
  ) as RAPIER.RevoluteImpulseJoint

  if (limits) {
    joint.setLimits(limits[0], limits[1])
  }

  // Start with strong motor for initial pose
  joint.configureMotorPosition(standAngle, MOTOR_STIFFNESS, MOTOR_DAMPING)

  return { joint, standAngle }
}

function createRagdoll(
  world: RAPIER.World,
  x: number,
  y: number
): Ragdoll {
  // Scale factor for the stick figure (pixels)
  const s = 1.0

  // ── Body parts (relative to spawn position) ──
  const head = createDynamicBody(world, x, y - 70 * s, 14 * s, 14 * s, true)
  const torso = createDynamicBody(world, x, y, 8 * s, 30 * s)

  // Arms
  const upperArmL = createDynamicBody(world, x - 28 * s, y - 18 * s, 5 * s, 16 * s)
  const lowerArmL = createDynamicBody(world, x - 28 * s, y + 16 * s, 4 * s, 16 * s)
  const upperArmR = createDynamicBody(world, x + 28 * s, y - 18 * s, 5 * s, 16 * s)
  const lowerArmR = createDynamicBody(world, x + 28 * s, y + 16 * s, 4 * s, 16 * s)

  // Legs
  const upperLegL = createDynamicBody(world, x - 10 * s, y + 50 * s, 5 * s, 20 * s)
  const lowerLegL = createDynamicBody(world, x - 10 * s, y + 92 * s, 4 * s, 20 * s)
  const upperLegR = createDynamicBody(world, x + 10 * s, y + 50 * s, 5 * s, 20 * s)
  const lowerLegR = createDynamicBody(world, x + 10 * s, y + 92 * s, 4 * s, 20 * s)

  const bodies = [
    head, torso,
    upperArmL, lowerArmL, upperArmR, lowerArmR,
    upperLegL, lowerLegL, upperLegR, lowerLegR,
  ]

  // ── Joints ──
  const joints: RagdollJoint[] = []

  // Neck: head ↔ torso
  joints.push(createRevoluteJoint(
    world, torso, head,
    { x: 0, y: -30 * s }, { x: 0, y: 14 * s },
    0, [-0.4, 0.4]
  ))

  // Left shoulder: torso ↔ upper arm L
  joints.push(createRevoluteJoint(
    world, torso, upperArmL,
    { x: -10 * s, y: -24 * s }, { x: 0, y: -16 * s },
    0.15, [-Math.PI * 0.75, Math.PI * 0.75]
  ))

  // Left elbow: upper arm L ↔ lower arm L
  joints.push(createRevoluteJoint(
    world, upperArmL, lowerArmL,
    { x: 0, y: 16 * s }, { x: 0, y: -16 * s },
    0, [-Math.PI * 0.6, 0.05]
  ))

  // Right shoulder: torso ↔ upper arm R
  joints.push(createRevoluteJoint(
    world, torso, upperArmR,
    { x: 10 * s, y: -24 * s }, { x: 0, y: -16 * s },
    -0.15, [-Math.PI * 0.75, Math.PI * 0.75]
  ))

  // Right elbow: upper arm R ↔ lower arm R
  joints.push(createRevoluteJoint(
    world, upperArmR, lowerArmR,
    { x: 0, y: 16 * s }, { x: 0, y: -16 * s },
    0, [-0.05, Math.PI * 0.6]
  ))

  // Left hip: torso ↔ upper leg L
  joints.push(createRevoluteJoint(
    world, torso, upperLegL,
    { x: -6 * s, y: 30 * s }, { x: 0, y: -20 * s },
    0, [-0.5, Math.PI * 0.5]
  ))

  // Left knee: upper leg L ↔ lower leg L
  joints.push(createRevoluteJoint(
    world, upperLegL, lowerLegL,
    { x: 0, y: 20 * s }, { x: 0, y: -20 * s },
    0, [-Math.PI * 0.6, 0.05]
  ))

  // Right hip: torso ↔ upper leg R
  joints.push(createRevoluteJoint(
    world, torso, upperLegR,
    { x: 6 * s, y: 30 * s }, { x: 0, y: -20 * s },
    0, [-0.5, Math.PI * 0.5]
  ))

  // Right knee: upper leg R ↔ lower leg R
  joints.push(createRevoluteJoint(
    world, upperLegR, lowerLegR,
    { x: 0, y: 20 * s }, { x: 0, y: -20 * s },
    0, [-Math.PI * 0.6, 0.05]
  ))

  return {
    head, torso,
    upperArmL, lowerArmL, upperArmR, lowerArmR,
    upperLegL, lowerLegL, upperLegR, lowerLegR,
    bodies,
    joints,
  }
}

// ─── Beach Ball ──────────────────────────────────────────────────────────────

function createBeachBall(
  world: RAPIER.World,
  x: number,
  y: number
): BeachBall {
  const radius = 28
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y)
    .setLinearDamping(0.15)
    .setAngularDamping(0.3)

  const body = world.createRigidBody(bodyDesc)

  const colliderDesc = RAPIER.ColliderDesc.ball(radius)
    .setRestitution(0.85)
    .setFriction(0.4)
    .setDensity(0.4)
    .setCollisionGroups(WORLD_COLLISION_GROUP)

  world.createCollider(colliderDesc, body)

  return { body, radius }
}

// ─── Motor Control ───────────────────────────────────────────────────────────

/** Set all ragdoll joints to full ragdoll (limp) */
export function goLimp(ragdoll: Ragdoll): void {
  for (const { joint, standAngle } of ragdoll.joints) {
    joint.configureMotorPosition(standAngle, 0.0, 0.0)
  }
}

/** Blend motors from ragdoll to standing pose. blend: 0=limp, 1=full control.
 *  Optional baseStiffness overrides the default MOTOR_STIFFNESS (600) — use
 *  low values (5-10) for freefall hints, higher (40-60) for active poses. */
export function setMotorBlend(ragdoll: Ragdoll, blend: number, baseStiffness?: number): void {
  const stiff = baseStiffness ?? MOTOR_STIFFNESS
  const damp = baseStiffness !== undefined ? baseStiffness * 0.5 : MOTOR_DAMPING
  const stiffness = blend * stiff
  const damping = blend * damp
  for (const { joint, standAngle } of ragdoll.joints) {
    joint.configureMotorPosition(standAngle, stiffness, damping)
  }
}

// ─── Physics Obstacles ───────────────────────────────────────────────────────

/** Get AABBs of all ragdoll bodies + beach ball as obstacles for text reflow.
 * Computes bounding boxes from collider translation + halfExtents/radius. */
export function getObstacles(physics: PhysicsWorld, padding: number = 6): Obstacle[] {
  const obstacles: Obstacle[] = []

  const allBodies = [...physics.ragdoll.bodies, physics.beachBall.body]

  for (const body of allBodies) {
    const numColliders = body.numColliders()
    for (let i = 0; i < numColliders; i++) {
      const collider = body.collider(i)
      const pos = collider.translation()
      const shapeType = collider.shapeType()

      let halfW: number
      let halfH: number

      if (shapeType === RAPIER.ShapeType.Ball) {
        const r = collider.radius()
        halfW = r
        halfH = r
      } else if (shapeType === RAPIER.ShapeType.Capsule) {
        // Capsule: radius() + halfHeight() to compute bounding box
        const r = collider.radius()
        const hh = collider.halfHeight()
        halfW = r
        halfH = hh + r
      } else {
        // Cuboid or other — use halfExtents
        const he = collider.halfExtents()
        halfW = he.x
        halfH = he.y
      }

      obstacles.push({
        x: pos.x - halfW - padding,
        y: pos.y - halfH - padding,
        width: halfW * 2 + padding * 2,
        height: halfH * 2 + padding * 2,
      })
    }
  }

  return obstacles
}

// ─── Step ────────────────────────────────────────────────────────────────────

export function stepPhysics(physics: PhysicsWorld): void {
  // Apply torso uprighting torque before stepping — keeps the figure from tipping over
  const torsoRot = physics.ragdoll.torso.rotation()
  const correctionTorque = -torsoRot * 1200.0  // proportional correction toward upright
  const currentAngvel = physics.ragdoll.torso.angvel()
  const dampingTorque = -currentAngvel * 120.0  // angular velocity damping
  physics.ragdoll.torso.applyTorqueImpulse(correctionTorque + dampingTorque, true)

  physics.world.step(physics.eventQueue)

  // Drain events (we detect collisions for impact effects)
  physics.eventQueue.drainCollisionEvents(() => {
    // Collision handling done in scene.ts via checking body positions
  })
}

/** Teleport the entire ragdoll to a position (used before scene starts) */
export function teleportRagdoll(
  ragdoll: Ragdoll,
  x: number,
  y: number
): void {
  // Calculate offset from torso
  const torsoPos = ragdoll.torso.translation()
  const dx = x - torsoPos.x
  const dy = y - torsoPos.y

  for (const body of ragdoll.bodies) {
    const pos = body.translation()
    body.setTranslation(
      new RAPIER.Vector2(pos.x + dx, pos.y + dy),
      true
    )
    body.setLinvel(new RAPIER.Vector2(0, 0), true)
    body.setAngvel(0, true)
  }
}

/** Teleport beach ball off screen */
export function hideBeachBall(physics: PhysicsWorld): void {
  physics.beachBall.body.setTranslation(
    new RAPIER.Vector2(physics.sceneWidth * 0.75, -400),
    true
  )
  physics.beachBall.body.setLinvel(new RAPIER.Vector2(0, 0), true)
  physics.beachBall.body.setAngvel(0, true)
}

/** Launch beach ball from the side */
export function launchBeachBall(physics: PhysicsWorld): void {
  const x = physics.sceneWidth + 50
  const y = physics.groundY - 200
  physics.beachBall.body.setTranslation(new RAPIER.Vector2(x, y), true)
  physics.beachBall.body.setLinvel(new RAPIER.Vector2(-350, -200), true)
  physics.beachBall.body.setAngvel(3.0, true)
}

/** Check if ragdoll torso has hit the ground zone */
export function hasHitGround(physics: PhysicsWorld): boolean {
  const torsoY = physics.ragdoll.torso.translation().y
  return torsoY > physics.groundY - 100
}

/** Lock all ragdoll bodies in place (kinematic-like freeze) */
export function freezeRagdoll(ragdoll: Ragdoll): void {
  for (const body of ragdoll.bodies) {
    body.setLinvel(new RAPIER.Vector2(0, 0), true)
    body.setAngvel(0, true)
    body.setGravityScale(0, true)
  }
}

/** Unfreeze ragdoll (restore gravity) */
export function unfreezeRagdoll(ragdoll: Ragdoll): void {
  for (const body of ragdoll.bodies) {
    body.setGravityScale(1, true)
  }
}

// ─── Dynamic Body Management ────────────────────────────────────────────────

export interface DynamicPropParams {
  friction?: number
  restitution?: number
  density?: number
  damping?: number
  angularDamping?: number
  gravityScale?: number
}

/** Create a dynamic prop body (beach-ball, box, platform, confetti) */
export function createDynamicProp(
  physics: PhysicsWorld,
  type: 'beach-ball' | 'box' | 'platform' | 'confetti',
  x: number,
  y: number,
  params?: DynamicPropParams
): RAPIER.RigidBody {
  const p = params ?? {}

  if (type === 'beach-ball') {
    const radius = 28
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y)
      .setLinearDamping(p.damping ?? 0.15)
      .setAngularDamping(p.angularDamping ?? 0.3)
    if (p.gravityScale !== undefined) bodyDesc.setGravityScale(p.gravityScale)
    const body = physics.world.createRigidBody(bodyDesc)
    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
      .setRestitution(p.restitution ?? 0.85)
      .setFriction(p.friction ?? 0.4)
      .setDensity(p.density ?? 0.4)
      .setCollisionGroups(WORLD_COLLISION_GROUP)
    physics.world.createCollider(colliderDesc, body)
    return body
  }

  if (type === 'box' || type === 'platform') {
    const halfW = type === 'platform' ? 80 : 20
    const halfH = type === 'platform' ? 12 : 20
    const isKinematic = type === 'platform'
    const bodyDesc = isKinematic
      ? RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y)
      : RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(x, y)
          .setLinearDamping(p.damping ?? 0.3)
          .setAngularDamping(p.angularDamping ?? 2.0)
    if (!isKinematic && p.gravityScale !== undefined) bodyDesc.setGravityScale(p.gravityScale)
    const body = physics.world.createRigidBody(bodyDesc)
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfW, halfH)
      .setRestitution(p.restitution ?? 0.2)
      .setFriction(p.friction ?? 0.8)
      .setDensity(p.density ?? 1.5)
      .setCollisionGroups(WORLD_COLLISION_GROUP)
    physics.world.createCollider(colliderDesc, body)
    return body
  }

  // confetti — small circles
  const radius = 3 + deterministicRandom() * 3
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y)
    .setLinearDamping(p.damping ?? 0.05)
    .setAngularDamping(p.angularDamping ?? 0.1)
  if (p.gravityScale !== undefined) bodyDesc.setGravityScale(p.gravityScale)
  const body = physics.world.createRigidBody(bodyDesc)
  const colliderDesc = RAPIER.ColliderDesc.ball(radius)
    .setRestitution(p.restitution ?? 0.5)
    .setFriction(p.friction ?? 0.3)
    .setDensity(p.density ?? 0.2)
    .setCollisionGroups(WORLD_COLLISION_GROUP)
  physics.world.createCollider(colliderDesc, body)
  return body
}

/** Destroy a single body from the physics world */
export function destroyBody(physics: PhysicsWorld, body: RAPIER.RigidBody): void {
  physics.world.removeRigidBody(body)
}

/** Batch destroy all bodies in the array */
export function destroyAllSceneBodies(physics: PhysicsWorld, bodies: RAPIER.RigidBody[]): void {
  for (const body of bodies) {
    physics.world.removeRigidBody(body)
  }
}

/** Apply an impulse to a body */
export function applyImpulse(body: RAPIER.RigidBody, impulse: [number, number]): void {
  body.applyImpulse(new RAPIER.Vector2(impulse[0], impulse[1]), true)
}

/** Set world gravity override */
export function setGravityOverride(physics: PhysicsWorld, gravity: [number, number]): void {
  physics.world.gravity = new RAPIER.Vector2(gravity[0], gravity[1])
}

/** Create a batch of confetti particle bodies */
export function createParticleBatch(
  physics: PhysicsWorld,
  count: number,
  regionX: number,
  regionY: number,
  regionWidth: number,
  params?: DynamicPropParams
): RAPIER.RigidBody[] {
  const bodies: RAPIER.RigidBody[] = []
  for (let i = 0; i < count; i++) {
    const x = regionX + deterministicRandom() * regionWidth
    const y = regionY - deterministicRandom() * 100
    const body = createDynamicProp(physics, 'confetti', x, y, params)
    // Random initial velocity for spread
    body.setLinvel(
      new RAPIER.Vector2((deterministicRandom() - 0.5) * 200, -deterministicRandom() * 300),
      true
    )
    body.setAngvel((deterministicRandom() - 0.5) * 10, true)
    bodies.push(body)
  }
  return bodies
}

/** Set motor blend to specific pose angles (named pose support).
 *  Optional baseStiffness overrides the default MOTOR_STIFFNESS (600). */
export function setMotorPose(
  ragdoll: Ragdoll,
  poseAngles: number[],
  blend: number,
  baseStiffness?: number
): void {
  const stiff = baseStiffness ?? MOTOR_STIFFNESS
  const damp = baseStiffness !== undefined ? baseStiffness * 0.5 : MOTOR_DAMPING
  const stiffness = blend * stiff
  const damping = blend * damp
  for (let i = 0; i < ragdoll.joints.length; i++) {
    const target = i < poseAngles.length ? poseAngles[i] : ragdoll.joints[i].standAngle
    ragdoll.joints[i].joint.configureMotorPosition(target, stiffness, damping)
  }
}
