# Quickstart: Animation Gym

**Branch**: `003-animation-gym` | **Date**: 2026-04-02

## Prerequisites

- Node.js v22+ (via nvm)
- npm

## Setup

```bash
git checkout 003-animation-gym
npm install
npm run dev
```

## Usage

1. Open `http://localhost:5173/sandbox.html` in a browser
2. Select a Scene Beat JSON from the dropdown (built-in beats from `src/scenes/`)
3. Use transport controls:
   - **Play/Pause**: Toggle automatic playback
   - **Step**: Advance one physics frame (1/60s)
   - **Scrubber**: Drag to seek to any point in the timeline
4. Toggle debug overlays:
   - **Target Skeleton**: Shows desired pose wireframe in cyan
   - **Rapier Debug**: Shows colliders, joints, AABBs
5. Tune joint motors:
   - Select a joint from the dropdown
   - Adjust stiffness, damping, target angle sliders
   - Changes apply immediately to the running simulation

## Development

### Key files to modify

| File | Purpose |
| ---- | ------- |
| `src/sandbox.ts` | Sandbox entry point and game loop |
| `src/sandbox-ui.ts` | HTML/CSS control overlay |
| `src/debug-overlay.ts` | Target skeleton and angle deviation rendering |
| `src/playback.ts` | PlaybackDriver interface and implementations |

### Testing changes

The sandbox shares physics code with the main scrollytelling route. After tuning parameters in the sandbox:

1. Note the stiffness/damping/target values from the sliders
2. Apply those values to the corresponding Scene Beat JSON
3. Run the main route (`http://localhost:5173/`) and scroll to the relevant scene
4. Verify behavior matches

### Adding new poses

Add entries to the `POSES` record in `src/scene-interpreter.ts`. The sandbox will pick them up automatically since it imports from the same module.
