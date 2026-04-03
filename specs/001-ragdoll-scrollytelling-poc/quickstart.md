# Quickstart: Ragdoll Scrollytelling POC

## Prerequisites

- Node.js 18+ (20+ recommended)
- npm 9+

## Setup

```bash
git checkout 001-ragdoll-scrollytelling-poc
npm install
```

## Development

```bash
npm run dev
```

Opens at `http://localhost:5173`. Scroll down to trigger the animation.

## Build

```bash
npm run build
```

Output in `dist/`. Fully static — deploy to any file server.

## Preview Production Build

```bash
npm run preview
```

## What to Expect

1. Page loads with educational text on a dark background
2. Scroll down — the scene pins in the viewport
3. A stick figure falls from above, crashing through the text
4. Text reflows in real-time around each body part
5. The figure hits the ground and ragdolls
6. After a moment, joint motors ramp back and the figure stands up
7. A beach ball bounces through, with text reflowing around it too
8. Continue scrolling to unpin and see the rest of the page

## Project Structure

```
src/
  main.ts              Entry point
  physics.ts           Rapier world, ragdoll, ball, motor control
  renderer.ts          Canvas drawing
  pretext-layout.ts    Text measurement and per-frame layout
  scene.ts             Scroll binding, phase management, orchestration
index.html             Host page
```
