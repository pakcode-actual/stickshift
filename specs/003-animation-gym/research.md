# Research: Animation Gym

**Branch**: `003-animation-gym` | **Date**: 2026-04-02

## R1: Decoupling Scene Interpreter from ScrollTrigger

**Decision**: Introduce a `PlaybackDriver` interface that provides `progress` to the scene interpreter. Two implementations: `ScrollDriver` (wraps GSAP ScrollTrigger, used by main route) and `SandboxDriver` (manual timeline, used by sandbox).

**Rationale**: The current `scene.ts` directly couples scroll progress to scene activation and beat execution. The scene interpreter (`scene-interpreter.ts`) receives progress as a plain number — it doesn't know about ScrollTrigger. The coupling is only in `scene.ts` where `ScrollTrigger.onUpdate` feeds progress. This means the refactor is minimal: extract the progress-feeding pattern into a typed interface and provide an alternative driver for sandbox mode.

**Alternatives considered**:
- **Fork scene-interpreter.ts**: Rejected — violates FR-010 (parameter parity) and constitution principle VI (modular architecture). Two copies would drift.
- **Mock ScrollTrigger in sandbox**: Rejected — GSAP ScrollTrigger requires DOM scroll events. Mocking it adds unnecessary complexity when a simple interface suffices.
- **Embed sandbox controls in main page**: Rejected — adds complexity to the main scrollytelling experience and violates the "route-separated" requirement.

## R2: Deterministic Timeline Scrubbing

**Decision**: Implement seeking by replaying physics from frame 0 to target frame. Reset ragdoll position/velocity, re-execute all beat steps sequentially, step physics N times.

**Rationale**: Rapier's physics simulation is deterministic given identical inputs and timestep ordering. Snapshot/restore of the full Rapier world state is not supported in the WASM bindings (`@dimforge/rapier2d-compat`). Replay from zero is the only reliable approach. Performance is acceptable: at 60fps fixed timestep, a 5-second beat has 300 frames. Each `world.step()` takes ~0.1ms, so full replay costs ~30ms — well within the 16.67ms frame budget when amortized (replay only happens on seek, not every frame).

**Alternatives considered**:
- **Rapier world snapshot/restore**: Not available in WASM bindings. Would require serializing/deserializing the entire world, which the JS API doesn't expose.
- **Keyframe caching**: Store ragdoll state every N frames, replay from nearest keyframe. Adds complexity for marginal gain on short beats. Could be added later if beats exceed ~10 seconds.

## R3: Debug Overlay Rendering Approach

**Decision**: Render target skeleton as a second stick figure on the same canvas, using a distinct color (cyan, 50% opacity). Draw after the main render pass. Per-joint angle labels rendered as canvas text near each joint.

**Rationale**: Using canvas for the debug overlay keeps rendering in a single pass and avoids DOM/canvas synchronization issues. The existing `drawStickFigure` function in `renderer.ts` computes joint positions from Rapier body positions — for the target skeleton, we compute positions from the target pose angles using forward kinematics from the torso position. This is a straightforward geometric calculation.

**Alternatives considered**:
- **Separate overlay canvas**: Unnecessary complexity. Single canvas with layered draws is simpler and avoids compositing issues.
- **DOM-based debug info**: Could work for angle readouts but not for skeleton wireframe. Mixing approaches adds complexity.

## R4: Vite Multi-Page Application Setup

**Decision**: Add `sandbox.html` as a second Vite entry point using `rollupOptions.input`. The sandbox route is served at `/sandbox.html` in dev and production.

**Rationale**: Vite natively supports multi-page apps via Rollup input configuration. This is the simplest approach — no router library needed, no SPA complexity. Each page has its own entry script and can share all `src/` modules.

**Alternatives considered**:
- **Hash-based routing in index.html**: Rejected — would require loading ScrollTrigger/GSAP infrastructure on the sandbox route unnecessarily, and complicates the entry point.
- **Vite plugin for SPA routing**: Rejected — over-engineered for two routes. Constitution mandates no frameworks.
