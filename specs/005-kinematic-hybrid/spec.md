# Architecture Migration: Kinematic-Dynamic Hybrid

## Overview

Migrate from motor-driven active ragdoll to a kinematic-dynamic hybrid architecture. The skeleton is driven by GSAP animation curves (canvas-first), with Rapier.js handling dynamic props and optional ragdoll-on-demand physics reactions.

**Key insight from research:** No commercial game uses pure high-stiffness motors for character animation. All use hybrid approaches. For predetermined scrollytelling, the character doesn't need to be a physics object at all — compute joint angles from scroll progress, draw lines on canvas. Keep Rapier for props (beach ball, confetti) and optional ragdoll moments.

## Architecture

### Canvas-First (Architecture A)
```
Scroll progress (0→1) → GSAP timeline → joint angle object → canvas drawLine()
```

The stick figure is NOT a Rapier physics body. It's computed positions drawn as canvas lines. GSAP drives 9 joint angles from scroll progress using keyframed timelines with easing.

### Rapier for Props + Ragdoll-on-Demand (Architecture B upgrade)
When physics reactions are needed (ball knocks figure over), invisible sensor colliders at limb positions detect contact, then the figure switches to dynamic Rapier bodies. After settling, blends back to kinematic animation.

```
Normal:     GSAP → joint angles → canvas draw (no Rapier)
Collision:  Sensor detects hit → spawn dynamic ragdoll at current pose → physics takes over
Recovery:   Physics settles → blend ragdoll pose → animation pose → resume GSAP
```

## Phase 0: The Celebration (Canvas-First)

### Goal
Prove GSAP-driven canvas animation works for the stick figure. No Rapier involvement for the skeleton.

### Current State
- 11 beats, 3 poses (standing, crouch, victory), confetti particle spawning
- Motor-driven, scored 5→2/10 in overnight tuning (victory pose arms never reached overhead)

### New Implementation

**1. Joint angle state object:**
```typescript
interface SkeletonPose {
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
```

**2. GSAP timeline drives the angles:**
```typescript
const pose = { head: 0, shoulderL: 0, elbowL: 0, /* ... */ };

const tl = gsap.timeline({ scrollTrigger: { trigger: sceneEl, scrub: true } });

// Standing → Crouch
tl.to(pose, {
  hipL: -0.3, hipR: -0.3, kneeL: -1.2, kneeR: -1.2,
  duration: 0.06, ease: "power2.inOut"
}, 0.10);

// Crouch → Victory
tl.to(pose, {
  shoulderL: -2.5, shoulderR: 2.5, // arms overhead
  elbowL: -0.3, elbowR: 0.3,
  hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, // stand up
  duration: 0.10, ease: "power2.out"
}, 0.16);

// ... etc for remaining beats
```

**3. Render function computes world positions from angles:**
```typescript
function renderSkeleton(ctx: CanvasRenderingContext2D, pose: SkeletonPose, rootPos: Vec2) {
  // Torso position = rootPos
  // Shoulder positions = rootPos + torsoLength * direction
  // Upper arm end = shoulder + upperArmLength * rotate(shoulderAngle)
  // Lower arm end = upper arm end + lowerArmLength * rotate(shoulderAngle + elbowAngle)
  // Same for legs from hip
  // Draw lines between computed positions
}
```

**4. Confetti stays in Rapier:**
- Confetti particles remain as dynamic Rapier bodies
- Add invisible sensor colliders at stick figure limb positions so confetti bounces off the figure
- Sensor positions updated from the computed skeleton positions each frame

### Scene Beat DSL (new format):
```json
{
  "mode": "kinematic",
  "keyframes": [
    {
      "scrollRange": [0, 0.10],
      "pose": { "head": 0, "shoulderL": 0.15, "shoulderR": -0.15, "hipL": 0, "hipR": 0, "kneeL": 0, "kneeR": 0 },
      "easing": "none"
    },
    {
      "scrollRange": [0.10, 0.16],
      "pose": { "hipL": -0.3, "hipR": -0.3, "kneeL": -1.2, "kneeR": -1.2, "shoulderL": 0.5, "shoulderR": -0.5 },
      "easing": "power2.inOut"
    },
    {
      "scrollRange": [0.16, 0.42],
      "pose": { "shoulderL": -2.5, "shoulderR": 2.5, "elbowL": -0.3, "elbowR": 0.3, "hipL": 0, "hipR": 0, "kneeL": 0, "kneeR": 0 },
      "easing": "power2.out"
    }
  ]
}
```

### Success Criteria
- [ ] Victory pose has arms clearly overhead (the thing motors couldn't do)
- [ ] Crouch→victory transition is smooth with visible easing
- [ ] Confetti particles bounce off the figure (sensor colliders work)
- [ ] AI vision critic scores ≥ 6/10 (baseline was 5/10 motor-driven)
- [ ] Reverse scrolling works smoothly
- [ ] npm run build passes
- [ ] npm test passes (with updated frame capture for canvas-drawn figure)

## Phase 1: Ball Knockout + Recovery (Kinematic→Dynamic→Kinematic)

### Goal
Prove the full hybrid pipeline: animated figure gets hit by a physics ball, ragdolls, then recovers to animation.

### Implementation

**1. Setup:**
- Stick figure is canvas-drawn (from Phase 0)
- Add invisible Rapier sensor colliders at each limb position (updated per frame)
- Dynamic ball rolls/launches toward the figure

**2. Collision trigger:**
- Sensor detects ball contact with a limb
- At that instant: create dynamic Rapier bodies at each limb's current position + rotation
- Compute velocity from the last few frames of animation: `v = (pos_new - pos_old) / dt`
- Apply ball's impulse to the hit limb
- Stop canvas drawing, start rendering from Rapier body positions

**3. Ragdoll phase:**
- Figure is now a full dynamic ragdoll in Rapier
- Ball bounces off, figure falls/tumbles
- Wait for velocities to drop below threshold (figure has "settled")

**4. Recovery blend:**
- Capture the ragdoll's current pose (all body positions + rotations)
- Define target "standing" pose
- Over 20-30 frames, LERP each limb from ragdoll position → standing position
- During blend: bodies are kinematic, positions interpolated
- After blend complete: destroy Rapier bodies, resume canvas drawing

**5. Resume animation:**
- Figure is back to canvas-drawn, GSAP-driven animation
- Scroll continues to next scene

### Critical: `setBodyType()` Bug Workaround
Research found Rapier.js GitHub issue #616 — `setBodyType()` from kinematic→dynamic may freeze bodies. 

**Workaround:** Don't switch body types. Instead:
- Canvas-drawn mode: no Rapier bodies for skeleton at all
- Ragdoll mode: CREATE new dynamic bodies at current positions
- Recovery mode: destroy dynamic bodies, resume canvas drawing
- This completely sidesteps the bug since we never mutate body types

### Scene Beat DSL:
```json
{
  "scrollRange": [0.50, 0.55],
  "action": "ball-hit",
  "mode": "hybrid",
  "ball": {
    "spawnPosition": [1.2, 0.3],
    "impulse": [-800, -200]
  },
  "ragdoll": {
    "settleThreshold": 5.0,
    "maxDuration": 3.0,
    "recoveryFrames": 25,
    "recoveryPose": "standing"
  }
}
```

### Success Criteria
- [ ] Ball visibly collides with figure at correct limb
- [ ] Figure ragdolls naturally (no teleporting, no head detachment)
- [ ] Recovery blend is smooth (no visible pop/jerk)
- [ ] Reverse scrolling: if user scrolls back past the trigger, figure returns to pre-hit pose
- [ ] AI vision critic can evaluate the full sequence
- [ ] Performance: maintains 60fps through collision + ragdoll + recovery

## Technical Notes

- All AI calls via `http://localhost:18789/v1/chat/completions` (OpenClaw local API)
- Commits must include `[skip ci]`
- GSAP + ScrollTrigger already in dependencies — no new deps for Phase 0
- For Phase 1, may need to add joints between dynamic bodies (only during ragdoll mode)
- Frame capture test needs updating: canvas-drawn figure should be visible in Playwright screenshots (it's rendered to the same canvas)

## Research Sources
Full deep research reports available at:
- `specs/005-kinematic-hybrid/research/` (to be added)
Key references: Erin Catto GDC 2012 (Diablo 3 ragdolls), Rain World procedural animation, PuppetMaster, Unity/Unreal ragdoll blending patterns, Rapier.js kinematic body docs.
