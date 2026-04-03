# AI Animation Validation Loop — Phases B-D

## Overview

Build the remaining three phases of the AI Animation Validation Loop: frame capture (B), vision model critic (C), and closed-loop auto-tuning (D). Phase A (determinism + snapshot hashing) is already implemented and working.

The goal: given a Scene Beat JSON and a description of what the animation *should* look like, automatically iterate on motor stiffness, damping, and target angles until a vision model rates the animation as acceptable (score ≥ 7/10) or a max iteration cap is reached.

## Problem Statement

Stickshift's Scene Beat DSL controls ragdoll animations via motor parameters (stiffness, damping, target angles per keyframe). Tuning these by hand is tedious — dozens of parameters per scene, and the interaction between gravity, motors, and joint limits makes manual tuning non-intuitive. The sandbox exists for manual experimentation, but there's no automated feedback loop.

Phase A proved the physics simulation is deterministic (identical inputs → identical SHA-256 hashes). This means we can reliably capture, critique, and iterate on animations programmatically.

## Solution

Three scripts/tests, built in order, each independently useful:

### Phase B: Playwright Frame Capture Pipeline

**File:** `tests/animation/frame-capture.spec.ts`

**Behavior:**
1. Load `sandbox.html` in Playwright
2. Select a scene via the `#beat-selector` dropdown
3. Step frame-by-frame using the sandbox Step button (`btn-step`)
4. Capture a screenshot every 10 frames, store as `captures/{scene}-frame-{N}.png`
5. Run the same scene twice and assert screenshots are pixel-identical (determinism proof for visual output, complementing Phase A's hash-based proof)
6. Export frame sequence metadata as JSON: `captures/{scene}-metadata.json` with `{ frames: [{ number, timestamp, physicsHash }] }`

**Success criteria:**
- Given a scene name, When the capture pipeline runs twice, Then all frame screenshots are pixel-identical
- Captures directory populated with PNGs and metadata JSON

### Phase C: Vision Model Animation Critic

**File:** `scripts/animation-critic.ts` (standalone Node script, runnable via `npx tsx scripts/animation-critic.ts`)

**Behavior:**
1. Accept arguments: directory of frame PNGs + scene description string
2. Select key frames: every 30th frame, plus first and last
3. Send key frames to a vision model via OpenClaw's local chat completions API (`http://localhost:18789/v1/chat/completions`)
4. Use a structured critique prompt that asks the model to evaluate:
   - Overall motion quality (1-10)
   - Specific frame-level issues (limb hyperextension, unnatural acceleration, clipping, floating, stiffness)
   - Whether the animation matches the scene description
5. Return structured JSON output:
```json
{
  "score": 7,
  "issues": [
    { "frame": 30, "description": "Left arm hyperextends past natural joint limit" },
    { "frame": 60, "description": "Ragdoll appears to float — insufficient gravity effect" }
  ],
  "summary": "The fall animation starts well but the mid-air pose is too stiff...",
  "matchesDescription": true
}
```
6. Temperature=0 for reproducibility

**API usage:** Standard OpenAI-compatible chat completions format against `localhost:18789`. Use the vision model by including image content parts in the messages array. No separate API keys needed.

**Success criteria:**
- Given intentionally-bad animation frames, When the critic evaluates them, Then score is ≤ 4
- Given hand-tuned animation frames, When the critic evaluates them, Then score is ≥ 6
- Output is valid JSON matching the schema above

### Phase D: Closed-Loop Iteration

**File:** `scripts/animation-loop.ts` (standalone Node script, runnable via `npx tsx scripts/animation-loop.ts`)

**Behavior:**
1. Accept arguments: Scene Beat JSON path + target description + max iterations (default 5)
2. Loop:
   a. Load scene in sandbox via Playwright (reuse Phase B's capture mechanism)
   b. Capture frames
   c. Run vision critic (Phase C)
   d. If score ≥ 7: done, output final JSON
   e. Else: send critique + current Scene Beat JSON to text model (via `localhost:18789`), ask it to adjust motor parameters
   f. Parameter change constraint: max ±20% adjustment per parameter per iteration (prevents oscillation)
   g. Write adjusted JSON, repeat from (a)
3. Log each iteration:
```json
{
  "iteration": 1,
  "paramsHash": "abc123...",
  "score": 4,
  "critique": "...",
  "adjustments": { "joint_left_elbow": { "stiffness": { "from": 50, "to": 60 } } }
}
```
4. Save iteration log as `captures/{scene}-iteration-log.json`
5. Final output: optimized Scene Beat JSON + path to best iteration's frame captures

**Success criteria:**
- Given "The Fall" scene with default parameters, When the loop runs, Then score improves across iterations (even if it doesn't hit 7)
- Iteration log is written with all fields populated
- Parameter changes are bounded (no ±>20% per iteration)
- Loop terminates at max iterations if threshold not reached

## Architecture Notes

- All AI calls go through `localhost:18789` (OpenClaw local API) — do NOT add separate API keys or SDKs
- Frame captures use the existing sandbox infrastructure (same `__stepAndHash` mechanism from Phase A for determinism, plus Playwright screenshots for visual output)
- Scene Beat JSON format is read by Phase D but the schema is not modified — adjustments are to parameter *values* only (stiffness, damping, targetAngle)
- Scripts live in `scripts/` directory, tests in `tests/animation/`

## Target Scenes
- Primary: "The Fall" (simplest, good baseline)
- Secondary: "The Kick" (more complex motor interaction)
- Remaining scenes (The Climb, The Lecture, The Celebration) are follow-up work, not in this spec

## Constraints
- Use `[skip ci]` in all commit messages
- Generate any visual baselines on PKX runner, not macOS
- `npm run build` and `npm test` must pass after each phase
