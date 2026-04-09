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

## Animation Validation (MANDATORY)

After modifying any scene JSON keyframes:

1. Run: `npx tsx scripts/bone-chain-validator.ts src/scenes/<scene>.json`
   - If ANY errors, fix the keyframes before proceeding
2. Run: `npx playwright test tests/animation/frame-capture.spec.ts -g "<scene name>"`
   - Captures frames for visual validation
3. Run: `npx tsx scripts/animation-critic.ts --scene-json src/scenes/<scene>.json captures/enhanced <scene-description>`
   - Score must be >= 6 to proceed
4. If score < 6, adjust keyframes based on critic feedback and repeat from step 1
5. Include validation score in commit message: `[score: N/10]`

Do NOT create a PR without running validation.

<!-- MANUAL ADDITIONS END -->
