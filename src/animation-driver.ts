import gsap from 'gsap'
import type { SkeletonPose } from './kinematic-skeleton'
import type { KinematicKeyframe } from './scene-types'

// ─── Animation Driver ──────────────────────────────────────────────────────
// Builds a GSAP timeline from keyframe beats and exposes the current
// SkeletonPose at any scroll progress via seek().

export interface AnimationDriver {
  update(localProgress: number): SkeletonPose
  destroy(): void
}

export function createAnimationDriver(keyframes: KinematicKeyframe[]): AnimationDriver {
  const pose: SkeletonPose = {
    head: 0, shoulderL: 0, elbowL: 0, shoulderR: 0, elbowR: 0,
    hipL: 0, hipR: 0, kneeL: 0, kneeR: 0,
  }

  // Apply first keyframe as initial state
  if (keyframes.length > 0) {
    Object.assign(pose, keyframes[0].pose)
  }

  // Build GSAP timeline — scrub via seek(), not ScrollTrigger
  const tl = gsap.timeline({ paused: true })

  for (const kf of keyframes) {
    const [start, end] = kf.scrollRange
    const duration = end - start
    const ease = kf.easing === 'none' ? 'none' : kf.easing
    tl.to(pose, { ...kf.pose, duration, ease }, start)
  }

  return {
    update(localProgress: number): SkeletonPose {
      tl.seek(localProgress, false)
      return { ...pose }
    },
    destroy() {
      tl.kill()
    },
  }
}
