# Implementation Plan: Animation Gym

**Branch**: `003-animation-gym` | **Date**: 2026-04-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-animation-gym/spec.md`

## Summary

Build a `/sandbox` route in the existing Vite app that loads individual Scene Beat JSON files and plays them back in a self-contained loop, independent of scroll triggers or text reflow. The sandbox reuses the existing physics (`physics.ts`), rendering (`renderer.ts`), and scene interpreter (`scene-interpreter.ts`) modules but drives them with a manual timeline instead of GSAP ScrollTrigger. A simple HTML/CSS overlay provides play/pause/step controls, a timeline scrubber, joint motor parameter sliders, and a debug overlay toggle showing target skeleton vs. physical ragdoll.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: @dimforge/rapier2d-compat ^0.14.0, gsap ^3.12.7 (easing functions only — no ScrollTrigger in sandbox), Vite
**Storage**: N/A (Scene Beat JSON loaded as static assets or via file input)
**Testing**: Manual visual testing (developer tool); Playwright smoke test for route loading
**Target Platform**: Browser (Chrome/Firefox/Safari, desktop)
**Project Type**: Web application (developer tooling route within existing app)
**Performance Goals**: 60fps physics playback, <3s beat load time
**Constraints**: Must share identical physics code with scrollytelling mode — no forked copies
**Scale/Scope**: Single developer tool route, 1 beat at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. Animation Quality (60fps) | PASS | Sandbox runs same fixed-timestep physics loop; no additional overhead beyond UI overlay |
| II. Physics Simulation Accuracy | PASS | Reuses `physics.ts` directly — same Rapier world, same motor API |
| III. Accessibility First | N/A | Developer tool, not end-user content. No educational text in sandbox. |
| IV. Canvas + DOM Hybrid | PASS | Canvas for ragdoll rendering, DOM for sandbox controls overlay |
| V. Clean TypeScript | PASS | Strict mode, typed interfaces for sandbox state, no `any` |
| VI. Modular Architecture | PASS | Key architectural change: extract playback driver interface so scene-interpreter can be driven by either ScrollTrigger or sandbox timeline |
| VII. Visual Polish | PASS | Dark background maintained; sandbox UI is functional overlay |

No violations. No complexity justification needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-animation-gym/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main.ts                    # Updated: route detection, conditional init
├── sandbox.ts                 # NEW: Sandbox entry point & game loop
├── sandbox-ui.ts              # NEW: HTML/CSS overlay controls (play/pause/step/scrubber/sliders)
├── debug-overlay.ts           # NEW: Target skeleton + angle deviation rendering
├── playback.ts                # NEW: Playback driver interface (replaces direct ScrollTrigger coupling)
├── physics.ts                 # EXISTING: No changes needed (already exports clean API)
├── renderer.ts                # EXISTING: Minor addition — debug skeleton draw function
├── scene-interpreter.ts       # EXISTING: Refactor to accept progress from playback driver instead of scroll
├── scene-types.ts             # EXISTING: No changes
├── pretext-layout.ts          # EXISTING: Not used in sandbox mode
├── scene.ts                   # EXISTING: Refactor to use playback driver for scroll mode
├── progress-indicator.ts      # EXISTING: Not used in sandbox mode
└── scenes/                    # EXISTING: Beat JSON files (loadable by sandbox)
    ├── 01-the-fall.json
    ├── 02-the-kick.json
    ├── 03-the-climb.json
    ├── 04-the-lecture.json
    └── 05-the-celebration.json

sandbox.html                   # NEW: Sandbox route entry point (Vite MPA)
```

**Structure Decision**: Single-project structure. The sandbox is a second Vite entry point (`sandbox.html`) serving the `/sandbox` route. This avoids modifying the main `index.html` and keeps the sandbox route cleanly separated while sharing all source modules.

## Architecture

### Playback Driver Abstraction

The core architectural change is introducing a `PlaybackDriver` interface that decouples scene interpretation from the scroll mechanism:

```
┌──────────────────┐     ┌──────────────────┐
│  ScrollDriver    │     │  SandboxDriver   │
│ (GSAP trigger)   │     │ (manual timeline) │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         ▼                        ▼
   ┌─────────────────────────────────┐
   │     PlaybackDriver interface    │
   │  - getProgress(): number        │
   │  - onProgressChange(cb)         │
   │  - isPlaying(): boolean         │
   └──────────────┬──────────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │     Scene Interpreter        │
   │  (executeStep, POSES, etc.)  │
   └──────────────────────────────┘
```

The existing `scene.ts` / `scene-interpreter.ts` currently receive progress directly from `ScrollTrigger.onUpdate`. The refactor wraps this in a `ScrollDriver` that implements `PlaybackDriver`. The sandbox creates a `SandboxDriver` that advances progress via:
- Real-time playback (configurable speed, auto-looping)
- Manual step (advance by 1 physics frame = 1/60s worth of progress)
- Scrubber seek (jump to arbitrary progress, re-simulate from t=0)

### Sandbox Game Loop

```
User loads beat JSON
  → Parse & validate against scene-types.ts
  → Create Rapier world via initPhysics()
  → Create ragdoll & actors via existing physics.ts functions
  → Start sandbox loop:
      1. SandboxDriver computes current progress
      2. Scene interpreter executes beat steps for current progress
      3. Physics steps (same stepPhysics())
      4. Renderer draws stick figure (same render())
      5. Debug overlay draws target skeleton + angle data (if enabled)
      6. UI updates timeline scrubber position
      7. requestAnimationFrame → repeat
```

### Timeline Scrubbing (Deterministic Replay)

Seeking to frame N requires deterministic replay from frame 0:
1. Reset physics world (teleport ragdoll, zero velocities)
2. Re-execute all beat steps from progress=0 to target progress
3. Step physics N times
4. Render final state

This is consistent with how Rapier works (deterministic given same inputs). For a typical beat spanning ~200 frames, replay takes <50ms (well under frame budget).

### Debug Overlay

Renders on the same canvas, after the main render pass:
- **Target skeleton**: Wireframe stick figure drawn at the target pose angles (from POSES lookup), rendered in a distinct color (e.g., cyan with 50% opacity)
- **Physical ragdoll**: Already rendered by `renderer.ts`
- **Angle readout**: Per-joint text labels showing `target: X.XX rad | actual: Y.YY rad | delta: Z.ZZ rad`
- **Rapier debug draw**: Optional toggle using Rapier's built-in debug renderer to show colliders, joints, and AABBs

### Sandbox UI (HTML/CSS Overlay)

Simple DOM overlay positioned absolute over the canvas:

```
┌─────────────────────────────────────────────┐
│ [Beat Selector ▼]              [Debug ☐]    │
│                                [Rapier ☐]   │
│                                             │
│           (Canvas: ragdoll animation)       │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ [◀] [▶/⏸] [▶|]  ═══════●══════  0:03  │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Joint: [neck ▼]                         │ │
│ │ Stiffness: ═══●════  600               │ │
│ │ Damping:   ═══●════   60               │ │
│ │ Target:    ═══●════  0.00 rad          │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

Built with plain HTML elements + CSS (no framework, per constitution). Controls:
- **Beat selector**: Dropdown listing available scene JSON files
- **Transport**: Step-back, Play/Pause, Step-forward buttons
- **Timeline scrubber**: Range input mapped to [0, 1] progress
- **Debug toggles**: Checkboxes for skeleton overlay and Rapier debug
- **Joint panel**: Dropdown to select joint, range inputs for stiffness/damping/target angle

### Vite Multi-Page Setup

Add `sandbox.html` as a second entry point in `vite.config.ts`:

```typescript
build: {
  rollupOptions: {
    input: {
      main: 'index.html',
      sandbox: 'sandbox.html',
    },
  },
},
```

This serves `/sandbox.html` in dev mode and builds both pages for production.
