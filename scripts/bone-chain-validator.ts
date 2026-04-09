#!/usr/bin/env npx tsx
/**
 * Bone Chain Validator — Mathematical FK verification for kinematic keyframes.
 *
 * Runs the same forward kinematics as kinematic-skeleton.ts WITHOUT rendering.
 * Checks for common animation bugs at each keyframe AND at interpolation midpoints.
 *
 * Usage:
 *   npx tsx scripts/bone-chain-validator.ts <scene-json-path>
 *
 * Checks:
 *   1. Feet planted: feet should not shift >10px when hips are near zero
 *   2. Elbow-at-zero trap: shoulder active but elbow is zero → dangling forearm
 *   3. Interpolation body crossing: shoulder angle crosses zero during transition
 *   4. Hand position sanity: hand below hip or behind head
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { pathToFileURL } from 'url'

// ── Types ──────────────────────────────────────────────────────────────────

interface Point {
  x: number
  y: number
}

interface SkeletonPose {
  head: number
  shoulderL: number
  elbowL: number
  shoulderR: number
  elbowR: number
  hipL: number
  kneeL: number
  hipR: number
  kneeR: number
}

interface KinematicKeyframe {
  scrollRange: [number, number]
  pose: SkeletonPose
  easing: string
}

interface SceneJson {
  id: string
  title: string
  mode?: string
  keyframes?: KinematicKeyframe[]
  [key: string]: unknown
}

export interface ValidationWarning {
  severity: 'error' | 'warning'
  check: string
  keyframeRange: string
  message: string
  details?: string
}

// ── Bone geometry (mirrored from kinematic-skeleton.ts) ───────────────────

const SHOULDER_L: Point = { x: -10, y: -24 }
const SHOULDER_R: Point = { x: 10, y: -24 }
const HIP_L: Point = { x: -6, y: 30 }
const HIP_R: Point = { x: 6, y: 30 }

const UPPER_ARM_HALF = 16
const LOWER_ARM_HALF = 16
const UPPER_LEG_HALF = 20
const LOWER_LEG_HALF = 20

// ── FK computation (same math as kinematic-skeleton.ts) ───────────────────

function rotateVec(angle: number, dx: number, dy: number): Point {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: dx * c - dy * s, y: dx * s + dy * c }
}

interface LimbEndpoints {
  handL: Point
  handR: Point
  footL: Point
  footR: Point
  elbowL: Point
  elbowR: Point
  hipL: Point
  hipR: Point
}

function computeEndpoints(pose: SkeletonPose, root: Point): LimbEndpoints {
  const torso = root

  // Left arm
  const shL = { x: torso.x + SHOULDER_L.x, y: torso.y + SHOULDER_L.y }
  const elOffL = rotateVec(pose.shoulderL, 0, UPPER_ARM_HALF * 2)
  const elbowL = { x: shL.x + elOffL.x, y: shL.y + elOffL.y }
  const laOffL = rotateVec(pose.shoulderL + pose.elbowL, 0, LOWER_ARM_HALF * 2)
  const handL = { x: elbowL.x + laOffL.x, y: elbowL.y + laOffL.y }

  // Right arm
  const shR = { x: torso.x + SHOULDER_R.x, y: torso.y + SHOULDER_R.y }
  const elOffR = rotateVec(pose.shoulderR, 0, UPPER_ARM_HALF * 2)
  const elbowR = { x: shR.x + elOffR.x, y: shR.y + elOffR.y }
  const laOffR = rotateVec(pose.shoulderR + pose.elbowR, 0, LOWER_ARM_HALF * 2)
  const handR = { x: elbowR.x + laOffR.x, y: elbowR.y + laOffR.y }

  // Left leg
  const hL = { x: torso.x + HIP_L.x, y: torso.y + HIP_L.y }
  const knOffL = rotateVec(pose.hipL, 0, UPPER_LEG_HALF * 2)
  const kneeL = { x: hL.x + knOffL.x, y: hL.y + knOffL.y }
  const llOffL = rotateVec(pose.hipL + pose.kneeL, 0, LOWER_LEG_HALF * 2)
  const footL = { x: kneeL.x + llOffL.x, y: kneeL.y + llOffL.y }

  // Right leg
  const hR = { x: torso.x + HIP_R.x, y: torso.y + HIP_R.y }
  const knOffR = rotateVec(pose.hipR, 0, UPPER_LEG_HALF * 2)
  const kneeR = { x: hR.x + knOffR.x, y: hR.y + knOffR.y }
  const llOffR = rotateVec(pose.hipR + pose.kneeR, 0, LOWER_LEG_HALF * 2)
  const footR = { x: kneeR.x + llOffR.x, y: kneeR.y + llOffR.y }

  return { handL, handR, footL, footR, elbowL, elbowR, hipL: hL, hipR: hR }
}

// ── Interpolation ─────────────────────────────────────────────────────────

function lerpPose(a: SkeletonPose, b: SkeletonPose, t: number): SkeletonPose {
  return {
    head: a.head + (b.head - a.head) * t,
    shoulderL: a.shoulderL + (b.shoulderL - a.shoulderL) * t,
    elbowL: a.elbowL + (b.elbowL - a.elbowL) * t,
    shoulderR: a.shoulderR + (b.shoulderR - a.shoulderR) * t,
    elbowR: a.elbowR + (b.elbowR - a.elbowR) * t,
    hipL: a.hipL + (b.hipL - a.hipL) * t,
    kneeL: a.kneeL + (b.kneeL - a.kneeL) * t,
    hipR: a.hipR + (b.hipR - a.hipR) * t,
    kneeR: a.kneeR + (b.kneeR - a.kneeR) * t,
  }
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

// ── Validation checks ─────────────────────────────────────────────────────

const FOOT_SHIFT_THRESHOLD = 10  // px
const HIP_NEAR_ZERO_THRESHOLD = 0.05  // radians
const SHOULDER_ACTIVE_THRESHOLD = 0.1  // radians

// Root position for FK — arbitrary but consistent (matches computeRootY with ground at 93)
const ROOT: Point = { x: 0, y: 0 }

/**
 * Standing foot reference: compute foot positions when all joints are at zero.
 */
function getStandingFeetPositions(): { footL: Point; footR: Point } {
  const zeroPose: SkeletonPose = {
    head: 0, shoulderL: 0, elbowL: 0, shoulderR: 0, elbowR: 0,
    hipL: 0, kneeL: 0, hipR: 0, kneeR: 0,
  }
  const endpoints = computeEndpoints(zeroPose, ROOT)
  return { footL: endpoints.footL, footR: endpoints.footR }
}

export function validateScene(sceneJsonPath: string): ValidationWarning[] {
  const raw = fs.readFileSync(sceneJsonPath, 'utf-8')
  const scene = JSON.parse(raw) as SceneJson
  return validateKeyframes(scene)
}

export function validateKeyframes(scene: SceneJson): ValidationWarning[] {
  if (scene.mode !== 'kinematic' || !scene.keyframes || scene.keyframes.length === 0) {
    return [{ severity: 'warning', check: 'mode', keyframeRange: 'N/A', message: 'Scene is not kinematic or has no keyframes — nothing to validate' }]
  }

  const warnings: ValidationWarning[] = []
  const keyframes = scene.keyframes
  const standingFeet = getStandingFeetPositions()

  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i]
    const rangeStr = `[${kf.scrollRange[0]}–${kf.scrollRange[1]}]`
    const endpoints = computeEndpoints(kf.pose, ROOT)

    // ── Check 1: Feet planted ──
    checkFeetPlanted(kf.pose, endpoints, standingFeet, rangeStr, warnings)

    // ── Check 2: Elbow-at-zero trap ──
    checkElbowAtZero(kf.pose, rangeStr, warnings)

    // ── Check 4: Hand position sanity ──
    checkHandSanity(endpoints, rangeStr, warnings)

    // ── Interpolation checks between consecutive keyframes ──
    if (i < keyframes.length - 1) {
      const next = keyframes[i + 1]
      const transRangeStr = `[${kf.scrollRange[0]}–${next.scrollRange[1]}]`

      // ── Check 3: Interpolation body crossing ──
      checkInterpolationCrossing(kf.pose, next.pose, transRangeStr, warnings)

      // Also check feet and hands at interpolation midpoints
      checkInterpolationEndpoints(kf.pose, next.pose, standingFeet, transRangeStr, warnings)
    }
  }

  return warnings
}

function checkFeetPlanted(
  pose: SkeletonPose,
  endpoints: LimbEndpoints,
  standingFeet: { footL: Point; footR: Point },
  rangeStr: string,
  warnings: ValidationWarning[]
): void {
  const hipsNearZero = Math.abs(pose.hipL) < HIP_NEAR_ZERO_THRESHOLD &&
                        Math.abs(pose.hipR) < HIP_NEAR_ZERO_THRESHOLD &&
                        Math.abs(pose.kneeL) < HIP_NEAR_ZERO_THRESHOLD &&
                        Math.abs(pose.kneeR) < HIP_NEAR_ZERO_THRESHOLD

  if (!hipsNearZero) {
    // If hips are active, check foot displacement from standing position
    const shiftL = dist(endpoints.footL, standingFeet.footL)
    const shiftR = dist(endpoints.footR, standingFeet.footR)

    if (shiftL > FOOT_SHIFT_THRESHOLD) {
      warnings.push({
        severity: 'error',
        check: 'feet-planted',
        keyframeRange: rangeStr,
        message: `Left foot shifts ${shiftL.toFixed(1)}px from standing position (threshold: ${FOOT_SHIFT_THRESHOLD}px)`,
        details: `hipL=${pose.hipL}, kneeL=${pose.kneeL} → foot at (${endpoints.footL.x.toFixed(1)}, ${endpoints.footL.y.toFixed(1)}), standing at (${standingFeet.footL.x.toFixed(1)}, ${standingFeet.footL.y.toFixed(1)})`,
      })
    }
    if (shiftR > FOOT_SHIFT_THRESHOLD) {
      warnings.push({
        severity: 'error',
        check: 'feet-planted',
        keyframeRange: rangeStr,
        message: `Right foot shifts ${shiftR.toFixed(1)}px from standing position (threshold: ${FOOT_SHIFT_THRESHOLD}px)`,
        details: `hipR=${pose.hipR}, kneeR=${pose.kneeR} → foot at (${endpoints.footR.x.toFixed(1)}, ${endpoints.footR.y.toFixed(1)}), standing at (${standingFeet.footR.x.toFixed(1)}, ${standingFeet.footR.y.toFixed(1)})`,
      })
    }
  }
}

function checkElbowAtZero(
  pose: SkeletonPose,
  rangeStr: string,
  warnings: ValidationWarning[]
): void {
  if (Math.abs(pose.shoulderL) > SHOULDER_ACTIVE_THRESHOLD && pose.elbowL === 0) {
    warnings.push({
      severity: 'warning',
      check: 'elbow-at-zero',
      keyframeRange: rangeStr,
      message: `Left forearm dangles: shoulderL=${pose.shoulderL.toFixed(2)} but elbowL=0`,
      details: 'When shoulder is active, elbow should have a deliberate angle to avoid unnatural dangling',
    })
  }
  if (Math.abs(pose.shoulderR) > SHOULDER_ACTIVE_THRESHOLD && pose.elbowR === 0) {
    warnings.push({
      severity: 'warning',
      check: 'elbow-at-zero',
      keyframeRange: rangeStr,
      message: `Right forearm dangles: shoulderR=${pose.shoulderR.toFixed(2)} but elbowR=0`,
      details: 'When shoulder is active, elbow should have a deliberate angle to avoid unnatural dangling',
    })
  }
}

function checkInterpolationCrossing(
  poseA: SkeletonPose,
  poseB: SkeletonPose,
  rangeStr: string,
  warnings: ValidationWarning[]
): void {
  // Check if shoulder angles cross zero (change sign) during interpolation
  // This means the elbow passes through the body
  const joints: Array<{ name: string; a: number; b: number }> = [
    { name: 'shoulderL', a: poseA.shoulderL, b: poseB.shoulderL },
    { name: 'shoulderR', a: poseA.shoulderR, b: poseB.shoulderR },
  ]

  for (const joint of joints) {
    // Both must be non-trivial (skip if both near zero — no real crossing)
    const bothNearZero = Math.abs(joint.a) < SHOULDER_ACTIVE_THRESHOLD &&
                          Math.abs(joint.b) < SHOULDER_ACTIVE_THRESHOLD
    if (bothNearZero) continue

    // Sign change: positive to negative or vice versa
    if (joint.a * joint.b < 0) {
      // Verify at 10 interpolation points that a crossing actually happens
      let crossesZero = false
      for (let t = 0; t <= 1.0; t += 0.1) {
        const val = joint.a + (joint.b - joint.a) * t
        if (Math.abs(val) < 0.01) {
          crossesZero = true
          break
        }
        // Check sign change between adjacent samples
        const nextVal = joint.a + (joint.b - joint.a) * Math.min(t + 0.1, 1.0)
        if (val * nextVal < 0) {
          crossesZero = true
          break
        }
      }

      if (crossesZero) {
        warnings.push({
          severity: 'error',
          check: 'interpolation-body-crossing',
          keyframeRange: rangeStr,
          message: `${joint.name} crosses zero during transition (${joint.a.toFixed(2)} → ${joint.b.toFixed(2)}) — elbow may pass through body`,
          details: `Add an intermediate keyframe or ensure ${joint.name} stays on one side of zero`,
        })
      }
    }
  }
}

function checkInterpolationEndpoints(
  poseA: SkeletonPose,
  poseB: SkeletonPose,
  standingFeet: { footL: Point; footR: Point },
  rangeStr: string,
  warnings: ValidationWarning[]
): void {
  // Sample 10 interpolation points and check feet + hands
  for (let step = 1; step <= 9; step++) {
    const t = step / 10
    const midPose = lerpPose(poseA, poseB, t)
    const endpoints = computeEndpoints(midPose, ROOT)

    // Feet check during interpolation
    const hipsNearZero = Math.abs(midPose.hipL) < HIP_NEAR_ZERO_THRESHOLD &&
                          Math.abs(midPose.hipR) < HIP_NEAR_ZERO_THRESHOLD
    if (!hipsNearZero) {
      const shiftL = dist(endpoints.footL, standingFeet.footL)
      const shiftR = dist(endpoints.footR, standingFeet.footR)
      if (shiftL > FOOT_SHIFT_THRESHOLD || shiftR > FOOT_SHIFT_THRESHOLD) {
        const side = shiftL > shiftR ? 'Left' : 'Right'
        const shift = Math.max(shiftL, shiftR)
        warnings.push({
          severity: 'error',
          check: 'feet-planted',
          keyframeRange: `${rangeStr} @t=${t.toFixed(1)}`,
          message: `${side} foot shifts ${shift.toFixed(1)}px during interpolation (threshold: ${FOOT_SHIFT_THRESHOLD}px)`,
        })
        break // One warning per transition is enough
      }
    }

    // Hand sanity during interpolation
    checkHandSanity(endpoints, `${rangeStr} @t=${t.toFixed(1)}`, warnings)
  }
}

function checkHandSanity(
  endpoints: LimbEndpoints,
  rangeStr: string,
  warnings: ValidationWarning[]
): void {
  // Hand below hip = arm through body (y increases downward)
  if (endpoints.handL.y > endpoints.hipL.y + 10) {
    warnings.push({
      severity: 'warning',
      check: 'hand-position',
      keyframeRange: rangeStr,
      message: `Left hand (y=${endpoints.handL.y.toFixed(1)}) is below hip (y=${endpoints.hipL.y.toFixed(1)}) — arm may pass through body`,
    })
  }
  if (endpoints.handR.y > endpoints.hipR.y + 10) {
    warnings.push({
      severity: 'warning',
      check: 'hand-position',
      keyframeRange: rangeStr,
      message: `Right hand (y=${endpoints.handR.y.toFixed(1)}) is below hip (y=${endpoints.hipR.y.toFixed(1)}) — arm may pass through body`,
    })
  }
}

// ── Output formatting ─────────────────────────────────────────────────────

function formatWarnings(warnings: ValidationWarning[]): string {
  if (warnings.length === 0) return '✅ No issues found'

  const errors = warnings.filter((w) => w.severity === 'error')
  const warns = warnings.filter((w) => w.severity === 'warning')

  const lines: string[] = []

  if (errors.length > 0) {
    lines.push(`\n❌ ${errors.length} ERROR(S):`)
    for (const w of errors) {
      lines.push(`  [${w.check}] ${w.keyframeRange}: ${w.message}`)
      if (w.details) lines.push(`    → ${w.details}`)
    }
  }

  if (warns.length > 0) {
    lines.push(`\n⚠️  ${warns.length} WARNING(S):`)
    for (const w of warns) {
      lines.push(`  [${w.check}] ${w.keyframeRange}: ${w.message}`)
      if (w.details) lines.push(`    → ${w.details}`)
    }
  }

  return lines.join('\n')
}

// ── CLI ───────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2)

  if (args.length < 1) {
    console.error('Usage: npx tsx scripts/bone-chain-validator.ts <scene-json-path>')
    process.exit(1)
  }

  const scenePath = args[0]

  if (!fs.existsSync(scenePath)) {
    console.error(`Scene file not found: ${scenePath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(scenePath, 'utf-8')
  const scene = JSON.parse(raw) as SceneJson

  console.error(`Validating bone chains for "${scene.title}" (${scene.id})`)
  console.error(`Mode: ${scene.mode ?? 'motor'}, Keyframes: ${scene.keyframes?.length ?? 0}`)

  const warnings = validateKeyframes(scene)

  // Output structured JSON to stdout
  console.log(JSON.stringify({ sceneId: scene.id, warnings }, null, 2))

  // Human-readable summary to stderr
  console.error(formatWarnings(warnings))

  // Exit non-zero if errors found
  const hasErrors = warnings.some((w) => w.severity === 'error')
  if (hasErrors) {
    console.error(`\nValidation FAILED — fix errors before proceeding`)
    process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
