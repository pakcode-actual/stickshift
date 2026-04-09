<!--
  Sync Impact Report
  - Version change: 1.0.0 → 2.0.0 (architecture pivot to Rive)
  - Removed principles: II (Physics Simulation Accuracy — no longer primary animation system)
  - Redefined principles: I (Animation Quality), IV (Rendering), VI (Modular Architecture)
  - Added principles: VIII (Rive-First Animation), IX (Autonomous Pipeline)
  - Added sections: Agent Architecture, Testing Standards
  - Follow-up TODOs: update strata.config.md domain description
-->

# Stickshift Constitution

## Core Principles

### I. Animation Quality

Every animation MUST be authored in a visual editor (Rive), not by hand-coding
angle values, radians, or keyframe numbers. If a human can't see the animation
while creating it, the authoring method is wrong.

Animations MUST target 60fps on mid-range hardware (2020 MacBook Air baseline).
The Rive runtime handles frame timing; the integration layer MUST NOT introduce
jank through excessive DOM queries, layout thrashing, or synchronous operations
in the render loop.

### II. Character Autonomy

The stick figure is a CHARACTER, not a puppet. It should feel alive — quirky,
funny, unpredictable. Behavior is driven by state machines (authored in Rive)
with inputs from scroll position, timers, and random triggers. The character
makes decisions; the code provides context.

Idle behaviors (fidgeting, looking around, tapping foot) are mandatory for any
scene where the character is visible. A static character is a dead character.

### III. Accessibility First

All educational text MUST remain in the DOM as selectable, readable,
screen-reader-accessible `<span>` elements. Rive renders to a canvas element
for visual animation only — no text content in the canvas layer.

Color contrast MUST meet WCAG AA (4.5:1 for body text). The page MUST be
navigable without JavaScript for text content (progressive enhancement).

`prefers-reduced-motion` MUST be respected: when set, Rive animations pause
or reduce to static poses. Content remains fully readable.

### IV. Canvas + DOM Hybrid Rendering

Rive renders the character on a `<canvas>` element. Text renders as positioned
DOM spans (via Pretext or native layout). The two layers MUST stay spatially
synchronized. Z-ordering: DOM text behind canvas visuals unless explicitly
layered otherwise.

Rive canvas MUST NOT be full-screen unless the scene requires it. Prefer
positioned canvas elements that coexist with DOM content.

### V. Clean TypeScript

Strict mode (`strict: true`) is mandatory. No `any` types except at FFI
boundaries (Rive WASM imports). Each module MUST have a single responsibility
and export a clear public API. Barrel re-exports are prohibited.

### VI. Modular Architecture

The codebase is organized into focused modules:
- **Rive character** — loads .riv, manages state machine, renders
- **Scroll orchestrator** — GSAP ScrollTrigger, maps scroll to Rive inputs
- **Text layout** — Pretext integration, DOM text positioning
- **Environmental physics** — Rapier.js for props (confetti, balls) only
- **Scene config** — declares which .riv file, which states, which scroll triggers

Modules communicate through typed interfaces. The scroll orchestrator drives
Rive inputs; it does not reach into Rive internals.

### VII. Visual Polish

The default aesthetic is dark background (#0a0a0a), light character strokes,
crisp rendering. The Rive character should use a toon/line-art style consistent
with the stick figure concept. Transitions between states MUST be smooth
(Rive's built-in blending handles this).

GSAP ScrollTrigger with `scrub` drives scroll-linked animation. No raw scroll
event listeners for animation timing.

### VIII. Rive-First Animation

ALL character animation goes through Rive. No hand-coded joint angles, no
canvas line-drawing for characters, no motor-driven physics poses.

The animation authoring workflow is:
1. Design animations in Rive's visual editor
2. Build state machines in Rive's editor
3. Export .riv file
4. Load in TypeScript via @rive-app/canvas runtime
5. Wire scroll/interaction events to state machine inputs

Rapier.js is ONLY used for environmental props (confetti physics, bouncing
objects). It MUST NOT drive character animation.

### IX. Autonomous Pipeline

The development pipeline MUST minimize Paul's intervention. Target: zero
manual steps between "ticket approved" and "deployed."

The pipeline:
```
Strata evaluates → Paul approves → Ticket created →
Cyrus implements → Tests pass → PR created →
Auto-merged → Deployed → Ticket closed →
Next ticket picked up automatically
```

Every step that requires manual intervention is a system failure to be
tracked and eliminated. The nightly PDLC retrospective measures:
- Paul Intervention Count (target: 0)
- Time-to-Flow (ticket created → deployed, target: <30 min simple, <2 hr complex)

### X. Testing Without Paul

The system MUST be able to test and iterate without human review for
routine changes. Specifically:

- **Visual regression:** Playwright screenshots at key scroll positions,
  compared against baselines. Catches rendering breaks.
- **Animation state verification:** Playwright triggers scroll positions,
  verifies Rive state machine is in expected state via runtime API.
- **Performance:** Lighthouse CI scores must not regress.
- **Accessibility:** axe-core audit must pass.

Paul reviews for CREATIVE quality (does the character feel right?), not
TECHNICAL correctness (does it render? does it crash?). Technical correctness
is automated.

## Performance Standards

- Rive runtime: ~150KB gzipped (acceptable for animation quality gained)
- Total page load: <2s desktop, <4s mobile (including .riv file)
- .riv files: lazy-loaded, not blocking critical path
- Rapier WASM: lazy-loaded, only when environmental physics are needed
- Pretext layoutNextLine() calls MUST NOT exceed 2ms per frame aggregate
- No per-frame allocations in hot loops

## Agent Architecture

### Strata (PM Agent)
Evaluates all feature requests. Every ticket goes through Evidence×Alignment
matrix, RICE scoring, pre-mortem, case against. No cowboy tickets.

### Director Agent (NEW — replaces Animator Agent)
Designs BEHAVIOR, not animation. Outputs scene scripts:
- "At section 2, character walks to the right edge"
- "At section 3, character notices heading, does double-take, sits down"

Does NOT specify animation details (those live in the .riv file). Specifies
WHAT the character does and WHEN, not HOW the limbs move.

### Cyrus (Developer Agent)
Implements features via Linear tickets. For Rive integration:
- Wires scroll events to Rive state machine inputs
- Positions Rive canvas relative to DOM elements
- Handles .riv file loading and lifecycle

Does NOT author animations. Animations come from .riv files.

### Validator (Automated Testing)
- Playwright visual regression (screenshot comparison)
- Rive state machine assertion (verify correct state at scroll position)
- Performance regression (Lighthouse CI)
- Accessibility (axe-core)

## Development Workflow

- Build system: Vite + TypeScript (strict)
- No frameworks (React, Vue, etc.); vanilla TypeScript only
- All source in `src/`, build output in `dist/`
- .riv files in `public/rive/` (copied to dist by Vite)
- Lint and type-check MUST pass before any merge
- Commit after each logical unit of work
- All commits include `[skip ci]` until CI pipeline is updated

## Governance

This constitution defines the non-negotiable quality standards for
Stickshift. All implementation decisions MUST be validated against these
principles. Amendments require:

1. Documentation of the proposed change and rationale
2. Review of impact on existing code
3. Version bump per semver

Complexity MUST be justified. If a simpler approach satisfies the
principles, prefer it.

**Version**: 2.0.0 | **Ratified**: 2026-04-09 | **Last Amended**: 2026-04-09
**Pivot**: Rive animation engine replacing canvas joint-angle system
