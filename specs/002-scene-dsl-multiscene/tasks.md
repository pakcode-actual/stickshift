# Tasks: Scene DSL + Multi-Scene Scroll Experience

**Input**: Design documents from `/specs/002-scene-dsl-multiscene/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Project structure and shared type definitions

- [ ] T001 Define Scene Beat DSL TypeScript interfaces (SceneBeat, Actor, BeatStep, TextConfig, CameraConfig, PhysicsConfig, TransitionConfig) in src/scene-types.ts
- [ ] T002 Create src/scenes/ directory for scene JSON files

**Checkpoint**: Type system ready for scene interpreter and JSON authoring

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core scene interpreter infrastructure that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Implement scene interpreter core in src/scene-interpreter.ts — load SceneBeat JSON, manage scene lifecycle (UNLOADED → LOADING → ACTIVE → TRANSITIONING_OUT → UNLOADED), route scroll progress to active scene's beat steps
- [ ] T004 Extend src/physics.ts with dynamic body API — add createDynamicProp(type, position, params), destroyBody(body), destroyAllSceneBodies(bodies[]), applyImpulse(body, vector), setGravityOverride(world, gravity)
- [ ] T005 Refactor src/scene.ts from hardcoded state machine to journey manager — single ScrollTrigger pin (~10 screen heights / 5 scenes), delegate per-scene state to scene-interpreter, activate/deactivate scenes based on global scroll progress ranges
- [ ] T006 Update src/main.ts to load all scene JSON files from src/scenes/, pass to refactored scene.ts journey manager, and wire scene interpreter into the game loop

**Checkpoint**: Foundation ready — scene JSON files can be loaded, interpreted, and driven by scroll. User story implementation can begin.

---

## Phase 3: User Story 1 — Scene Beat DSL Defines Physics Animations Declaratively (Priority: P1) MVP

**Goal**: The existing Phase 1 "Fall" scene works identically when driven from a JSON file instead of hardcoded logic

**Independent Test**: Load 01-the-fall.json, scroll through the scene, verify ragdoll falls, ragdolls, stands up — same behavior as Phase 1

### Implementation

- [ ] T007 [US1] Author src/scenes/01-the-fall.json — ragdoll actor with motor blend beat steps matching Phase 1 state machine (waiting → falling → ragdoll → recovering → standing → ball_enter), beach ball prop, reflow text mode, scroll range [0.0, 0.2]
- [ ] T008 [US1] Implement beat step executor in src/scene-interpreter.ts — map action strings (drop, go-limp, stand-up, launch-ball) to physics.ts calls (unfreezeRagdoll, goLimp, setMotorBlend, launchBeachBall), handle motorBlend ramping over scroll sub-ranges
- [ ] T009 [US1] Wire ragdoll actor lifecycle in src/scene-interpreter.ts — on scene activate: teleport ragdoll to JSON position, freeze, set motor blend; on beat step: execute action; on scene deactivate: cleanup props
- [ ] T010 [US1] Verify The Fall scene parity — confirm scroll behavior, motor blend transitions, and beach ball launch match Phase 1 exactly

**Checkpoint**: The Fall works from JSON — DSL is proven. No regression from Phase 1.

---

## Phase 4: User Story 2 — Multi-Scene Scroll Journey (Priority: P1)

**Goal**: Five scenes play in sequence as user scrolls, with transitions and progress indicator

**Independent Test**: Scroll top to bottom through all 5 scene ranges, verify each activates in order with smooth transitions, progress indicator updates

### Implementation

- [ ] T011 [US2] Implement scene transition system in src/scene-interpreter.ts — crossfade canvas opacity between outgoing/incoming scenes during transition zones, stop outgoing physics while incoming starts
- [ ] T012 [US2] Create progress indicator module in src/progress-indicator.ts — DOM element showing 5 dots/segments, highlight active scene, update on scroll, handle transitions and reverse scrolling
- [ ] T013 [US2] Add progress indicator DOM element to index.html — fixed-position container with scene dots, styled to match dark theme (#0a0a0a background, light indicators)
- [ ] T014 [US2] Update src/main.ts to initialize progress indicator module and connect to scene.ts scroll progress updates
- [ ] T015 [US2] Implement reverse scroll handling in src/scene-interpreter.ts — when user scrolls backward, reactivate previous scene with correct initial state, re-create physics bodies, reset beat step execution state
- [ ] T016 [US2] Update index.html scroll height — extend bottom-spacer to accommodate ~10 screen heights total scroll journey for 5 scenes, update ScrollTrigger end value in src/scene.ts

**Checkpoint**: Multi-scene scroll journey works with transitions and progress indicator. Reverse scrolling handled correctly.

---

## Phase 5: User Story 3 — Dynamic Physics Body Management (Priority: P1)

**Goal**: Physics bodies are created per-scene and destroyed on exit, no memory leaks

**Independent Test**: Scroll through multiple scenes, verify body count returns to baseline after each scene, frame rate stays at 60fps

### Implementation

- [ ] T017 [US3] Implement per-scene body tracking in src/scene-interpreter.ts — maintain array of all RigidBody references created for the active scene, including ragdoll resets, props, and particles
- [ ] T018 [US3] Implement scene cleanup in src/scene-interpreter.ts — on scene deactivate, call destroyAllSceneBodies() from physics.ts, clear body tracking array, verify no orphaned colliders remain
- [ ] T019 [US3] Add physics body creation from Actor JSON in src/scene-interpreter.ts — map actor definitions (type, propType, position, velocity, physics params) to createDynamicProp() calls in physics.ts
- [ ] T020 [US3] Handle rapid scroll edge case in src/scene-interpreter.ts — when multiple scenes activate/deactivate in quick succession, queue cleanup operations and ensure previous scene is fully cleaned before new scene starts

**Checkpoint**: Dynamic body management is robust — no leaks, no orphans, stable 60fps.

---

## Phase 6: User Story 4 — Text-Physics Interaction Modes (Priority: P2)

**Goal**: Four distinct text interaction modes work correctly: reflow, scatter, platform, line-by-line

**Independent Test**: Load each scene individually, verify text behaves according to its mode specification

### Implementation

- [ ] T021 [P] [US4] Implement text scatter mode in src/pretext-layout.ts — layoutTextScatter(lines, impactPoint, force) that displaces word positions outward from impact, with velocity decay over frames
- [ ] T022 [P] [US4] Implement text platform mode in src/pretext-layout.ts — layoutTextPlatform(textBlocks) that creates fixed physics bodies (via physics.ts createDynamicProp with kinematic type) at text block positions, renders text on top of platforms
- [ ] T023 [P] [US4] Implement text line-by-line reveal mode in src/pretext-layout.ts — layoutTextLineByLine(text, revealProgress) that reveals lines progressively based on scroll progress within the scene
- [ ] T024 [US4] Create text mode registry in src/pretext-layout.ts — textModes map keyed by mode string ("reflow", "scatter", "platform", "line-by-line"), wire into scene-interpreter to select mode from scene JSON TextConfig
- [ ] T025 [US4] Extend src/renderer.ts with platform drawing — drawPlatform(ctx, body, text) renders text-block platforms as styled rectangles with text labels

**Checkpoint**: All four text modes are functional and visually distinct.

---

## Phase 7: User Story 5 — Five Cohesive Demo Scenes (Priority: P2)

**Goal**: Five scenes tell an educational mini-story about physics simulation, each demonstrating a distinct interaction pattern

**Independent Test**: Scroll through all scenes end-to-end, verify each has distinct visuals and the narrative progresses logically

### Implementation

- [ ] T026 [US5] Author src/scenes/02-the-kick.json — ragdoll runs across screen (running pose motor targets), jump-kicks beach ball (impulse action), ball flies through text (scatter text mode), scroll range [0.2, 0.4]. Educational text about impulse forces and momentum
- [ ] T027 [US5] Extend src/renderer.ts with running animation — drawRunningFigure(ctx, ragdoll, phase) cycles leg/arm positions based on scroll progress to animate a running stride
- [ ] T028 [US5] Author src/scenes/03-the-climb.json — ragdoll climbs stack of text-block platforms (platform text mode), motor blend ramps for climbing pose, scroll range [0.4, 0.6]. Educational text about rigid body collisions and constraints
- [ ] T029 [US5] Add climbing pose motor targets in src/scene-interpreter.ts — define arm-reaching and leg-stepping joint angles for climbing animation, triggered by beat steps in climb scene JSON
- [ ] T030 [US5] Author src/scenes/04-the-lecture.json — ragdoll stands at left side in pointing pose (motor blend to pointing arm angles), text appears line-by-line on the right (line-by-line text mode), scroll range [0.6, 0.8]. Educational text about motor blend and pose targeting
- [ ] T031 [US5] Extend src/renderer.ts with pointing arm drawing — drawPointingArm(ctx, ragdoll, targetX, targetY) renders extended arm with finger pointing at text reveal position
- [ ] T032 [US5] Author src/scenes/05-the-celebration.json — ragdoll in victory pose (arms raised motor targets), particle-emitter actor spawns ~80 confetti particles, reflow text mode, scroll range [0.8, 1.0]. Educational text about particle systems and simulation
- [ ] T033 [US5] Implement particle rendering in src/renderer.ts — drawParticles(ctx, particles[]) renders colored circles/rectangles with rotation, called from render() when particles exist in active scene
- [ ] T034 [US5] Implement particle spawning in src/scene-interpreter.ts — when particle-emitter actor activates, call createParticleBatch() from physics.ts to spawn confetti bodies in a region above the viewport with random initial velocities

**Checkpoint**: All 5 scenes render correctly with distinct interactions, educational narrative flows logically.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Camera behaviors, final integration, and build verification

- [ ] T035 [P] Implement camera/viewport transforms in src/renderer.ts — applyCamera(ctx, cameraConfig) applies translate/scale before drawing, restore after; called per-scene based on CameraConfig from JSON
- [ ] T036 [P] Add camera config to scene JSONs — update 02-the-kick.json (follow ragdoll), 03-the-climb.json (pan upward), 05-the-celebration.json (slight zoom out for confetti). Static camera for scenes 1 and 4
- [ ] T037 Update HUD in src/main.ts — show current scene name and number alongside FPS and progress
- [ ] T038 Run npm run build — verify clean TypeScript compilation and Vite production build with no errors
- [ ] T039 Visual QA — scroll through all 5 scenes, verify 60fps, transitions, text modes, progress indicator, reverse scrolling, and overall visual polish

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — proves the DSL works
- **US2 (Phase 4)**: Depends on Phase 2 — can run parallel with US1
- **US3 (Phase 5)**: Depends on Phase 2 — can run parallel with US1, US2
- **US4 (Phase 6)**: Depends on Phase 2 — can run parallel with US1-3
- **US5 (Phase 7)**: Depends on US1 (for The Fall JSON pattern), US3 (dynamic bodies), US4 (text modes)
- **Polish (Phase 8)**: Depends on all user stories

### User Story Dependencies

- **US1 (DSL)**: Foundation only — MVP, proves JSON-driven scenes work
- **US2 (Multi-scene)**: Foundation only — adds scroll journey + transitions + progress
- **US3 (Dynamic bodies)**: Foundation only — adds body lifecycle management
- **US4 (Text modes)**: Foundation only — adds scatter, platform, line-by-line modes
- **US5 (Demo scenes)**: Depends on US1 + US3 + US4 — needs DSL proven, dynamic bodies, and all text modes

### Parallel Opportunities

- T021, T022, T023 can run in parallel (different text modes, different functions)
- T035, T036 can run in parallel (different files)
- US1, US2, US3, US4 can all start after Phase 2 completes

---

## Parallel Example: User Story 4

```bash
# Launch all text mode implementations together (different functions, no dependencies):
Task: "Implement text scatter mode in src/pretext-layout.ts"
Task: "Implement text platform mode in src/pretext-layout.ts"
Task: "Implement text line-by-line reveal mode in src/pretext-layout.ts"
```

## Parallel Example: User Story 5

```bash
# After text modes are ready, author scene JSONs in parallel:
Task: "Author src/scenes/02-the-kick.json"
Task: "Author src/scenes/03-the-climb.json"
Task: "Author src/scenes/04-the-lecture.json"
Task: "Author src/scenes/05-the-celebration.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T006)
3. Complete Phase 3: User Story 1 — The Fall via DSL (T007-T010)
4. **STOP and VALIDATE**: Verify The Fall works identically from JSON
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Scene interpreter ready
2. Add US1 (The Fall DSL) → Test independently → Validates DSL approach
3. Add US2 (Multi-scene) + US3 (Dynamic bodies) → Scroll journey works
4. Add US4 (Text modes) → All interaction types available
5. Add US5 (5 Demo scenes) → Complete experience
6. Polish → Camera, HUD, build verification

---

## Notes

- [P] tasks = different files/functions, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- The Fall scene (US1) is the critical MVP — proves the entire DSL approach works
- Scene JSON files should tell a cohesive educational story about physics simulation
