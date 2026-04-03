# Stick Figure Storytelling — Overnight Build
**Worker status:** RUNNING
**Last worker:** watchdog-2026-04-02-2337
**Last updated:** 2026-04-03 06:56 UTC
---

## Phase B: Playwright Frame Capture Pipeline (STI-5)
- [x] Create tests/animation/frame-capture.spec.ts
- [x] Load sandbox.html, select scene via dropdown
- [x] Step frame-by-frame using sandbox Step button (click btn-step)
- [x] Capture screenshot every 10 frames, store as captures/{scene}-frame-{N}.png
- [x] Run twice and assert screenshots are pixel-identical (determinism proof)
- [x] Export frame sequence metadata as JSON (frame number, timestamp, physics hash)
- [x] npm run build passes
- [x] npm test passes
- [x] Deploy to ragdoll-test.slugbug.ai via: CLOUDFLARE_API_TOKEN=$(grep CLOUDFLARE_API_TOKEN ~/.openclaw/workspace/.env | cut -d= -f2) CLOUDFLARE_ACCOUNT_ID=7eb696b430f2bd51aa1e239d050aba90 wrangler pages deploy dist/ --project-name ragdoll-test --branch main --commit-dirty=true
- [x] git commit with message "feat: STI-5 Phase B — frame capture pipeline"

## Phase C: Vision Model Animation Critic (STI-6)
- [x] Create scripts/animation-critic.ts (can be a standalone Node script)
- [x] Accepts: directory of frame PNGs + scene description string
- [x] Selects key frames (every 30th, or first/middle/last)
- [x] Sends to Claude vision API (use Anthropic SDK, API key from env ANTHROPIC_API_KEY)
- [x] Prompt template: "This is a stick figure animation of [description]. These frames show the sequence. Rate the animation quality 1-10. List specific issues with frame numbers."
- [x] Structured output: { score: number, issues: [{ frame: number, description: string }], summary: string }
- [x] Temperature=0 for reproducibility
- [x] Test with The Kick scene captures from Phase B
- [x] npm run build passes
- [ ] git commit with message "feat: STI-6 Phase C — vision model critic"

## Phase D: Closed-Loop Iteration (STI-7)
- [ ] Create scripts/animation-loop.ts
- [ ] Takes: Scene Beat JSON path + target description + max iterations (default 5)
- [ ] Loop: load scene in sandbox → capture frames → vision critic → if score >= 7 done, else adjust params
- [ ] The "adjust params" step: feed the critic's output to Claude (text model) asking it to modify the Scene Beat JSON motor stiffness, target angles, timing based on the critique
- [ ] Log each iteration: { iteration, params_hash, score, critique, adjustments_made }
- [ ] Save iteration log as captures/{scene}-iteration-log.json
- [ ] Final output: optimized Scene Beat JSON + filmstrip of best iteration
- [ ] npm run build passes
- [ ] git commit with message "feat: STI-7 Phase D — closed-loop animation iteration"

## Completion
- [ ] Post summary to Discord channel 1483684719550791690
- [ ] Disable watchdog cron
