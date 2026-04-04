# Stickshift — Overnight Animation Tuning
**Worker status:** IDLE
**Last worker:** none
**Last updated:** 2026-04-03 17:58 PDT
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

- [ ] 1.1 Run: `cd /Users/morty/.cyrus/repos/stickshift && npx tsx scripts/animation-loop.ts --max-iterations 5 src/scenes/01-the-fall.json "The skeleton transitions from an upright standing pose to a falling pose — arms fling wide from the shoulders, then motor control releases (go-limp) so joints stop holding angles. The key beats: hold standing briefly, drop into falling pose with arms spread, release motors so limbs trail loosely, then optionally re-engage motors into a crouched landing pose."`
  - Record: final score, iterations taken, issues found
  - If score ≥ 7: copy optimized JSON to `src/scenes/01-the-fall.json`
  - If score < 7: save iteration log, note what the critic got stuck on

- [ ] 1.2 Run: `cd /Users/morty/.cyrus/repos/stickshift && npx tsx scripts/animation-loop.ts --max-iterations 5 src/scenes/02-the-kick.json "The skeleton winds up into a coiled pose — kicking leg draws back, arms pull in for counterbalance. Then extends into a full kick — kicking leg drives forward and up, torso rotates at the hip, arms swing opposite for balance. Follow-through: the kicking leg continues its arc, then the skeleton settles into a balanced landing pose with both feet grounded."`
  - Same recording protocol as 1.1

- [ ] 1.3 Run: `cd /Users/morty/.cyrus/repos/stickshift && npx tsx scripts/animation-loop.ts --max-iterations 5 src/scenes/03-the-climb.json "The skeleton alternates between two climbing poses — left arm reaches up while right leg pushes, then right arm reaches up while left leg pushes. Motor control should be strong (high stiffness) to hold reaching poses against gravity. Transitions between climbing0 and climbing1 should be rhythmic and evenly paced, suggesting effort and coordination."`
  - Same recording protocol

- [ ] 1.4 Run: `cd /Users/morty/.cyrus/repos/stickshift && npx tsx scripts/animation-loop.ts --max-iterations 5 src/scenes/04-the-lecture.json "The skeleton holds a confident standing pose with subtle variations — one arm gestures (pointing pose) while the other stays relaxed at the side. Transitions between standing and pointing should be gentle (low stiffness changes, slow timing). The overall impression is calm authority — minimal movement, deliberate gestures."`
  - Same recording protocol

- [ ] 1.5 Run: `cd /Users/morty/.cyrus/repos/stickshift && npx tsx scripts/animation-loop.ts --max-iterations 5 src/scenes/05-the-celebration.json "The skeleton transitions from standing to a victory pose — arms shoot up high, legs may tuck or extend. Motor control should be high to hold the triumphant pose clearly. The transition from standing to victory should be quick and energetic (fast scrollRange, high stiffness). Optional: a brief return to standing before a second celebration gesture."`
  - Same recording protocol

## Phase 2: Analyze results

- [ ] 2.1 Review all iteration logs in `captures/` — which scenes improved? Which plateaued?
- [ ] 2.2 If any scene scored ≥ 7: commit the optimized Scene Beat JSON with message `feat: auto-tuned {scene} via AI validation loop (score: X) [skip ci]`
- [ ] 2.3 If any scene scored < 5 after all iterations: note specific issues — write findings to `captures/tuning-report.md`. Focus on: is the critic giving actionable feedback about poses? Is the adjustment model making meaningful changes?
- [ ] 2.4 Run `npm run build` — verify everything still compiles
- [ ] 2.5 Run `npm test` — verify no regressions
- [ ] 2.6 Git push all changes

## Phase 3: Report

- [ ] 3.1 Post summary to Discord #stickshift (channel 1489696186188304445) with: per-scene scores (before/after), total iterations run, key findings about the skeletal animation critic's effectiveness
- [ ] 3.2 If scores are generally low: write a follow-up ticket recommending specific improvements (better pose descriptions, more named poses in the POSES dict, structured scoring rubric, etc.)

## Completion

- [ ] 4.1 Post final summary to Discord
- [ ] 4.2 Disable the overnight watchdog cron
