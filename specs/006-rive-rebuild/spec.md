# Spec 006: Rebuild Stickshift with Rive Animation Engine

## Overview

Replace the entire canvas-based stick figure animation system (Rapier.js motors, kinematic skeleton, GSAP-driven joint angles) with Rive — a purpose-built interactive animation engine with built-in state machines, ~150KB runtime, and 99%+ mobile compatibility.

## Why

After 4 failed iterations on the celebration animation alone, the current approach (hand-authored radian values in JSON → canvas line drawing) is fundamentally broken:
- Nobody should animate stick figures by typing radians into JSON
- The bone-chain validator scored 7/10 on animation Paul called "completely wrong"
- Cyrus ignores specified angle values and writes his own
- The AI vision critic can't distinguish good from bad at this resolution
- Every animation attempt requires Paul's direct intervention

Rive solves this by moving animation authoring to a visual editor where you drag limbs, and provides a runtime with built-in state machines for interactive character behavior.

## Architecture

### What Gets Replaced
- `src/kinematic-skeleton.ts` — replaced by Rive runtime
- `src/animation-driver.ts` — replaced by Rive state machine inputs
- `src/renderer.ts` (stick figure drawing) — replaced by Rive canvas rendering
- `src/scene-interpreter.ts` (kinematic mode) — replaced by Rive state machine triggers
- `src/physics.ts` (ragdoll motor system) — removed for character animation; Rapier KEPT for environmental props only
- `scripts/animation-loop.ts` — replaced by Rive's visual editor iteration
- `scripts/animation-critic.ts` — simplified (Playwright screenshots + vision model still work)
- `scripts/bone-chain-validator.ts` — removed (Rive handles pose validity)
- All scene JSON files (`src/scenes/*.json`) — replaced with .riv files + scene config

### What Gets Kept
- `@chenglou/pretext` — text layout with obstacle reflow (core feature)
- `gsap` + ScrollTrigger — scroll-driven scene orchestration
- `@dimforge/rapier2d-compat` — environmental physics (props, particles) only
- Vite + TypeScript build system
- Playwright test infrastructure
- Canvas + DOM hybrid rendering approach (Rive renders to canvas, text stays in DOM)
- Accessibility (DOM text remains selectable, screen-readable)

### New Stack
```
Rive Runtime (@rive-app/canvas) — character animation + state machines
GSAP ScrollTrigger — maps scroll position to Rive state machine inputs
Pretext — DOM text layout with obstacle reflow
Rapier.js — environmental props only (confetti, balls)
Vite + TypeScript — build system
Playwright — E2E testing
```

### New Architecture Flow
```
User scrolls
  → GSAP ScrollTrigger fires onUpdate with progress (0-1)
  → Progress mapped to Rive state machine inputs
    → e.g., "section" input changes from 1 to 2 → triggers walk → idle transition
    → e.g., "celebrate" trigger fires → plays celebration state
  → Rive renders character animation to canvas
  → Pretext layouts text around canvas obstacles
  → Rapier steps environmental physics (confetti, props)
  → DOM text spans positioned by Pretext
```

## Phase 0: Proof of Concept

### Goal
Get a Rive character rendering on the page, responding to scroll, with text flowing around it. Use a community placeholder character (not custom stick figure yet).

### Tasks
1. **Create `src/rive-character.ts`** — loads .riv file, creates Rive instance on canvas, exposes state machine inputs
2. **Create `rive-test.html`** as Vite entry point (add to vite.config.ts rollupOptions.input) — NOT a static HTML file copied to dist
3. **Download a community .riv character** with walk/idle/celebrate states to `public/rive/`
4. **Wire GSAP ScrollTrigger** to Rive state machine inputs — scroll between sections triggers animation state changes
5. **Verify:** character renders, animates, responds to scroll, mobile-compatible
6. **Keep existing pages working** — index.html and sandbox.html unchanged

### Technical Requirements (from Constitution)
- Vanilla TypeScript, no frameworks
- Strict mode
- Rive canvas element for character, DOM spans for text
- 60fps target on 2020 MacBook Air
- Progressive enhancement: text readable without JS

### Character Source
Use Rive community marketplace (https://rive.app/community/files/) — search for character with walk/idle states. Download .riv, place in `public/rive/`. This is a placeholder until we design the real stick figure in Rive's editor.

### The .riv file loading pattern
```typescript
import { Rive, StateMachineInput } from '@rive-app/canvas'

const rive = new Rive({
  src: '/rive/character.riv',
  canvas: document.getElementById('rive-canvas') as HTMLCanvasElement,
  autoplay: true,
  stateMachines: 'State Machine 1',
  onLoad: () => {
    // Get state machine inputs
    const inputs = rive.stateMachineInputs('State Machine 1')
    // Wire to scroll
  }
})
```

### Success Criteria
- [ ] Rive character renders on a test page served by Vite dev server
- [ ] Character plays idle animation by default
- [ ] Scrolling triggers animation state changes (idle → walk → celebrate)
- [ ] `npm run build` produces working dist/ with Rive assets
- [ ] `npm test` passes (existing tests don't break)
- [ ] Page loads in <2s on desktop, <4s on mobile
- [ ] Rive canvas + DOM text coexist on the same page

## Phase 1: Custom Stick Figure Character

Design the actual stick figure in Rive's editor:
- Simple circle head, line body, line arms, line legs
- Animations: idle (subtle sway), walk, run, jump, celebrate, fall, sit, wave, look around
- State machine: idle ↔ walk ↔ run, any → jump, any → celebrate, any → fall
- Export .riv, replace placeholder

This is the step where Paul (or a designer) uses Rive's visual editor. The tool handles the animation quality — no more radians.

## Phase 2: Scroll-Driven Storytelling

Replace the current 5-scene system with Rive-driven scenes:
- Each "scene" is a scroll section that triggers specific Rive states
- Character moves between DOM sections (position updates based on scroll)
- Text reflows around the character (Pretext integration)
- Environmental props (confetti, etc.) still use Rapier

## Phase 3: Autonomous Character Behavior

Add personality to the character via Rive state machine:
- Idle behaviors: random fidgeting, looking around, tapping foot
- Content-aware reactions: character notices new sections appearing
- Scroll-speed reactions: fast scroll → character runs; slow scroll → character walks
- Personality parameters exposed as Rive inputs

## Commit Convention
All commits: `[skip ci]` until CI is updated for Rive
