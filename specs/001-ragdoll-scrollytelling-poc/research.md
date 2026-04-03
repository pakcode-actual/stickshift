# Research: Ragdoll Scrollytelling POC

## Rapier.js WASM Integration

**Decision**: Use `@dimforge/rapier2d-compat` (not `rapier2d`)
**Rationale**: The `-compat` variant embeds WASM as base64 in the JS bundle,
eliminating the need for `.wasm` file serving or bundler plugins. `init()` is
a simple async call.
**Alternatives**: `@dimforge/rapier2d` requires serving a separate `.wasm` file
and bundler configuration (e.g., vite-plugin-wasm). Not worth the complexity
for a POC.

## Rapier Motor API for Active Ragdoll

**Decision**: Use `configureMotorPosition(targetAngle, stiffness, damping)` on
revolute joints. Blend between ragdoll and pose-tracking by varying stiffness:
0 = full ragdoll, high value (e.g., 50-200) = pose tracking.
**Rationale**: Rapier does not expose a direct `maxTorque` parameter. Stiffness
acts as proportional gain; damping as derivative gain. This is the standard
approach for spring-damper motor control. `MotorModel.AccelerationBased`
(default) makes stiffness mass-independent, which is ideal for ragdolls with
varying segment masses.
**Alternatives**: Velocity-based motors (`configureMotorVelocity`) are less
suitable for pose tracking where target angles matter.

## Pretext Text Reflow

**Decision**: Use `prepareWithSegments()` + `layoutNextLine()` iterator pattern.
Vary `maxWidth` per line to carve exclusion zones around physics bodies.
**Rationale**: Pretext has no built-in exclusion zone API. The documented
pattern is to check each line's Y position against physics body bounds and
narrow `maxWidth` accordingly. This is lightweight (pure arithmetic) and
fits the per-frame budget.
**Alternatives**: CSS `shape-outside` cannot react to physics positions
per-frame. Manual word-wrap would be fragile and slow.

## Exclusion Zone Strategy

**Decision**: For each physics body, compute an axis-aligned bounding box
(AABB) in screen space. When laying out text line-by-line, if the current
line's Y range overlaps any AABB, reduce `maxWidth` and offset the line's
X position to avoid the AABB. Support multiple exclusion zones per line
by computing the widest clear span.
**Rationale**: AABBs are cheap to compute from Rapier body positions and
collider half-extents. Per-line intersection checks are O(n) where n is
the number of bodies (~12), well within the 2ms budget.

## GSAP ScrollTrigger Pinning

**Decision**: Use GSAP ScrollTrigger to pin the scene container during
animation. Map scroll progress (0-1) to animation phases. Use
`ScrollTrigger.create()` with `pin: true` and `scrub: true`.
**Rationale**: ScrollTrigger handles all scroll normalization, pinning
mechanics, and progress calculation. Using `scrub` maps scroll position
directly to animation progress, giving the user control.
**Alternatives**: Intersection Observer + manual scroll math is more code
and less robust across browsers.

## Canvas/DOM Layering

**Decision**: DOM text container at base layer, canvas overlay on top with
`pointer-events: none`. Canvas is absolutely positioned to match the text
container dimensions.
**Rationale**: `pointer-events: none` on canvas allows text selection through
the canvas. Canvas z-index above DOM means stick figure draws over text,
which is the desired visual (figure crashes "through" text).

## Inter Font Loading

**Decision**: Load Inter from Google Fonts via `<link>` in HTML head. Use
`document.fonts.ready` promise before calling Pretext `prepare()`.
**Rationale**: Font must be loaded before text measurement or Pretext will
measure with fallback metrics. Google Fonts CDN is reliable and cached.
