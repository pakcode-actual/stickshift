# Library Reference — Rapier 2D + Pretext + GSAP ScrollTrigger

## @dimforge/rapier2d-compat (2D Physics)

**IMPORTANT: This is the 2D version. Use `Vector2` not `Vector3`. Import from `@dimforge/rapier2d-compat`.**

### Initialization
```typescript
import RAPIER from '@dimforge/rapier2d-compat'

await RAPIER.init() // MUST await before using anything

const gravity = new RAPIER.Vector2(0.0, 9.81) // Y-down in screen coords
const world = new RAPIER.World(gravity)
world.timestep = 1 / 60
```

### Rigid Bodies
```typescript
// Dynamic body (affected by forces/gravity)
const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(100.0, 50.0)
  .setLinearDamping(0.1)
  .setAngularDamping(0.5)
const body = world.createRigidBody(bodyDesc)

// Fixed/static body (immovable, for ground/walls)
const groundDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(400.0, 580.0)
const ground = world.createRigidBody(groundDesc)

// Reading state
const pos = body.translation() // { x: number, y: number }
const rot = body.rotation()    // number (angle in radians, 2D!)
const vel = body.linvel()      // { x, y }

// Applying forces
body.addForce(new RAPIER.Vector2(0.0, -500.0), true)
body.applyImpulse(new RAPIER.Vector2(100.0, -200.0), true)
body.setLinvel(new RAPIER.Vector2(0, 0), true)
```

### Colliders (2D shapes)
```typescript
// Ball (circle)
const ballDesc = RAPIER.ColliderDesc.ball(15.0) // radius
  .setRestitution(0.8)
  .setFriction(0.3)
  .setDensity(1.0)
world.createCollider(ballDesc, body)

// Cuboid (rectangle) — half-extents!
const boxDesc = RAPIER.ColliderDesc.cuboid(20.0, 5.0) // half-width, half-height
world.createCollider(boxDesc, body)

// Capsule — half-height of the rectangular middle part, radius of the caps
const capsuleDesc = RAPIER.ColliderDesc.capsule(15.0, 5.0)
world.createCollider(capsuleDesc, body)

// With local offset from body origin
const offsetCollider = RAPIER.ColliderDesc.ball(8.0)
  .setTranslation(0.0, -20.0) // offset relative to parent body
world.createCollider(offsetCollider, body)
```

### Revolute Joints (2D — THE KEY JOINT FOR RAGDOLL)
In 2D, revolute joints only need anchor points (no axis — rotation is always around Z).
```typescript
// Joint connecting body1 and body2
// anchor1: offset in body1's local space where joint attaches
// anchor2: offset in body2's local space where joint attaches
const jointParams = RAPIER.JointData.revolute(
  new RAPIER.Vector2(0.0, 20.0),  // anchor on body1 (e.g. bottom of torso)
  new RAPIER.Vector2(0.0, -15.0)  // anchor on body2 (e.g. top of upper leg)
)

const joint = world.createImpulseJoint(jointParams, body1, body2, true)

// MOTOR CONTROL (this is how active ragdoll works!)
// configureMotorPosition(targetAngle, stiffness, damping)
joint.configureMotorPosition(
  0.0,    // target angle in radians (0 = neutral/straight)
  50.0,   // stiffness (higher = stronger pose tracking)
  5.0     // damping (prevents oscillation)
)

// Alternative: velocity-based motor
// configureMotorVelocity(targetVelocity, factor)
joint.configureMotorVelocity(0.0, 1.0)

// Joint angle limits
joint.setLimits(-Math.PI / 4, Math.PI / 4) // -45° to +45°
```

### Active Ragdoll Pattern
```typescript
// Full ragdoll (no motor control — limp)
joint.configureMotorPosition(targetAngle, 0.0, 0.0)

// Full pose tracking (strong motor — animated)
joint.configureMotorPosition(targetAngle, 100.0, 10.0)

// Blended (partially ragdoll, partially controlled)
const blend = 0.5 // 0 = ragdoll, 1 = full control
joint.configureMotorPosition(targetAngle, blend * 100.0, blend * 10.0)

// Ramping up over time (recovery from ragdoll):
function updateMotors(elapsedSinceImpact: number) {
  const blend = Math.min(1.0, elapsedSinceImpact / 2.0) // 2 seconds to full recovery
  for (const joint of ragdollJoints) {
    joint.configureMotorPosition(standPoseAngle, blend * 80.0, blend * 8.0)
  }
}
```

### Stepping & Game Loop
```typescript
function gameLoop() {
  world.step() // advance physics by one timestep
  
  // Read positions, render, etc.
  const pos = body.translation()
  // ...
  
  requestAnimationFrame(gameLoop)
}
```

### Collision Events
```typescript
const eventQueue = new RAPIER.EventQueue(true)
world.step(eventQueue)

eventQueue.drainCollisionEvents((handle1, handle2, started) => {
  if (started) {
    console.log('Collision started between', handle1, handle2)
  }
})

eventQueue.drainContactForceEvents((event) => {
  // For detecting impact force
  console.log('Contact force:', event.maxForceDirection(), event.maxForceMagnitude())
})
```

---

## @chenglou/pretext (Text Layout)

### Core Pipeline
```typescript
import { prepareWithSegments, layoutNextLine, layoutWithLines, type LayoutCursor } from '@chenglou/pretext'

// STEP 1: prepare() — expensive, do ONCE
const prepared = prepareWithSegments(
  'Your long educational text goes here...',
  '18px Inter' // must match your CSS font exactly
)

// STEP 2a: Simple layout (all lines at same width)
const { lines } = layoutWithLines(prepared, 600, 26) // maxWidth, lineHeight
// lines[i].text, lines[i].width

// STEP 2b: Variable-width layout (for obstacle reflow) — THE KEY API
let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
let y = 0
const lineHeight = 26
const renderedLines: Array<{ text: string; x: number; y: number; width: number }> = []

while (true) {
  // Calculate available width at this Y position (accounting for obstacles)
  const availableWidth = getAvailableWidthAtY(y) // YOUR obstacle logic
  
  const line = layoutNextLine(prepared, cursor, availableWidth)
  if (line === null) break
  
  const x = getLeftOffsetAtY(y) // YOUR obstacle logic
  renderedLines.push({ text: line.text, x, y, width: line.width })
  
  cursor = line.end // CRITICAL: use line.end as next cursor
  y += lineHeight
}
```

### Obstacle Carving Pattern (from dragon demo)
```typescript
interface Obstacle {
  x: number
  y: number
  width: number
  height: number
}

interface Slot {
  left: number
  right: number
}

function carveSlots(
  containerLeft: number,
  containerRight: number,
  obstacles: Obstacle[],
  y: number,
  lineHeight: number
): Slot[] {
  // Find obstacles that overlap this Y range
  const overlapping = obstacles.filter(obs => 
    obs.y < y + lineHeight && obs.y + obs.height > y
  )
  
  if (overlapping.length === 0) {
    return [{ left: containerLeft, right: containerRight }]
  }
  
  // Sort obstacles by X
  overlapping.sort((a, b) => a.x - b.x)
  
  // Carve out blocked regions
  const slots: Slot[] = []
  let currentLeft = containerLeft
  
  for (const obs of overlapping) {
    const obsLeft = obs.x
    const obsRight = obs.x + obs.width
    
    if (obsLeft > currentLeft + 20) { // minimum slot width
      slots.push({ left: currentLeft, right: obsLeft })
    }
    currentLeft = Math.max(currentLeft, obsRight)
  }
  
  if (currentLeft < containerRight - 20) {
    slots.push({ left: currentLeft, right: containerRight })
  }
  
  return slots
}

// Usage in layout loop:
while (cursor) {
  const slots = carveSlots(0, 800, getPhysicsObstacles(), y, lineHeight)
  
  for (const slot of slots) {
    const line = layoutNextLine(prepared, cursor, slot.right - slot.left)
    if (!line) break
    renderedLines.push({ text: line.text, x: slot.left, y, width: line.width })
    cursor = line.end
  }
  
  y += lineHeight
}
```

### Rendering as DOM Spans (accessible)
```typescript
const textContainer = document.getElementById('text-layer')!

function renderTextLines(lines: Array<{ text: string; x: number; y: number }>) {
  // Reuse existing spans or create new ones
  while (textContainer.children.length > lines.length) {
    textContainer.removeChild(textContainer.lastChild!)
  }
  while (textContainer.children.length < lines.length) {
    const span = document.createElement('span')
    span.style.position = 'absolute'
    span.style.whiteSpace = 'nowrap'
    textContainer.appendChild(span)
  }
  
  for (let i = 0; i < lines.length; i++) {
    const span = textContainer.children[i] as HTMLSpanElement
    span.textContent = lines[i].text
    span.style.left = `${lines[i].x}px`
    span.style.top = `${lines[i].y}px`
  }
}
```

---

## GSAP + ScrollTrigger

### Setup
```typescript
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)
```

### Pin Scene During Animation
```typescript
ScrollTrigger.create({
  trigger: '#scene-container',
  pin: true,
  start: 'top top',
  end: '+=200%', // pin for 2x viewport height of scrolling
  onUpdate: (self) => {
    const progress = self.progress // 0 to 1
    updateScene(progress) // drive your physics/animation with scroll progress
  }
})
```

### Scrubbed Animation
```typescript
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: '#scene',
    start: 'top top',
    end: '+=300%',
    scrub: 0.5, // smooth scrub with 0.5s lag
    pin: true
  }
})

tl.to('#character', { y: 500, duration: 1 })
  .to('#character', { rotation: 360, duration: 0.5 })
```

### Using Progress to Drive Physics Events
```typescript
let sceneState = 'waiting' // waiting -> falling -> ragdoll -> recovering -> standing

ScrollTrigger.create({
  trigger: '#scene',
  pin: true,
  start: 'top top',
  end: '+=400%',
  onUpdate: (self) => {
    const p = self.progress
    
    if (p < 0.1) {
      sceneState = 'waiting'
    } else if (p < 0.3) {
      sceneState = 'falling'
      // Release character into physics
    } else if (p < 0.5) {
      sceneState = 'ragdoll'
      // Motors at 0
    } else if (p < 0.8) {
      sceneState = 'recovering'
      // Ramp motors back up
    } else {
      sceneState = 'standing'
    }
  }
})
```
