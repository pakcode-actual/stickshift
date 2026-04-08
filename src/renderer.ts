import RAPIER from '@dimforge/rapier2d-compat'
import type { PhysicsWorld } from './physics'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Point {
  x: number
  y: number
}

export interface CameraTransform {
  offsetX: number
  offsetY: number
  scale: number
}

// Beach ball segment colors
const BALL_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6b6b', '#ffd93d']

// Confetti colors
const CONFETTI_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff85c0', '#a78bfa']

// ─── Canvas Setup ────────────────────────────────────────────────────────────

export function initCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')!
  resizeCanvas(canvas, ctx)
  return ctx
}

export function resizeCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): void {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

// ─── Drawing ─────────────────────────────────────────────────────────────────

export function render(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  physics: PhysicsWorld,
  camera?: CameraTransform,
  dynamicBodies?: RAPIER.RigidBody[],
  kinematicDraw?: (ctx: CanvasRenderingContext2D) => void,
  skipProps?: boolean
): void {
  const w = canvas.getBoundingClientRect().width
  const h = canvas.getBoundingClientRect().height
  ctx.clearRect(0, 0, w, h)

  // Apply camera transform
  if (camera && (camera.offsetX !== 0 || camera.offsetY !== 0 || camera.scale !== 1)) {
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.scale(camera.scale, camera.scale)
    ctx.translate(-w / 2 + camera.offsetX, -h / 2 + camera.offsetY)
  }

  drawGround(ctx, physics)
  if (kinematicDraw) {
    kinematicDraw(ctx)
  } else {
    drawStickFigure(ctx, physics)
  }
  if (!skipProps) {
    drawBeachBall(ctx, physics)
  }

  // Draw dynamic prop bodies (confetti, boxes, platforms)
  if (dynamicBodies && dynamicBodies.length > 0) {
    drawDynamicBodies(ctx, dynamicBodies, physics)
  }

  // Restore camera transform
  if (camera && (camera.offsetX !== 0 || camera.offsetY !== 0 || camera.scale !== 1)) {
    ctx.restore()
  }
}

// ─── Ground ──────────────────────────────────────────────────────────────────

function drawGround(ctx: CanvasRenderingContext2D, physics: PhysicsWorld): void {
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, physics.groundY)
  ctx.lineTo(physics.sceneWidth, physics.groundY)
  ctx.stroke()
}

// ─── Stick Figure ────────────────────────────────────────────────────────────

function bodyCenter(body: { translation(): { x: number; y: number } }): Point {
  const t = body.translation()
  return { x: t.x, y: t.y }
}

function drawStickFigure(
  ctx: CanvasRenderingContext2D,
  physics: PhysicsWorld
): void {
  const r = physics.ragdoll

  const headPos = bodyCenter(r.head)
  const torsoPos = bodyCenter(r.torso)
  const upperArmLPos = bodyCenter(r.upperArmL)
  const lowerArmLPos = bodyCenter(r.lowerArmL)
  const upperArmRPos = bodyCenter(r.upperArmR)
  const lowerArmRPos = bodyCenter(r.lowerArmR)
  const upperLegLPos = bodyCenter(r.upperLegL)
  const lowerLegLPos = bodyCenter(r.lowerLegL)
  const upperLegRPos = bodyCenter(r.upperLegR)
  const lowerLegRPos = bodyCenter(r.lowerLegR)

  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Draw limb connections as lines
  const limbs: [Point, Point][] = [
    // Spine
    [headPos, torsoPos],
    // Left arm
    [torsoPos, upperArmLPos],
    [upperArmLPos, lowerArmLPos],
    // Right arm
    [torsoPos, upperArmRPos],
    [upperArmRPos, lowerArmRPos],
    // Left leg
    [torsoPos, upperLegLPos],
    [upperLegLPos, lowerLegLPos],
    // Right leg
    [torsoPos, upperLegRPos],
    [upperLegRPos, lowerLegRPos],
  ]

  for (const [a, b] of limbs) {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  // Draw hands (small circles at end of lower arms)
  drawDot(ctx, lowerArmLPos, 3, '#e0e0e0')
  drawDot(ctx, lowerArmRPos, 3, '#e0e0e0')

  // Draw feet (small circles at end of lower legs)
  drawDot(ctx, lowerLegLPos, 3.5, '#e0e0e0')
  drawDot(ctx, lowerLegRPos, 3.5, '#e0e0e0')

  // Draw head (circle)
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 2.5
  ctx.fillStyle = '#0a0a0a'
  ctx.beginPath()
  ctx.arc(headPos.x, headPos.y, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Eyes — simple dots
  const headRot = r.head.rotation()
  const eyeOffsetX = Math.cos(headRot) * 5
  const eyeOffsetY = Math.sin(headRot) * 5
  drawDot(ctx, { x: headPos.x - eyeOffsetY - eyeOffsetX * 0.4, y: headPos.y + eyeOffsetX - eyeOffsetY * 0.4 - 2 }, 1.5, '#e0e0e0')
  drawDot(ctx, { x: headPos.x - eyeOffsetY + eyeOffsetX * 0.4, y: headPos.y + eyeOffsetX + eyeOffsetY * 0.4 - 2 }, 1.5, '#e0e0e0')

  // Subtle glow on stick figure
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

function drawDot(
  ctx: CanvasRenderingContext2D,
  pos: Point,
  radius: number,
  color: string
): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
  ctx.fill()
}

// ─── Beach Ball ──────────────────────────────────────────────────────────────

function drawBeachBall(
  ctx: CanvasRenderingContext2D,
  physics: PhysicsWorld
): void {
  const ball = physics.beachBall
  const pos = ball.body.translation()
  const rot = ball.body.rotation()
  const r = ball.radius

  // Only draw if on screen
  if (pos.y < -100 || pos.y > physics.sceneHeight + 100) return

  ctx.save()
  ctx.translate(pos.x, pos.y)
  ctx.rotate(rot)

  // Draw colored segments
  const segmentCount = BALL_COLORS.length
  const segmentAngle = (Math.PI * 2) / segmentCount

  for (let i = 0; i < segmentCount; i++) {
    ctx.fillStyle = BALL_COLORS[i]
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, r, i * segmentAngle, (i + 1) * segmentAngle)
    ctx.closePath()
    ctx.fill()
  }

  // White outline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.stroke()

  // Segment lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 1
  for (let i = 0; i < segmentCount; i++) {
    const angle = i * segmentAngle
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r)
    ctx.stroke()
  }

  // Highlight (specular)
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r)
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)')
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)')
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.15)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

// ─── Dynamic Bodies (Confetti, Boxes, Platforms) ────────────────────────────

function drawDynamicBodies(
  ctx: CanvasRenderingContext2D,
  bodies: RAPIER.RigidBody[],
  physics: PhysicsWorld
): void {
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]
    const pos = body.translation()
    const rot = body.rotation()

    // Skip off-screen bodies
    if (pos.y < -200 || pos.y > physics.sceneHeight + 200) continue
    if (pos.x < -200 || pos.x > physics.sceneWidth + 200) continue

    const numColliders = body.numColliders()
    if (numColliders === 0) continue

    const collider = body.collider(0)
    const shapeType = collider.shapeType()

    ctx.save()
    ctx.translate(pos.x, pos.y)
    ctx.rotate(rot)

    if (shapeType === RAPIER.ShapeType.Ball) {
      const r = collider.radius()
      if (r < 8) {
        // Confetti particle
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
        ctx.fillStyle = color
        ctx.globalAlpha = 0.85
        // Alternate between circles and small rectangles
        if (i % 3 === 0) {
          ctx.beginPath()
          ctx.arc(0, 0, r, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-r, -r * 0.5, r * 2, r)
        }
        ctx.globalAlpha = 1
      }
    } else if (shapeType === RAPIER.ShapeType.Cuboid) {
      const he = collider.halfExtents()
      // Platform or box
      if (he.x > 40) {
        // Platform — wider, styled differently
        ctx.fillStyle = 'rgba(160, 160, 160, 0.15)'
        ctx.strokeStyle = 'rgba(160, 160, 160, 0.4)'
        ctx.lineWidth = 1
        ctx.fillRect(-he.x, -he.y, he.x * 2, he.y * 2)
        ctx.strokeRect(-he.x, -he.y, he.x * 2, he.y * 2)
      } else {
        // Box
        ctx.fillStyle = 'rgba(100, 100, 100, 0.3)'
        ctx.strokeStyle = 'rgba(160, 160, 160, 0.5)'
        ctx.lineWidth = 1.5
        ctx.fillRect(-he.x, -he.y, he.x * 2, he.y * 2)
        ctx.strokeRect(-he.x, -he.y, he.x * 2, he.y * 2)
      }
    }

    ctx.restore()
  }
}
