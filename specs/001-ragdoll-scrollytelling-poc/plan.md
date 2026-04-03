# Implementation Plan: Ragdoll Scrollytelling POC

**Branch**: `001-ragdoll-scrollytelling-poc` | **Date**: 2026-04-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ragdoll-scrollytelling-poc/spec.md`

## Summary

A scroll-driven demo where a ragdoll stick figure falls through reflowing
educational text, ragdolls on ground impact, and stands back up via active
ragdoll motor recovery. A beach ball bounces through the scene with text
reflowing around it too. Built as a static Vite + TypeScript page with
Rapier.js WASM physics, Pretext for text layout, and GSAP ScrollTrigger
for scroll-driven scene pinning.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: @dimforge/rapier2d-compat (WASM physics), @chenglou/pretext (text layout), gsap + @gsap/scrolltrigger (scroll animation)
**Storage**: N/A (fully client-side, no persistence)
**Testing**: Manual visual testing (POC phase)
**Target Platform**: Modern desktop browsers (Chrome, Firefox, Safari) with WASM support
**Project Type**: Static web application (single page)
**Performance Goals**: 60fps animation, <16.67ms frame budget
**Constraints**: No framework dependencies, base64-embedded WASM, <5MB total bundle
**Scale/Scope**: Single demo page, ~5 source modules, ~1500 LOC estimated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Animation Quality (60fps) | PASS | Fixed timestep physics, requestAnimationFrame render loop, frame budget tracking |
| II. Physics Simulation Accuracy | PASS | Rapier.js WASM with revolute joints, motor torque blending, angular limits |
| III. Accessibility First | PASS | Text as DOM spans, canvas only for visuals, WCAG AA contrast |
| IV. Canvas + DOM Hybrid | PASS | Canvas overlay for stick figure/ball, DOM spans for text |
| V. Clean TypeScript | PASS | strict: true, no any, single-responsibility modules |
| VI. Modular Architecture | PASS | 5 focused modules communicating via typed interfaces |
| VII. Visual Polish | PASS | Dark theme, eased transitions, GSAP ScrollTrigger, rounded line caps |

## Project Structure

### Documentation (this feature)

```text
specs/001-ragdoll-scrollytelling-poc/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── main.ts              # Entry point: init WASM, create scene, start loop
├── physics.ts           # Rapier world, ragdoll body creation, motor control
├── renderer.ts          # Canvas drawing: stick figure lines, beach ball, ground
├── pretext-layout.ts    # Pretext integration: prepare text, layout with exclusions
└── scene.ts             # Scene orchestration: scroll binding, animation phases

index.html               # Host page with DOM structure
```

**Structure Decision**: Single flat `src/` directory. Five modules is small
enough that subdirectories add no value. Each module exports typed functions
and interfaces consumed by `scene.ts` (orchestrator) and `main.ts` (entry).

## Complexity Tracking

No violations to justify.
