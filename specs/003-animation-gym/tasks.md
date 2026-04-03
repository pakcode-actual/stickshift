# Tasks: Animation Gym

**Input**: Design documents from `/specs/003-animation-gym/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not requested — test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Vite multi-page setup and sandbox route scaffolding

- [ ] T001 Add sandbox.html entry point at project root with canvas, text-layer container, and control overlay container — referencing src/sandbox.ts as module script
- [ ] T002 Update Vite config to add sandbox.html as second rollup input in vite.config.ts
- [ ] T003 Create sandbox entry module at src/sandbox.ts with Rapier WASM init, canvas setup, and empty game loop stub

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: PlaybackDriver abstraction and scene-interpreter refactor — MUST complete before any user story work

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create PlaybackDriver interface and SandboxDriver class in src/playback.ts — implement getProgress(), isPlaying(), onProgressChange(), play(), pause(), stepForward(), seek(), setSpeed(), setLooping(), destroy() per contracts/playback-driver.ts
- [ ] T005 Create ScrollDriver class in src/playback.ts wrapping GSAP ScrollTrigger — implements PlaybackDriver interface, replaces direct ScrollTrigger.onUpdate coupling
- [ ] T006 Refactor src/scene.ts (initJourney / updateJourney) to accept a PlaybackDriver instead of directly creating ScrollTrigger — ScrollDriver becomes the default for the main route
- [ ] T007 Refactor src/scene-interpreter.ts to receive progress from PlaybackDriver callbacks instead of being called directly with scroll progress — ensure executeStep/revertStep API remains unchanged
- [ ] T008 Verify main scrollytelling route still works identically after refactor — run dev server, scroll through all 5 scenes, confirm no behavioral regression

**Checkpoint**: Foundation ready — PlaybackDriver abstraction in place, main route unchanged, sandbox can now use SandboxDriver

---

## Phase 3: User Story 1 - Load and Play Back a Single Animation Beat (Priority: P1) MVP

**Goal**: Developer navigates to /sandbox.html, selects a Scene Beat JSON, and sees it play back on a continuous loop without scroll dependencies.

**Independent Test**: Open /sandbox.html, select a beat from dropdown, observe looped playback. Pause and resume. Verify no scroll input is needed.

### Implementation for User Story 1

- [ ] T009 [US1] Add beat loader function in src/sandbox.ts that imports all scene JSON files from src/scenes/, parses them as SceneBeat[], and exposes a list of available beats by id/title
- [ ] T010 [US1] Implement sandbox game loop in src/sandbox.ts — on beat load: create Rapier world via initPhysics(), create ragdoll and actors, wire SandboxDriver progress to scene-interpreter, render via existing render() function, loop with requestAnimationFrame
- [ ] T011 [US1] Implement continuous looping in SandboxDriver (src/playback.ts) — when progress reaches 1.0 and looping is enabled, reset physics world (teleport ragdoll, zero velocities), reset scene-interpreter state, restart progress from 0
- [ ] T012 [US1] Create basic sandbox UI scaffold in src/sandbox-ui.ts — beat selector dropdown populated from available beats list, play/pause button, wire beat selection to sandbox loader
- [ ] T013 [US1] Style sandbox UI overlay in src/sandbox-ui.ts — position absolute over canvas, dark semi-transparent panel at bottom, minimal CSS (no framework), responsive to canvas size
- [ ] T014 [US1] Handle empty state in src/sandbox.ts — when no beat is loaded, display instructions text on canvas ("Select a Scene Beat to begin") and disable transport controls
- [ ] T015 [US1] Handle invalid/malformed beat JSON in src/sandbox.ts — wrap beat parsing in try/catch, display clear error message on canvas with the parse error details, do not crash

**Checkpoint**: User Story 1 fully functional — developer can load any beat and watch it loop in the sandbox

---

## Phase 4: User Story 2 - Frame-by-Frame Playback Control (Priority: P1)

**Goal**: Developer can pause playback, step forward one physics frame at a time, and scrub the timeline to any point.

**Independent Test**: Load a beat, pause it, click step-forward repeatedly and observe the ragdoll advancing one frame per click. Drag the timeline scrubber and verify the ragdoll jumps to the correct state.

### Implementation for User Story 2

- [ ] T016 [US2] Implement stepForward() in SandboxDriver (src/playback.ts) — advance progress by exactly 1/totalFrames, step physics once, re-render, stay paused
- [ ] T017 [US2] Implement deterministic seek() in SandboxDriver (src/playback.ts) — reset physics world to initial state, replay all beat steps and physics from frame 0 to target frame, render final state
- [ ] T018 [US2] Add transport controls to sandbox UI in src/sandbox-ui.ts — step-forward button, timeline scrubber (HTML range input mapped to [0,1] progress), frame counter display showing current frame / total frames
- [ ] T019 [US2] Wire timeline scrubber input events in src/sandbox-ui.ts — on scrubber drag, call SandboxDriver.seek() with the scrubber value; on playback progress change, update scrubber position to match current progress

**Checkpoint**: User Stories 1 and 2 both work — developer can play, pause, step, and scrub through any beat

---

## Phase 5: User Story 3 - Real-Time Joint Motor Tuning (Priority: P2)

**Goal**: Developer adjusts joint motor stiffness, damping, and target angle via sliders. Changes apply instantly to the running simulation.

**Independent Test**: Load a beat, select a joint from dropdown, adjust stiffness slider, observe ragdoll behavior change in real time. Note final values and verify they produce identical behavior when applied to the Scene Beat JSON in the main route.

### Implementation for User Story 3

- [ ] T020 [US3] Add joint selection dropdown to sandbox UI in src/sandbox-ui.ts — list all 9 ragdoll joints by name (neck, shoulderL, elbowL, shoulderR, elbowR, hipL, kneeL, hipR, kneeR), update selectedJoint state on selection
- [ ] T021 [US3] Add motor parameter sliders to sandbox UI in src/sandbox-ui.ts — three range inputs for stiffness (0–1200, default 600), damping (0–120, default 60), and target angle (-PI to PI, default from current pose), with numeric readout labels
- [ ] T022 [US3] Implement joint override application in src/sandbox.ts — maintain JointOverride map per data-model.md, on slider change update the override for the selected joint, apply overrides each frame via joint.configureMotorPosition() after scene-interpreter sets poses
- [ ] T023 [US3] Populate sliders with current values in src/sandbox-ui.ts — when a joint is selected, read its current stiffness/damping/target from the Rapier joint and set slider positions accordingly; when beat actions change motor values, reflect in sliders if that joint is selected

**Checkpoint**: User Stories 1, 2, and 3 all work — developer can play, control timeline, and tune motor parameters

---

## Phase 6: User Story 4 - Visual Debug Overlays (Priority: P2)

**Goal**: Developer toggles a debug overlay showing the target kinematic skeleton vs. the physical ragdoll, with per-joint angle data.

**Independent Test**: Load a beat, enable debug overlay, observe cyan wireframe skeleton at target pose overlaid on the white physical ragdoll. Per-joint angle labels should show target vs. actual values. Toggle off and verify overlay disappears.

### Implementation for User Story 4

- [ ] T024 [P] [US4] Create debug overlay renderer in src/debug-overlay.ts — implement drawTargetSkeleton() that computes target pose joint positions via forward kinematics from torso position using current pose angles from POSES record, renders as cyan wireframe stick figure with 50% opacity
- [ ] T025 [P] [US4] Implement per-joint angle labels in src/debug-overlay.ts — for each joint, render canvas text near the joint showing "target: X.XX | actual: Y.YY | delta: Z.ZZ" in a readable font with dark background for contrast
- [ ] T026 [US4] Integrate Rapier debug rendering in src/debug-overlay.ts — use Rapier's debug render API to draw collider outlines, joint anchors, and AABBs when the Rapier debug toggle is enabled
- [ ] T027 [US4] Add debug toggle controls to sandbox UI in src/sandbox-ui.ts — two checkboxes: "Target Skeleton" and "Rapier Debug", positioned in top-right corner of overlay, wire to DebugState booleans
- [ ] T028 [US4] Integrate debug overlay into sandbox render loop in src/sandbox.ts — after main render() call, conditionally call drawTargetSkeleton() and drawAngleLabels() based on DebugState, conditionally call Rapier debug draw

**Checkpoint**: All 4 user stories functional and independently testable

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, error handling, and final validation

- [ ] T029 Handle extreme motor parameter values in src/sandbox.ts — clamp stiffness/damping to non-negative, allow full angle range, ensure simulation stability when parameters hit extremes
- [ ] T030 Handle rapid timeline scrubbing in src/sandbox.ts — debounce seek() calls during fast scrubber drag to avoid excessive replays, render only final seek position
- [ ] T031 Handle missing joint/body references in src/sandbox.ts — when a beat references actors not present, log warning to console and continue loading available actors
- [ ] T032 Run quickstart.md validation — verify all steps in specs/003-animation-gym/quickstart.md work end-to-end on a clean checkout

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–6)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 — US2 depends on US1 (needs beat loading and playback)
  - US3 and US4 are both P2 — can proceed in parallel after US1, independent of each other
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 (needs working beat playback to add timeline controls)
- **User Story 3 (P2)**: Depends on US1 (needs running simulation to tune), independent of US2/US4
- **User Story 4 (P2)**: Depends on US1 (needs rendered ragdoll to overlay), independent of US2/US3

### Within Each User Story

- UI scaffold before wiring to logic
- Core logic before edge case handling
- Commit after each task or logical group

### Parallel Opportunities

- T024 and T025 can run in parallel (separate rendering functions in same file)
- US3 and US4 can be worked in parallel after US1 completes
- All Phase 7 polish tasks can run in parallel

---

## Parallel Example: User Story 4

```bash
# Launch parallel debug overlay tasks:
Task: "Create debug overlay renderer in src/debug-overlay.ts" (T024)
Task: "Implement per-joint angle labels in src/debug-overlay.ts" (T025)
# Then sequentially:
Task: "Integrate Rapier debug rendering in src/debug-overlay.ts" (T026)
Task: "Add debug toggle controls to sandbox UI" (T027)
Task: "Integrate debug overlay into sandbox render loop" (T028)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T008)
3. Complete Phase 3: User Story 1 (T009–T015)
4. **STOP and VALIDATE**: Load a beat in /sandbox.html, verify looped playback works
5. Demo if ready — sandbox already useful for basic animation observation

### Incremental Delivery

1. Setup + Foundational → PlaybackDriver abstraction in place
2. Add User Story 1 → Beat loads and loops (MVP!)
3. Add User Story 2 → Frame-stepping and timeline scrubbing
4. Add User Story 3 → Real-time motor tuning
5. Add User Story 4 → Debug overlays for pose diagnosis
6. Polish → Edge cases and validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after its checkpoint
- Total: 32 tasks (3 setup, 5 foundational, 7 US1, 4 US2, 4 US3, 5 US4, 4 polish)
- Commit after each task or logical group
