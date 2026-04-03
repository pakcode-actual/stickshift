# Tasks: AI Animation Validation Loop (Phases B-D)

**Input**: `/specs/004-ai-validation-loop/spec.md`
**Prerequisites**: Phase A determinism (already implemented in `tests/e2e/determinism.spec.ts`)

## Format: `[ID] [P?] [Phase] Description`

---

## Phase B: Frame Capture Pipeline

- [ ] T001 Create `tests/animation/frame-capture.spec.ts` — Playwright test that loads `sandbox.html`, selects a scene via `#beat-selector` dropdown, steps frame-by-frame using `btn-step` button, captures screenshot every 10 frames, stores as `captures/{scene}-frame-{N}.png`
- [ ] T002 Add determinism assertion to frame capture — run the same scene twice, assert all frame screenshots are pixel-identical
- [ ] T003 Export frame metadata JSON — `captures/{scene}-metadata.json` with `{ frames: [{ number, timestamp, physicsHash }] }` using the existing `__stepAndHash` from Phase A
- [ ] T004 Verify `npm run build` passes, commit with `feat: STI-B — frame capture pipeline [skip ci]`

## Phase C: Vision Model Critic

- [ ] T005 Create `scripts/animation-critic.ts` — standalone Node script (runnable via `npx tsx`) that accepts a directory of frame PNGs + scene description string as CLI args
- [ ] T006 Implement key frame selection — pick every 30th frame plus first and last from the captures directory
- [ ] T007 Implement vision model call — send key frames as image content parts to `http://localhost:18789/v1/chat/completions` (OpenAI-compatible format). Prompt should evaluate: overall motion quality (1-10), frame-level issues (hyperextension, unnatural acceleration, clipping, floating, stiffness), description match
- [ ] T008 Return structured JSON output: `{ score, issues: [{ frame, description }], summary, matchesDescription }`
- [ ] T009 Add temperature=0 for reproducibility. Verify `npm run build` passes, commit with `feat: STI-C — vision model animation critic [skip ci]`

## Phase D: Closed-Loop Iteration

- [ ] T010 Create `scripts/animation-loop.ts` — standalone Node script that accepts Scene Beat JSON path + target description + max iterations (default 5)
- [ ] T011 Implement iteration loop: load scene in sandbox via Playwright → capture frames (reuse Phase B) → run critic (Phase C) → if score ≥ 7 done, else send critique + current JSON to text model via `localhost:18789` asking for parameter adjustments
- [ ] T012 Implement parameter change bounds — max ±20% adjustment per parameter per iteration to prevent oscillation
- [ ] T013 Implement iteration logging — write `captures/{scene}-iteration-log.json` with `{ iteration, paramsHash, score, critique, adjustments }` per iteration
- [ ] T014 Output: optimized Scene Beat JSON + path to best iteration's frame captures. Verify `npm run build` passes, commit with `feat: STI-D — closed-loop animation iteration [skip ci]`
