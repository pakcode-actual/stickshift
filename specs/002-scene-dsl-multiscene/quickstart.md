# Quickstart: Scene DSL + Multi-Scene Scroll Experience

## Prerequisites

- Node.js 22+ (via nvm)
- npm

## Setup

```bash
cd /Users/morty/.openclaw/workspace/ragdoll-test
npm install
npm run dev
```

## Development Workflow

1. **Type check**: `npx tsc --noEmit`
2. **Dev server**: `npm run dev` (Vite with HMR at localhost:5173)
3. **Build**: `npm run build` (tsc + vite build → dist/)
4. **Preview**: `npm run preview` (serve dist/ locally)

## Key Files to Modify

| File | Change |
|------|--------|
| `src/scene-types.ts` | NEW — TypeScript interfaces for Scene Beat DSL |
| `src/scene-interpreter.ts` | NEW — Runtime engine that reads + executes scene JSON |
| `src/progress-indicator.ts` | NEW — Scroll progress UI |
| `src/scenes/*.json` | NEW — 5 scene beat JSON files |
| `src/physics.ts` | EXTEND — dynamic body creation/destruction, impulse API |
| `src/renderer.ts` | EXTEND — particles, props, camera transforms |
| `src/pretext-layout.ts` | EXTEND — scatter, platform, line-by-line text modes |
| `src/scene.ts` | REFACTOR — delegate to scene-interpreter, manage scroll journey |
| `src/main.ts` | EXTEND — multi-scene bootstrap, load scene JSON files |
| `index.html` | EXTEND — add progress indicator DOM element |

## Architecture Overview

```
ScrollTrigger (single pin, ~10 screen heights)
    ↓ progress (0-1)
scene.ts (journey manager)
    ↓ routes to active scene
scene-interpreter.ts (per-scene state machine)
    ↓ reads from
scenes/*.json (declarative scene beats)
    ↓ controls
physics.ts ← dynamic bodies, motor blend, impulses
renderer.ts ← stick figure, props, particles, camera
pretext-layout.ts ← text mode (reflow/scatter/platform/line-by-line)
```

## Adding a New Scene

1. Create `src/scenes/06-my-scene.json` following the schema in `contracts/scene-beat-schema.json`
2. Set `order: 6` and `scrollRange` to extend the journey
3. The scene interpreter auto-discovers JSON files in `src/scenes/`
4. Adjust other scenes' `scrollRange` values to accommodate the new scene

## Testing

Manual visual testing:
- Scroll through all 5 scenes end-to-end
- Verify 60fps in browser DevTools Performance tab
- Check text interaction modes work per scene
- Verify reverse scrolling reactivates scenes correctly
- Check progress indicator updates
