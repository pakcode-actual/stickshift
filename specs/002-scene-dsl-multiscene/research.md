# Research: Scene DSL + Multi-Scene Scroll Experience

**Date**: 2026-04-02 | **Feature**: 002-scene-dsl-multiscene

## R1: Scene Beat DSL Schema Design

**Decision**: JSON format with typed fields matching TypeScript interfaces. No custom expression language.

**Rationale**: JSON is natively supported by Vite (static import), TypeScript (type-safe parsing), and tooling (IDE validation). A custom DSL language would require a parser and provide no benefit for 5 scenes. The vocabulary is fixed: known actor types, known interaction modes, known transition types.

**Alternatives considered**:
- YAML: More readable but requires a parser dependency. JSON is sufficient for structured scene data.
- TypeScript config files: Would blur the line between data and code. JSON enforces declarative-only.
- Custom DSL with expressions: Overkill for fixed vocabulary. Would need parser, error handling, debuggability.

## R2: Dynamic Body Creation/Destruction in Rapier

**Decision**: Use Rapier's `world.createRigidBody()` and `world.removeRigidBody()` for per-scene body management. Track all bodies created per scene in an array for batch cleanup.

**Rationale**: Rapier's API supports dynamic body creation/destruction without world reset. Bodies can be added/removed at any time. Colliders are automatically removed when their parent body is removed.

**Alternatives considered**:
- Multiple Rapier worlds (one per scene): Higher memory, complex synchronization for transitions. Rapier worlds are heavyweight.
- Object pooling: Premature optimization for 5 scenes with <50 bodies each. Simpler to create/destroy.

## R3: Multi-Scene ScrollTrigger Strategy

**Decision**: Single ScrollTrigger pin on the scene container spanning ~10 screen heights. Progress 0-1 mapped to scene ranges internally.

**Rationale**: GSAP ScrollTrigger's pin mechanism works best with a single pinned element. Multiple pins cause stacking context issues. Internal progress subdivision is trivial math: `sceneProgress = (globalProgress - sceneStart) / (sceneEnd - sceneStart)`.

**Alternatives considered**:
- Multiple ScrollTrigger instances (one per scene): Pin stacking issues, jank during transitions, complex z-index management.
- Intersection Observer: Not precise enough for frame-accurate animation. ScrollTrigger provides sub-pixel progress.

## R4: Text Interaction Mode Architecture

**Decision**: Strategy pattern — each mode is a function conforming to `TextLayoutMode` interface. Mode selected per scene from JSON, passed to layout pipeline.

**Rationale**: The existing `layoutText()` in pretext-layout.ts already implements the "reflow" mode. Adding modes as separate functions keeps the core pipeline clean. Each mode transforms (obstacles, text, progress) into TextLine[].

**Alternatives considered**:
- Class-based strategy: Unnecessary for stateless functions. Functions are simpler.
- Switch statement in layoutText: Would grow unwieldy with 4+ modes. Strategy pattern scales better.

## R5: Scene Transition Approach

**Decision**: Canvas opacity crossfade during transition zones. Outgoing scene stops physics, incoming scene starts. Transition zone is ~5% of total scroll progress (overlapping scene ranges).

**Rationale**: Physics-driven transitions (bodies flying between scenes) would require both scenes' physics running simultaneously, doubling the frame budget. Visual crossfade is simpler and more reliable. The transition is brief (~5% scroll range) so the visual discontinuity is minimal.

**Alternatives considered**:
- Physics-driven transitions: Both worlds active, double frame budget, complex body handoff.
- Slide transitions: Canvas translate animation. Possible but crossfade is simpler and smoother.
- Hard cut: No transition. Jarring visual experience.

## R6: Particle System for Confetti

**Decision**: Rapier-backed particles (small dynamic bodies) rendered as colored canvas shapes. Batch creation on scene entry, batch destruction on exit. ~50-100 particles.

**Rationale**: Using Rapier for particle physics means confetti naturally interacts with text obstacles and the ragdoll. No separate particle system needed. At 50-100 particles with simple colliders, the physics budget stays within the 16.67ms frame.

**Alternatives considered**:
- Pure visual particles (no physics): Simpler but can't interact with text obstacles. Misses the key feature.
- WebGL particle system: Overkill for 100 particles. Would require a second rendering pipeline.
- Separate lightweight physics: Adds complexity. Rapier handles small body counts efficiently.

## R7: Camera/Viewport Behavior

**Decision**: Canvas 2D transform (translate + scale) applied before rendering. Camera state per scene specified in JSON. Smooth interpolation between camera states during transitions.

**Rationale**: Canvas 2D transforms are fast and don't affect DOM text positioning. Camera movements apply only to the canvas layer (physics visuals), while text remains DOM-positioned. This maintains the hybrid rendering model.

**Alternatives considered**:
- CSS transform on container: Would affect both canvas and DOM, breaking text positioning.
- Rapier world offset: Would change physics coordinates, breaking obstacle-text mapping.
