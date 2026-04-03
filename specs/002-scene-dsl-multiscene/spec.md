# Feature Specification: Scene DSL + Multi-Scene Scroll Experience

**Feature Branch**: `002-scene-dsl-multiscene`
**Created**: 2026-04-02
**Status**: Draft
**Input**: User description: "Phase 2: Scene DSL + Multi-Scene Scroll Experience — evolve from a single hardcoded scene into a multi-scene scrollytelling experience driven by a Scene Beat DSL (JSON format)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scene Beat DSL Defines Physics Animations Declaratively (Priority: P1)

A content creator defines a physics-based animation scene by writing a JSON file that describes actors, their poses, physics parameters, text content, and scroll trigger points. The system reads this JSON and produces a fully interactive, scroll-driven physics scene without any code changes.

**Why this priority**: The DSL is the foundation — every other feature depends on the ability to declaratively describe scenes. Without it, scenes remain hardcoded.

**Independent Test**: Create a single scene JSON file describing a stick figure falling through text. Load it in the browser and verify the scene plays correctly when scrolling — delivers the same experience as the Phase 1 hardcoded scene, but driven entirely from JSON.

**Acceptance Scenarios**:

1. **Given** a valid scene beat JSON file, **When** the application loads, **Then** the described actors, physics parameters, and text content are instantiated correctly in the viewport.
2. **Given** a scene JSON specifying gravity override and restitution values, **When** the scene is active, **Then** physics bodies behave according to the specified parameters (not global defaults).
3. **Given** a scene JSON with motor blend targets for the ragdoll, **When** the scroll reaches the specified trigger point, **Then** the ragdoll transitions to the target pose over the specified duration.

---

### User Story 2 - Multi-Scene Scroll Journey (Priority: P1)

A visitor scrolls through a webpage and experiences five distinct physics-driven scenes in sequence. Each scene occupies a scroll range, and transitions between scenes are smooth. A progress indicator shows which scene the visitor is currently viewing.

**Why this priority**: The multi-scene scroll experience is the core deliverable — it transforms a single-scene demo into a complete scrollytelling product.

**Independent Test**: Load the page with all five scene JSON files. Scroll from top to bottom and verify each scene activates at its designated scroll range, transitions are smooth, and the progress indicator updates correctly.

**Acceptance Scenarios**:

1. **Given** five scene JSON files configured in sequence, **When** the user scrolls through the page, **Then** each scene activates within its designated scroll range (~2 screen heights each, ~10 total).
2. **Given** the user is scrolling between two scenes, **When** the scroll position enters a transition zone, **Then** the outgoing scene fades/slides out and the incoming scene fades/slides in smoothly.
3. **Given** the user is viewing any scene, **When** they look at the progress indicator, **Then** it correctly highlights which of the five scenes is currently active.
4. **Given** the user scrolls backward, **When** a previous scene's scroll range is re-entered, **Then** that scene reactivates correctly with proper state.

---

### User Story 3 - Dynamic Physics Body Management (Priority: P1)

The scene interpreter creates and destroys physics bodies (props like beach balls, boxes, confetti particles) dynamically as scenes activate and deactivate, without memory leaks or physics simulation errors.

**Why this priority**: Dynamic body management is essential for multi-scene — without it, all physics objects from all scenes would exist simultaneously, causing performance issues and visual chaos.

**Independent Test**: Load scenes that create props (beach balls, confetti). Activate and deactivate scenes by scrolling. Verify that physics bodies are created on scene entry and cleaned up on scene exit, with stable frame rates throughout.

**Acceptance Scenarios**:

1. **Given** a scene JSON that specifies props (beach ball, boxes), **When** the scene activates, **Then** corresponding physics bodies are created with the specified properties.
2. **Given** an active scene with physics bodies, **When** the user scrolls past that scene, **Then** all physics bodies created by that scene are destroyed and memory is reclaimed.
3. **Given** rapid scrolling through multiple scenes, **When** scenes activate and deactivate quickly, **Then** no orphaned physics bodies remain and frame rate stays above 60fps.

---

### User Story 4 - Text-Physics Interaction Modes (Priority: P2)

Different scenes demonstrate different ways that physics actors interact with on-screen text: text reflows around actors, text scatters on impact, text blocks serve as physics platforms, and text appears line-by-line in sync with actor gestures.

**Why this priority**: Text interaction variety is what makes each scene visually distinct and tells the educational story, but the core infrastructure (DSL + interpreter + multi-scene) must work first.

**Independent Test**: Load each scene individually and verify that text behaves according to the interaction mode specified in the JSON: reflow, scatter, platform, or line-by-line reveal.

**Acceptance Scenarios**:

1. **Given** a scene with text interaction mode "reflow", **When** an actor moves near text, **Then** the text reflows around the actor's bounding area.
2. **Given** a scene with text interaction mode "scatter", **When** a physics object impacts text, **Then** individual words scatter outward from the impact point.
3. **Given** a scene with text interaction mode "platform", **When** text blocks are rendered, **Then** they serve as solid physics platforms that actors can stand on and climb.
4. **Given** a scene with text interaction mode "line-by-line", **When** the scroll progresses through the scene, **Then** text lines appear one at a time in sync with the actor's pointing gesture.

---

### User Story 5 - Five Cohesive Demo Scenes (Priority: P2)

The five demo scenes tell a cohesive educational mini-story about physics simulation, progressing from basic (falling) through intermediate (kicking, climbing) to advanced (presenting, celebrating). Each scene demonstrates a distinct physics interaction pattern.

**Why this priority**: The demo scenes are the showcase content. They depend on all infrastructure (DSL, interpreter, text modes) being in place, but are essential for demonstrating the system's capabilities.

**Independent Test**: Scroll through all five scenes end-to-end. Verify each scene has distinct visual behavior, the narrative flow makes sense as an educational progression, and all scenes render correctly.

**Acceptance Scenarios**:

1. **Given** Scene 1 "The Fall", **When** activated, **Then** a stick figure falls through text, ragdolls on landing, and stands back up — demonstrating gravity and collision.
2. **Given** Scene 2 "The Kick", **When** activated, **Then** a stick figure runs across screen, jump-kicks a beach ball, and the ball flies through text pushing words aside — demonstrating impulse forces.
3. **Given** Scene 3 "The Climb", **When** activated, **Then** a stick figure climbs up a stack of text-block platforms — demonstrating rigid body interactions and active ragdoll motor control.
4. **Given** Scene 4 "The Lecture", **When** activated, **Then** a stick figure stands at the side pointing at text that appears line-by-line — demonstrating motor blend pose targeting.
5. **Given** Scene 5 "The Celebration", **When** activated, **Then** a stick figure does a victory pose while confetti particles rain down through text — demonstrating particle effects.

---

### Edge Cases

- What happens when the browser is resized mid-scene? Scenes should adapt to new viewport dimensions.
- What happens when the user scrolls extremely fast through multiple scenes? Physics cleanup must remain robust.
- What happens if a scene JSON file is malformed? The system should skip the invalid scene and continue with remaining scenes, logging an error.
- What happens on mobile/touch devices with momentum scrolling? Scroll trigger calculations should handle non-linear scroll velocities.
- What happens if the physics WASM module hasn't loaded yet when a scene activates? The scene should wait for physics initialization before starting.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define a Scene Beat JSON schema that declaratively describes actors, physics parameters, motor blend targets, text content, scroll triggers, camera behavior, and text interaction modes.
- **FR-002**: System MUST provide a scene interpreter that reads Scene Beat JSON files and instantiates corresponding physics simulations, actors, and text layouts at runtime.
- **FR-003**: System MUST support dynamic creation and destruction of physics bodies (stick figures, props, particles) as scenes activate and deactivate during scrolling.
- **FR-004**: System MUST bind each scene to a specific scroll progress range and activate/deactivate scenes based on current scroll position.
- **FR-005**: System MUST support smooth transitions between scenes (crossfade, slide, or physics-driven) as the user scrolls between scene boundaries.
- **FR-006**: System MUST support four text interaction modes: reflow around actors, scatter on impact, text-as-physics-platforms, and line-by-line reveal.
- **FR-007**: System MUST render a progress indicator showing the current active scene within the multi-scene scroll journey.
- **FR-008**: System MUST support motor blend target transitions — ramping ragdoll poses from one target to another over a specified scroll range or duration.
- **FR-009**: System MUST support particle effects (confetti) that interact with both physics simulation and text layout.
- **FR-010**: System MUST support camera/viewport behaviors per scene: follow actor, pan, and zoom.
- **FR-011**: System MUST deliver five complete demo scenes: The Fall, The Kick, The Climb, The Lecture, The Celebration.
- **FR-012**: System MUST maintain 60fps rendering with any single scene active and all its physics bodies simulated.
- **FR-013**: System MUST handle reverse scrolling correctly, reactivating previous scenes with proper initial state.
- **FR-014**: System MUST pin the viewport during the scroll journey (entire experience is within a pinned scroll container spanning ~10 screen heights).

### Key Entities

- **Scene Beat**: A declarative description of a single animation scene — includes actors, physics config, text content, scroll range, camera behavior, and text interaction mode.
- **Actor**: A physics-driven entity within a scene — either a ragdoll stick figure with motor blend targets or a prop (beach ball, box, confetti particle).
- **Text Interaction Mode**: The rule governing how text responds to physics actors — one of: reflow, scatter, platform, line-by-line.
- **Scene Transition**: The visual and physics behavior that occurs between two adjacent scenes during scrolling — crossfade, slide, or physics-driven.
- **Progress Indicator**: A UI element showing the user's position within the multi-scene scroll journey.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All five demo scenes render correctly and are navigable via scrolling in a single continuous experience spanning ~10 screen heights.
- **SC-002**: Animation maintains 60fps throughout the scroll journey on a mid-range device (e.g., 2020-era laptop).
- **SC-003**: Scene transitions complete within 0.3 seconds of scroll threshold crossing, with no visual glitches or physics artifacts.
- **SC-004**: Each of the four text interaction modes (reflow, scatter, platform, line-by-line) is visually distinguishable and functions correctly in its designated scene.
- **SC-005**: The existing Phase 1 scene (The Fall) functions identically when refactored to use the DSL — no regression in behavior or visual quality.
- **SC-006**: A new scene can be added to the experience by creating a single JSON file — no code changes required to add a 6th scene.
- **SC-007**: The progress indicator correctly reflects the active scene at all scroll positions, including during transitions and reverse scrolling.
- **SC-008**: No memory leaks when scrolling through all scenes repeatedly — physics body count returns to baseline after each scene deactivation.

## Assumptions

- Phase 1 modules (physics.ts, renderer.ts, pretext-layout.ts, scene.ts) are stable and working — this phase extends rather than replaces them.
- The target audience views on desktop browsers with modern GPU acceleration; mobile optimization is out of scope for this phase.
- Scene JSON files are bundled with the application (loaded via Vite's static import or fetch), not fetched from a remote API.
- The educational narrative content (actual text paragraphs for each scene) will be placeholder/lorem ipsum quality — production copy is out of scope.
- The existing stick figure renderer and ragdoll physics from Phase 1 provide the base actor rendering — new scenes reuse and extend this.
- Particle effects (confetti) are simple circle/rectangle shapes — no complex sprite-based particles needed.
- Camera/viewport behaviors are 2D transformations (translate, scale) applied to the canvas — no 3D perspective effects.
