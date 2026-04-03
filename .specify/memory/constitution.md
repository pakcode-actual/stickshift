<!--
  Sync Impact Report
  - Version change: 0.0.0 → 1.0.0 (initial ratification)
  - Added principles: I–VII (all new)
  - Added sections: Performance Standards, Development Workflow
  - Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no updates needed (generic)
    - .specify/templates/spec-template.md ✅ no updates needed (generic)
    - .specify/templates/tasks-template.md ✅ no updates needed (generic)
  - Follow-up TODOs: none
-->

# Ragdoll Scrollytelling Constitution

## Core Principles

### I. Animation Quality

Every animation MUST target 60fps on mid-range hardware (2020 MacBook Air
baseline). Frame budget is 16.67ms. Physics step, layout reflow, and render
MUST all complete within a single frame. If a frame is missed, degrade
gracefully (skip physics interpolation) rather than stutter.

### II. Physics Simulation Accuracy

Ragdoll bodies MUST behave plausibly under gravity, collision, and joint
constraints. Revolute joints MUST enforce angular limits. Active ragdoll
motor torques MUST blend smoothly between full ragdoll (0 torque) and pose
tracking (max torque). Rapier.js WASM MUST be used as the sole physics
engine; no hand-rolled solvers.

### III. Accessibility First

All educational text MUST remain in the DOM as selectable, readable,
screen-reader-accessible `<span>` elements. Canvas is used exclusively for
visual elements (stick figures, decorations) that have no textual content.
Color contrast MUST meet WCAG AA (4.5:1 for body text). The page MUST be
navigable without JavaScript for text content (progressive enhancement).

### IV. Canvas + DOM Hybrid Rendering

Physics-driven visuals render on a `<canvas>` overlay. Text renders as
positioned DOM spans beneath/beside the canvas. The two layers MUST stay
spatially synchronized every frame. Z-ordering: DOM text behind canvas
visuals unless explicitly layered otherwise.

### V. Clean TypeScript

Strict mode (`strict: true`) is mandatory. No `any` types except at FFI
boundaries (WASM imports). Each module MUST have a single responsibility
and export a clear public API. Barrel re-exports are prohibited. Prefer
explicit imports.

### VI. Modular Architecture

The codebase MUST be organized into focused modules: physics management,
canvas rendering, text layout (Pretext integration), scene orchestration,
and entry point. Modules communicate through typed interfaces, not global
state. The scene module orchestrates; it does not implement low-level
physics or rendering.

### VII. Visual Polish

The default aesthetic is dark background (#0a0a0a), light text, crisp
anti-aliased canvas lines. Stick figures use white strokes with rounded
line caps. Transitions (active ragdoll stand-up, text reflow) MUST be
eased, not instant. GSAP ScrollTrigger drives scroll-linked animation;
no raw scroll event listeners for animation timing.

## Performance Standards

- Physics timestep: fixed at 1/60s, decoupled from render via accumulator
- Pretext `layoutNextLine()` calls MUST NOT exceed 2ms per frame aggregate
- Canvas draw calls MUST be batched; no redundant state changes
- WASM binary MUST be base64-embedded or lazy-loaded; no blocking network
  fetch on the critical path
- Memory: no per-frame allocations in the hot loop; pre-allocate buffers

## Development Workflow

- Build system: Vite + TypeScript (strict)
- No frameworks (React, Vue, etc.); vanilla TypeScript only
- All source in `src/`, build output in `dist/`
- Lint and type-check MUST pass before any merge
- Each module is independently importable and testable
- Commit after each logical unit of work

## Governance

This constitution defines the non-negotiable quality standards for the
Ragdoll Scrollytelling project. All implementation decisions MUST be
validated against these principles. Amendments require:

1. Documentation of the proposed change and rationale
2. Review of impact on existing code
3. Version bump per semver (MAJOR for principle removal/redefinition,
   MINOR for additions, PATCH for clarifications)

Complexity MUST be justified. If a simpler approach satisfies the
principles, prefer it. Use CLAUDE.md for runtime development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-04-02 | **Last Amended**: 2026-04-02
