# Tasks: Ragdoll Scrollytelling POC

**Input**: Design documents from `/specs/001-ragdoll-scrollytelling-poc/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Project initialization, build tooling, dependencies

- [x] T001 Initialize Vite + TypeScript project with package.json, tsconfig.json (strict: true), vite.config.ts
- [x] T002 Install dependencies: @dimforge/rapier2d-compat, @chenglou/pretext, gsap
- [x] T003 Create index.html with DOM structure: scene container, text container, canvas element, Inter font link, dark background styles
- [x] T004 [P] Create empty module files: src/physics.ts, src/renderer.ts, src/pretext-layout.ts, src/scene.ts, src/main.ts with exported type interfaces

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that ALL user stories depend on

- [x] T005 Implement Rapier WASM initialization and world creation in src/physics.ts — export `initPhysics()` returning World with gravity {x:0, y:9.81}, fixed timestep 1/60, ground collider spanning scene width
- [x] T006 Implement ragdoll body factory in src/physics.ts — export `createRagdoll(world, spawnPos)` that creates 10 rigid body segments (head circle, torso capsule, upper/lower arms x2, upper/lower legs x2) with ColliderDescs, connected by revolute joints with angular limits and motor config. Return typed RagdollBody handle with segment references and joint references
- [x] T007 Implement motor control API in src/physics.ts — export `setMotorStiffness(ragdoll, stiffness)` that sets all joint motors to `configureMotorPosition(restAngle, stiffness, damping)` where damping = stiffness * 0.3. Export `getBodyPositions(ragdoll)` returning array of {id, x, y, rotation, halfWidth, halfHeight} for all segments
- [x] T008 Implement canvas renderer in src/renderer.ts — export `initRenderer(canvas)` and `drawFrame(ctx, bodies, ball)` that draws stick figure as white lines (lineWidth 3, round caps) between joint positions, head as circle, and clears/redraws each frame on transparent background
- [x] T009 Implement Pretext text layout in src/pretext-layout.ts — export `initTextLayout(text, font)` calling prepareWithSegments() after document.fonts.ready, and `layoutFrame(prepared, containerWidth, lineHeight, exclusionZones)` that iterates layoutNextLine() with variable maxWidth per line based on AABB overlap with exclusion zones. Return LayoutLine[] with {text, x, y, width}
- [x] T010 Implement DOM text rendering in src/pretext-layout.ts — export `renderTextToDOM(container, lines)` that creates/reuses positioned `<span>` elements for each LayoutLine, setting style.transform for position, avoiding DOM thrash by pooling spans

**Checkpoint**: Physics world running, ragdoll spawnable, canvas drawing, text layout functional

---

## Phase 3: User Story 1 — Scroll-Triggered Ragdoll Physics Demo (Priority: P1)

**Goal**: Stick figure falls through reflowing text, ragdolls on impact, stands back up — all driven by scroll

**Independent Test**: Scroll the page and observe the full animation sequence: fall → impact → ragdoll → recovery → standing, with text reflowing around body parts throughout

### Implementation for User Story 1

- [x] T011 [US1] Implement scene phase state machine in src/scene.ts — export ScenePhase enum (IDLE, FALLING, IMPACT, RAGDOLL, RECOVERY, STANDING) and `advancePhase(current, world, ragdoll)` that detects ground contact for FALLING→IMPACT, checks motor release for IMPACT→RAGDOLL, uses timer for RAGDOLL→RECOVERY, checks pose convergence for RECOVERY→STANDING
- [x] T012 [US1] Implement scroll binding in src/scene.ts — export `initScene(container)` that creates GSAP ScrollTrigger with pin:true, scrub:true on the scene container. Map scroll progress 0→1 to scene phases. Pin duration = 3x viewport height for sufficient scroll range
- [x] T013 [US1] Implement animation loop in src/scene.ts — export `startLoop(world, ragdoll, renderer, textLayout)` using requestAnimationFrame. Each frame: step physics (fixed timestep accumulator), compute exclusion zones from body positions, run text layout, render text DOM spans, draw canvas frame. Track frame time for budget monitoring
- [x] T014 [US1] Implement active ragdoll transitions in src/scene.ts — on IMPACT: ramp motor stiffness from current value to 0 over 0.3s. On RECOVERY: ramp motor stiffness from 0 to 150 over 1.5s with easeOutQuad curve. Coordinate with advancePhase()
- [x] T015 [US1] Wire everything together in src/main.ts — await initPhysics(), await initTextLayout() with educational text content about physics/animation (~500 words), initRenderer(canvas), createRagdoll(world, spawnAboveViewport), initScene(container), startLoop(). Add educational text content as a const string
- [x] T016 [US1] Add ground line visual in src/renderer.ts — draw a horizontal line at ground collider Y position, light gray (#333), lineWidth 1

**Checkpoint**: Full ragdoll demo plays on scroll. Text reflows around falling/ragdolling body parts. Figure stands back up.

---

## Phase 4: User Story 2 — Beach Ball Bouncing Through Text (Priority: P2)

**Goal**: Colorful beach ball bounces through scene, collides with ground and ragdoll, text reflows around it

**Independent Test**: Observe beach ball entering scene, bouncing off ground, colliding with stick figure, and text reflowing around the ball

### Implementation for User Story 2

- [x] T017 [US2] Implement beach ball creation in src/physics.ts — export `createBall(world, spawnPos, radius)` that creates a dynamic RigidBody with ball ColliderDesc, high restitution (0.8), moderate density. Return BallBody handle with body reference
- [x] T018 [US2] Add beach ball rendering in src/renderer.ts — extend `drawFrame()` to accept optional ball parameter. Draw ball as filled circle with colorful gradient (red/blue/yellow/white segments like a beach ball), with a subtle shadow
- [x] T019 [US2] Integrate ball exclusion zone in src/pretext-layout.ts — extend `layoutFrame()` to accept ball position/radius alongside ragdoll body positions. Compute AABB from ball circle and include in exclusion zone checks
- [x] T020 [US2] Add ball to scene orchestration in src/scene.ts — spawn ball at scene start (slightly after ragdoll drop), add ball body positions to exclusion zone computation, pass ball to renderer. Ball enters from upper-right with slight horizontal velocity
- [x] T021 [US2] Update src/main.ts to create ball and pass to scene

**Checkpoint**: Beach ball bounces through scene, collides with ragdoll and ground, text reflows around it

---

## Phase 5: User Story 3 — Accessible Educational Text (Priority: P3)

**Goal**: All text is selectable, readable, screen-reader accessible, meets WCAG AA contrast

**Independent Test**: Select text with mouse, copy/paste it. Check contrast ratio. Test with screen reader.

### Implementation for User Story 3

- [x] T022 [US3] Ensure canvas has pointer-events:none in index.html/styles so text beneath is selectable
- [x] T023 [US3] Add aria-label to scene container and role="article" to text container in index.html for screen reader navigation
- [x] T024 [US3] Verify and adjust text color in src/pretext-layout.ts span styles — ensure light gray text (#c8c8c8 or lighter) on dark bg (#0a0a0a) meets WCAG AA 4.5:1 ratio. Add CSS user-select:text explicitly on text spans
- [x] T025 [US3] Add noscript fallback in index.html — display the educational text content as static paragraphs when JavaScript is disabled

**Checkpoint**: Text is selectable, copyable, screen-reader accessible, contrast meets WCAG AA

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Visual refinement and performance optimization

- [x] T026 [P] Add eased transitions for text reflow in src/pretext-layout.ts — lerp span positions between frames to smooth out jumpy reflow (alpha 0.3)
- [x] T027 [P] Add subtle canvas effects in src/renderer.ts — joint circles at connection points (small dots), slight glow on stick figure lines using shadowBlur
- [x] T028 [P] Performance optimization pass — verify no per-frame allocations in physics.ts hot path, pool exclusion zone arrays, batch DOM reads/writes in pretext-layout.ts
- [x] T029 Verify build: run `npm run build`, confirm dist/ output is clean and deployable

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 — core demo
- **User Story 2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1 but integrates with scene
- **User Story 3 (Phase 5)**: Depends on Phase 2 — can run in parallel with US1/US2
- **Polish (Phase 6)**: Depends on all user stories

### Within Each Phase

- T001 → T002 → T003, T004 (parallel)
- T005 → T006 → T007 (sequential: world → bodies → motors)
- T008, T009, T010 can run in parallel with each other (different files) after T005
- T011 → T012 → T013 → T014 → T015 → T016 (sequential scene build-up)
- T017 → T018, T019 (parallel) → T020 → T021
- T022, T023, T024, T025 (all parallel — different files/concerns)
- T026, T027, T028 (all parallel) → T029

### Parallel Opportunities

```bash
# Phase 2 parallel group (after T007):
T008: Canvas renderer (src/renderer.ts)
T009: Text layout (src/pretext-layout.ts)
T010: DOM rendering (src/pretext-layout.ts) — after T009

# Phase 5 all parallel:
T022: pointer-events (index.html)
T023: aria attributes (index.html)
T024: contrast check (src/pretext-layout.ts)
T025: noscript fallback (index.html)

# Phase 6 parallel:
T026: Reflow easing (src/pretext-layout.ts)
T027: Canvas effects (src/renderer.ts)
T028: Performance (multiple files)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Scroll page, observe full ragdoll sequence with text reflow
5. Deploy if ready — this alone is the core POC

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test ragdoll demo → MVP!
3. Add User Story 2 → Test beach ball → Enhanced demo
4. Add User Story 3 → Test accessibility → Accessible demo
5. Polish → Final quality pass

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Educational text content (~500 words about physics/animation) is authored in T015
- Rapier uses Y-down in screen space but gravity should point downward (positive Y)
- Pretext prepare() must wait for font loading (document.fonts.ready)
- Canvas must be resized to match container on init and window resize
