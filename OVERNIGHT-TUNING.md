# Stickshift — Overnight Animation Tuning
**Worker status:** RUNNING
**Last worker:** Claude Sonnet Worker
**Last updated:** 2026-04-03 18:53 PDT
---

## Context
The AI validation loop scripts are fully built. Critic and adjustment prompts have been retooled to focus ONLY on skeletal animation (pose quality, transitions, timing, joint coordination) — NOT physics behavior. This overnight run exercises them against all 5 scenes.

Scripts:
- `scripts/animation-loop.ts` — closed-loop iteration (capture → critique → adjust → repeat)
- `scripts/animation-critic.ts` — vision model quality assessment (skeletal animation focused)
- `tests/animation/frame-capture.spec.ts` — Playwright frame capture

Working dir: `/Users/morty/.cyrus/repos/stickshift`
API: `http://localhost:18789/v1/chat/completions` (OpenClaw local, auth from `~/.openclaw/openclaw.json`)

## Phase 1: Run validation loop on each scene

- [x] 1.1 Run: `cd /Users/morty/.cyrus/repos/stickshift && npx tsx scripts/animation-loop.ts --max-iterations 5 src/scenes/01-the-fall.json "The skeleton transitions from an upright standing pose to a falling pose — arms fling wide from the shoulders, then motor control releases (go-limp) so joints stop holding angles. The key beats: hold standing briefly, drop into falling pose with arms spread, release motors so limbs trail loosely, then optionally re-engage motors into a crouched landing pose."`
  - **Score:** 1-2/10 across first 4 iterations
  - **Issue:** Iterations 2-4 showed only blank frames or loading spinner (no visible skeleton). Critic reported figure was invisible/off-screen or renderer failed. Adjustments tried: restructured scroll ranges to keep action on-screen, increased stiffness dramatically (8→600), replaced go-limp beat with ramp-pose interpolation. None fixed the rendering issue.

- [x] 1.2 Run: `cd /Users/morty/.cyrus/repos/stickshift && npx tsx scripts/animation-loop.ts --max-iterations 5 src/scenes/02-the-kick.json "The skeleton winds up into a coiled pose — kicking leg draws back, arms pull in for counterbalance. Then extends into a full kick — kicking leg drives forward and up, torso rotates at the hip, arms swing opposite for balance. Follow-through: the kicking leg continues its arc, then the skeleton settles into a balanced landing pose with both feet grounded."`
  - **Final score:** 3/10 (no improvement across iterations)
  - **Issue:** Animation failed to convey a clear three-phase kick sequence. Wind-up too subtle, kick extension reads as a backward fall (rigid-body torso tilting instead of hip rotation), follow-through/landing missing (figure stays in same backward-leaning pose). Arm-leg opposition absent. Adjustments increased stiffness values and added intermediate poses (weight-shift, kick-chamber, kick-recover, landing-settle) but score plateaued at 3/10.
  - **Log:** `/Users/morty/.cyrus/repos/stickshift/captures/the-kick-iteration-log.json`
  - **Optimized JSON:** `/Users/morty/.cyrus/repos/stickshift/captures/the-kick-optimized.json` as 1.1

- [x] 1.3 Run: `cd /Users/morty/.cyrus/repos/stickshift && npx tsx scripts/animation-loop.ts --max-iterations 5 src/scenes/03-the-climb.json "The skeleton alternates between two climbing poses — left arm reaches up while right leg pushes, then right arm reaches up while left leg pushes. Motor control should be strong (high stiffness) to hold reaching poses against gravity. Transitions between climbing0 and climbing1 should be rhythmic and evenly paced, suggesting effort and coordination."`
  - **Final score:** 3/10 (no improvement across iterations)
  - **Issue:** Climbing animation failed to produce readable poses. Skeleton remained in near-neutral standing with minimal limb movement despite aggressive stiffness increases (1500→3500). No arm reached overhead, no leg bent into pushing stance. Iterations attempted: (1) restructured beats into explicit alternating climb cycles with high stiffness, (2) tripled stiffness to 600, (3) increased to 1500, (4) final attempt at 3000-3500 stiffness with widened scroll ranges. None achieved visible climbing poses — all frames read as standing with minor fidgeting.
  - **Log:** `/Users/morty/.cyrus/repos/stickshift/captures/the-climb-iteration-log.json`
  - **Optimized JSON:** `/Users/morty/.cyrus/repos/stickshift/captures/the-climb-optimized.json`

- [x] 1.4 Run: `cd /Users/morty/.cyrus/repos/stickshift && npx tsx scripts/animation-loop.ts --max-iterations 5 src/scenes/04-the-lecture.json "The skeleton holds a confident standing pose with subtle variations — one arm gestures (pointing pose) while the other stays relaxed at the side. Transitions between standing and pointing should be gentle (low stiffness changes, slow timing). The overall impression is calm authority — minimal movement, deliberate gestures."`
  - **Final score:** 4/10 (no improvement across iterations)
  - **Issue:** Animation failed to produce a readable pointing gesture. The skeleton maintained a nearly static standing pose with only minimal arm drift throughout. Key problems: (1) pointing arm never achieved a clear, readable extension — stayed in vague A-pose rather than directional point, (2) both arms spread similarly, eliminating the "one gestures, one relaxed" asymmetry, (3) zero supporting body movement (no torso rotation, weight shift, or shoulder engagement), making gesture feel disconnected, (4) transitions so gradual they were imperceptible frame-to-frame. Adjustments progressively increased motorStiffness (120→350→450→520) and motorBlend values, split beats into phased attack-sustain-release arcs, and added deliberate transition periods. Despite these changes, score plateaued at 4/10 across all 5 iterations.
  - **Log:** `/Users/morty/.cyrus/repos/stickshift/captures/the-lecture-iteration-log.json`
  - **Optimized JSON:** `/Users/morty/.cyrus/repos/stickshift/captures/the-lecture-optimized.json`

- [x] 1.5 Run: `cd /Users/morty/.cyrus/repos/stickshift && npx tsx scripts/animation-loop.ts --max-iterations 5 src/scenes/05-the-celebration.json "The skeleton transitions from standing to a victory pose — arms shoot up high, legs may tuck or extend. Motor control should be high to hold the triumphant pose clearly. The transition from standing to victory should be quick and energetic (fast scrollRange, high stiffness). Optional: a brief return to standing before a second celebration gesture."`
  - **Result:** COMPLETED - 5 iterations run successfully
  - **Final score:** 5/10 (best score), scores: 5→2→3→3→2
  - **Issue:** Animation failed to produce a convincing victory pose. Arms never raised overhead despite aggressive stiffness increases (up to 600) — they only reached horizontal T-pose/scarecrow position. Most severe issue: head detached from body around frame 70 in later iterations and floated independently for the rest of the sequence, breaking skeletal integrity. Joint coordination poor: torso and legs showed minimal complementary motion (no lean-back, leg pump, or weight shift). No second celebration gesture was successfully produced. Iterations attempted: (1) Two-stage transition with intermediate pose, (2) Full motorBlend (1.0) with stiffness 400-500, (3) Reduced stiffness (120-280) to prevent overshoot, (4) Re-increased to 550-600 with wider timing. Despite all adjustments, arms never achieved overhead position and head detachment worsened.
  - **Root cause:** The "victory" pose definition in POSES dict likely lacks sufficient joint angle amplitude to create overhead arm positions, OR motor system cannot overcome physics constraints to reach the target pose even at very high stiffness (600), OR there's a fundamental skeletal constraint issue causing head detachment at high stiffness values. Needs manual investigation of pose definitions and physics constraints.
  - **Log:** `/Users/morty/.cyrus/repos/stickshift/captures/the-celebration-iteration-log.json`
  - **Optimized JSON:** `/Users/morty/.cyrus/repos/stickshift/captures/the-celebration-optimized.json`

## Phase 2: Analyze results

- [x] 2.1 Review all iteration logs in `captures/` — which scenes improved? Which plateaued?
  - **Result:** All 4 completed scenes (the-kick, the-climb, the-lecture, the-celebration) showed **complete plateau** — no score improvement across 5 iterations.
  - **The-kick:** 3/10 across all 5 iterations. Issue: Skeleton never achieved a clear kick pose. Torso tilted backward (falling) instead of rotating at hip. No arm-leg opposition. No landing pose — just ended mid-fall. Adjustments tried: multi-phase beats, stiffness increases (90→600), intermediate poses. None worked.
  - **The-climb:** 3/10 across iterations 1-5, briefly dropped to 2/10 at iteration 3. Issue: Arms never reached overhead despite extreme stiffness (up to 3500). Skeleton stayed near-neutral standing with minimal limb movement. No readable alternating climb poses. Multiple stiffness ramps and timing adjustments failed.
  - **The-lecture:** 4/10 across all 5 iterations (highest stable score). Issue: Pointing gesture never achieved clear directional extension — arm drifted into vague A-pose/T-pose instead of pointing. No torso rotation or weight shift to support gesture. Stiffness increased (120→520), phased attack-sustain-release added, but score plateaued.
  - **The-celebration:** Started at 5/10 (best initial score), immediately dropped to 2-3/10 and stayed there. Issue: Arms never raised overhead despite stiffness up to 600 — only reached horizontal T-pose. Most severe: **head detached from body** around frame 70 in later iterations and floated independently. Reducing stiffness didn't prevent detachment, increasing didn't achieve overhead arms.
  - **Root cause hypothesis:** All scenes hit a physics/motor constraint ceiling. The POSES dictionary definitions may lack sufficient joint amplitude, OR the motor system cannot overcome Matter.js physics constraints even at very high stiffness (600-3500), OR there's a skeletal hierarchy/constraint bug causing detachment and pose collapse at high stiffness values. The AI adjustment loop worked mechanically (critic → adjustment → new params) but the underlying pose system appears fundamentally unable to achieve the target poses.
- [x] 2.2 If any scene scored ≥ 7: commit the optimized Scene Beat JSON with message `feat: auto-tuned {scene} via AI validation loop (score: X) [skip ci]`
  - **Result:** N/A — no scenes scored ≥ 7 (best score was 5/10 on the-celebration)
- [x] 2.3 If any scene scored < 5 after all iterations: note specific issues — write findings to `captures/tuning-report.md`. Focus on: is the critic giving actionable feedback about poses? Is the adjustment model making meaningful changes?
  - **Result:** Tuning report written to `captures/tuning-report.md`. Key findings: Critic is highly effective (frame-specific, actionable feedback). Adjustment model responds logically. **Blocker:** Physics/motor system cannot achieve target poses. POSES dict may lack amplitude, head detachment bug at high stiffness, joint constraints prevent overhead arms even at stiffness 3500. Recommendations: audit POSES definitions, fix head constraint bug, add structured scoring rubric.
- [x] 2.4 Run `npm run build` — verify everything still compiles
  - **Result:** ✅ Build successful (421ms). Warning about chunk size (05-the-celebration 1.68MB) but no errors. TypeScript compilation passed, Vite production build completed.
- [x] 2.5 Run `npm test` — verify no regressions
  - **Result:** ✅ All 29 tests passed (39.6s). No regressions. Tests covered: frame capture determinism, accessibility, physics determinism, pose stability, scroll journey, WASM init, visual regression.
- [ ] 2.6 Git push all changes

## Phase 3: Report

- [ ] 3.1 Post summary to Discord #stickshift (channel 1489696186188304445) with: per-scene scores (before/after), total iterations run, key findings about the skeletal animation critic's effectiveness
- [ ] 3.2 If scores are generally low: write a follow-up ticket recommending specific improvements (better pose descriptions, more named poses in the POSES dict, structured scoring rubric, etc.)

## Completion

- [ ] 4.1 Post final summary to Discord
- [ ] 4.2 Disable the overnight watchdog cron
