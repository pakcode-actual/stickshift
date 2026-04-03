# Implementation Plan: Scene DSL + Multi-Scene Scroll Experience

**Branch**: `002-scene-dsl-multiscene` | **Date**: 2026-04-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-scene-dsl-multiscene/spec.md`

## Summary

Evolve the single hardcoded scene into a multi-scene scrollytelling experience driven by a Scene Beat DSL (JSON format). Build a scene interpreter that reads declarative JSON files describing actors, physics parameters, motor blend targets, text interaction modes, and scroll triggers — then instantiates and manages those scenes dynamically. Deliver 5 demo scenes with smooth scroll-driven transitions and a progress indicator.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: @dimforge/rapier2d-compat ^0.14.0, @chenglou/pretext ^0.0.4, gsap ^3.12.7 (+ ScrollTrigger plugin)
**Storage**: N/A (scene JSON bundled as static assets via Vite)
**Testing**: Manual visual testing + `tsc` type checking + `vite build` verification
**Target Platform**: Modern desktop browsers (Chrome, Firefox, Safari) with GPU acceleration
**Project Type**: Web application (single-page scrollytelling experience)
**Performance Goals**: 60fps with active physics, text reflow, and canvas rendering per frame within 16.67ms budget
**Constraints**: <16.67ms per frame, no per-frame allocations in hot loop, WASM physics only (no hand-rolled solvers)
**Scale/Scope**: 5 scenes, ~10 screen heights scroll journey, single-page application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Animation Quality (60fps) | PASS | Single active scene at a time; dynamic body cleanup prevents accumulation. Frame budget enforced by existing game loop. |
| II. Physics Simulation Accuracy | PASS | Rapier.js WASM remains sole physics engine. Motor blend system extended, not replaced. DSL specifies physics params declaratively. |
| III. Accessibility First | PASS | Text remains as DOM spans. Each scene's text content flows through existing Pretext pipeline. New text modes (scatter, platform, line-by-line) still render as DOM spans. |
| IV. Canvas + DOM Hybrid | PASS | Canvas for physics visuals, DOM for text. New particle effects (confetti) render on canvas. Text-as-platforms have DOM representation + physics collider. |
| V. Clean TypeScript | PASS | Strict mode. Scene Beat JSON validated via TypeScript interfaces. No `any` types. New modules have single responsibilities. |
| VI. Modular Architecture | PASS | New scene-interpreter.ts orchestrates; physics.ts extended for dynamic bodies; renderer.ts extended for particles. Clear module boundaries. |
| VII. Visual Polish | PASS | GSAP ScrollTrigger for all scroll-linked animation. Eased transitions between scenes. Dark theme maintained. |
| Performance Standards | PASS | Fixed timestep, batched draw calls, pre-allocated buffers. Dynamic body creation/destruction happens at scene boundaries, not per-frame. |
| Development Workflow | PASS | Vite + TypeScript strict. No frameworks. Modular source in src/. |

**Gate result: ALL PASS** — no violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/002-scene-dsl-multiscene/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (Scene Beat JSON schema)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main.ts              # Entry point — extended for multi-scene bootstrap
├── physics.ts           # Extended: dynamic body creation/destruction, impulse API
├── renderer.ts          # Extended: particle effects, text-block platforms, run animation
├── pretext-layout.ts    # Extended: scatter mode, platform mode, line-by-line mode
├── scene.ts             # Refactored: delegates to scene-interpreter, manages scroll ranges
├── scene-interpreter.ts # NEW: reads Scene Beat JSON, instantiates/manages scenes
├── scene-types.ts       # NEW: TypeScript interfaces for Scene Beat DSL
├── progress-indicator.ts # NEW: scroll progress UI component
└── scenes/              # NEW: Scene Beat JSON files
    ├── 01-the-fall.json
    ├── 02-the-kick.json
    ├── 03-the-climb.json
    ├── 04-the-lecture.json
    └── 05-the-celebration.json
```

**Structure Decision**: Flat module structure in `src/` — consistent with Phase 1. Scene JSON files co-located in `src/scenes/`. No deep nesting needed for 5 scenes and ~10 modules.

## Complexity Tracking

> No constitution violations — table not needed.

## Design Decisions

### D1: Scene Lifecycle — One Active Scene at a Time

Each scene fully owns its physics bodies, text content, and rendering state. When a scene deactivates (user scrolls past its range), all its dynamic bodies are destroyed and removed from the Rapier world. The next scene creates its own bodies fresh. This keeps the physics world lean and prevents cross-scene interference.

**Rationale**: Simpler than managing overlapping physics worlds. During transitions, both scenes may briefly coexist visually (canvas crossfade), but only the incoming scene runs physics.

### D2: Scene Beat JSON — Declarative but Practical

The DSL describes *what* happens, not *how* the engine executes it. Each beat specifies actors by type (ragdoll, prop), physics params, motor targets per scroll sub-range, and text mode. The interpreter maps these declarations to physics.ts and renderer.ts calls.

**Rationale**: Full declarative purity would require a custom expression language. Instead, the DSL uses a fixed vocabulary of actor types, interaction modes, and transition types — extensible by adding new enum values and interpreter handlers.

### D3: Text Interaction Modes as Strategy Pattern

Each mode (reflow, scatter, platform, line-by-line) is a function conforming to a shared interface: `(obstacles, textContent, scrollProgress) => TextLine[]`. The scene interpreter selects the mode from the JSON and passes it to the layout pipeline.

**Rationale**: Keeps pretext-layout.ts extensible without conditional sprawl. New modes can be added by implementing the interface and registering in a mode map.

### D4: ScrollTrigger — Single Pin, Multiple Scenes

One ScrollTrigger instance pins the scene container for the entire journey (~10 screen heights). Scene ranges are sub-divisions of the 0-1 progress. Each scene gets a `[start, end]` progress range from its JSON. The interpreter activates/deactivates scenes based on current progress.

**Rationale**: Multiple ScrollTrigger pins would cause jank and z-index conflicts. A single pin with internal progress mapping is cleaner and matches ScrollTrigger's design intent.

### D5: Particle System — Lightweight Canvas-Only

Confetti particles are simple canvas-drawn shapes (circles, rectangles) with physics bodies. They're created as a batch when the celebration scene activates and destroyed on exit. No sprite textures, no WebGL — pure 2D canvas.

**Rationale**: Keeps the rendering pipeline uniform. Rapier handles particle physics (gravity, collision) so they interact naturally with text obstacles.

## Module Extension Plan

### physics.ts Extensions

- `createDynamicProp(type, x, y, params)`: Create beach balls, boxes, platforms from DSL params
- `destroyBody(body)`: Remove a body from the Rapier world safely
- `destroyAllSceneBodies(bodies[])`: Batch cleanup for scene deactivation
- `applyImpulse(body, vector)`: Apply impulse force from DSL specification
- `setGravityOverride(world, gravity)`: Per-scene gravity configuration
- `createParticleBatch(count, region, params)`: Spawn confetti particle bodies

### renderer.ts Extensions

- `drawProp(ctx, body, type)`: Render boxes, platforms (rectangles with styling)
- `drawParticles(ctx, particles[])`: Render confetti particles with rotation and color
- `drawRunningFigure(ctx, ragdoll, phase)`: Running animation cycle for kick scene
- `drawPointingArm(ctx, ragdoll, target)`: Pointing gesture for lecture scene
- `applyCamera(ctx, camera)`: Apply viewport transform (translate, scale) per scene

### pretext-layout.ts Extensions

- `layoutTextScatter(lines, impactPoint, force)`: Scatter words from impact
- `layoutTextPlatform(textBlocks)`: Create physics-backed text platforms
- `layoutTextLineByLine(text, revealProgress)`: Progressive line reveal
- Mode registry: `textModes: Record<string, TextLayoutMode>`

### scene.ts Refactor

- Remove hardcoded state machine
- Delegate to scene-interpreter for state management
- Manage overall scroll journey (single ScrollTrigger pin)
- Route progress to active scene interpreter instance
