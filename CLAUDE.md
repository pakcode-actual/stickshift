# ragdoll-test Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-02

## Active Technologies
- TypeScript 5.x (strict mode) + @dimforge/rapier2d-compat ^0.14.0, @chenglou/pretext ^0.0.4, gsap ^3.12.7 (+ ScrollTrigger plugin) (002-scene-dsl-multiscene)
- N/A (scene JSON bundled as static assets via Vite) (002-scene-dsl-multiscene)
- TypeScript 5.x (strict mode) + @dimforge/rapier2d-compat ^0.14.0, gsap ^3.12.7 (easing functions only — no ScrollTrigger in sandbox), Vite (003-animation-gym)
- N/A (Scene Beat JSON loaded as static assets or via file input) (003-animation-gym)

- TypeScript 5.x (strict mode) + @dimforge/rapier2d-compat (WASM physics), @chenglou/pretext (text layout), gsap + @gsap/scrolltrigger (scroll animation) (001-ragdoll-scrollytelling-poc)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (strict mode): Follow standard conventions

## Recent Changes
- 003-animation-gym: Added TypeScript 5.x (strict mode) + @dimforge/rapier2d-compat ^0.14.0, gsap ^3.12.7 (easing functions only — no ScrollTrigger in sandbox), Vite
- 002-scene-dsl-multiscene: Added TypeScript 5.x (strict mode) + @dimforge/rapier2d-compat ^0.14.0, @chenglou/pretext ^0.0.4, gsap ^3.12.7 (+ ScrollTrigger plugin)

- 001-ragdoll-scrollytelling-poc: Added TypeScript 5.x (strict mode) + @dimforge/rapier2d-compat (WASM physics), @chenglou/pretext (text layout), gsap + @gsap/scrolltrigger (scroll animation)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
