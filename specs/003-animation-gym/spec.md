# Feature Specification: Isolated Animation Test Environments (Animation Gym)

**Feature Branch**: `003-animation-gym`
**Created**: 2026-04-02
**Status**: Draft
**Input**: User description: "Create an Isolated Animation Sandbox (Animation Gym) - a dedicated route-separated testing environment for individual Scene Beat DSL animations with timeline scrubbing, joint motor controls, and debug overlays"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Load and Play Back a Single Animation Beat (Priority: P1)

A developer working on ragdoll animations navigates to the sandbox route and loads a Scene Beat JSON file. The animation plays back on loop, completely independent of scroll position or text reflow. The developer can observe the ragdoll behavior in isolation to verify the animation looks correct before integrating it into the full scrollytelling scene.

**Why this priority**: This is the foundational capability — without isolated playback, none of the other debugging or tuning features have context. It delivers immediate value by decoupling animation development from the full scene complexity.

**Independent Test**: Can be fully tested by navigating to the sandbox route, selecting a beat JSON file, and observing looped playback. Delivers value by confirming animation behavior without scroll dependencies.

**Acceptance Scenarios**:

1. **Given** a developer has a valid Scene Beat JSON file, **When** they load it into the sandbox, **Then** the animation plays back on a continuous loop without requiring scroll input.
2. **Given** a beat is loaded in the sandbox, **When** the animation reaches the end of its timeline, **Then** it seamlessly loops back to the beginning.
3. **Given** the sandbox is open, **When** no beat file is loaded, **Then** the sandbox displays an empty canvas with instructions on how to load a beat.

---

### User Story 2 - Frame-by-Frame Playback Control (Priority: P1)

A developer investigating a specific moment in an animation uses play/pause and frame-step controls to freeze the physics simulation at any point. They can advance one physics step at a time to observe exactly how the ragdoll transitions between poses, identifying where undesired behavior occurs.

**Why this priority**: Frame-level control is essential for debugging physics issues. Without it, fast-moving animations are impossible to diagnose. Co-equal with playback as core sandbox functionality.

**Independent Test**: Can be tested by loading any beat, pausing playback, and stepping forward frame-by-frame. Delivers value by enabling precise observation of physics behavior at any simulation step.

**Acceptance Scenarios**:

1. **Given** an animation is playing, **When** the developer clicks Pause, **Then** the simulation freezes at the current physics step.
2. **Given** the simulation is paused, **When** the developer clicks Step, **Then** the simulation advances exactly one physics step and re-renders.
3. **Given** the simulation is paused, **When** the developer drags the timeline scrubber to a specific point, **Then** the simulation jumps to that frame and displays the corresponding state.

---

### User Story 3 - Real-Time Joint Motor Tuning (Priority: P2)

A developer adjusting ragdoll behavior uses on-screen controls to modify joint motor parameters (stiffness, damping, target angles) while the animation plays. Changes apply immediately so the developer can see the effect in real time, eliminating the need to edit JSON files and reload.

**Why this priority**: Real-time tuning dramatically accelerates the animation development workflow but depends on playback (P1) being functional first. High value for iteration speed.

**Independent Test**: Can be tested by loading a beat, adjusting a joint motor parameter via the UI controls, and observing the ragdoll behavior change in real time. Delivers value by enabling rapid parameter iteration.

**Acceptance Scenarios**:

1. **Given** a beat is loaded and playing, **When** the developer adjusts a joint's stiffness slider, **Then** the ragdoll's behavior updates immediately to reflect the new stiffness value.
2. **Given** the developer has tuned parameters in the sandbox, **When** those same parameter values are applied to the Scene Beat JSON, **Then** the animation behaves identically in the main scrollytelling scene.
3. **Given** multiple joints exist on the ragdoll, **When** the developer selects a specific joint, **Then** only that joint's motor parameters are displayed for editing.

---

### User Story 4 - Visual Debug Overlays (Priority: P2)

A developer diagnosing pose-tracking issues toggles on a debug overlay that renders both the target kinematic skeleton (the desired pose) and the physical ragdoll simultaneously. This visual comparison reveals where and why the ragdoll deviates from the intended animation.

**Why this priority**: Debug overlays provide critical diagnostic information for understanding ragdoll-to-skeleton divergence, but the sandbox is still useful for basic work without them.

**Independent Test**: Can be tested by loading a beat, toggling the debug overlay on, and visually comparing the target skeleton wireframe against the physical ragdoll. Delivers value by making pose deviation visible at a glance.

**Acceptance Scenarios**:

1. **Given** a beat is loaded, **When** the developer enables the debug overlay, **Then** both the target kinematic skeleton and the physical ragdoll are rendered simultaneously with visually distinct styles.
2. **Given** the debug overlay is active, **When** the developer views a specific joint, **Then** the target angle and actual angle for that joint are displayed numerically.
3. **Given** the debug overlay is active, **When** the developer toggles it off, **Then** only the standard ragdoll rendering is visible.

---

### Edge Cases

- What happens when an invalid or malformed Scene Beat JSON file is loaded? The sandbox displays a clear error message identifying the problem and does not crash.
- What happens when a beat references body parts or joints not present in the current ragdoll definition? The sandbox loads what it can and warns about missing references.
- What happens when joint motor parameters are set to extreme values (e.g., zero stiffness, maximum damping)? The simulation continues running without crashing; the ragdoll may go limp or lock up but recovers when parameters are adjusted back.
- What happens when the timeline scrubber is dragged rapidly back and forth? The simulation re-computes state for the target frame without accumulated drift or errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated sandbox route (`/sandbox`) separate from the main scrollytelling experience.
- **FR-002**: System MUST allow loading of individual Scene Beat JSON files into the sandbox for isolated playback.
- **FR-003**: System MUST play back loaded beat animations on a continuous loop without requiring scroll input or text reflow.
- **FR-004**: System MUST provide Play, Pause, and Step-frame playback controls.
- **FR-005**: System MUST provide a timeline scrubber that allows seeking to any point in the animation timeline.
- **FR-006**: System MUST expose controls for adjusting joint motor stiffness, damping, and target angle parameters in real time.
- **FR-007**: System MUST apply parameter changes immediately to the running simulation without requiring a reload.
- **FR-008**: System MUST provide a toggle for a debug overlay that renders the target kinematic skeleton alongside the physical ragdoll.
- **FR-009**: System MUST display per-joint target angle vs. actual angle data when the debug overlay is active.
- **FR-010**: System MUST use the same physics engine configuration and scene logic as the main scrollytelling mode, ensuring parameter parity between sandbox and production.
- **FR-011**: System MUST display a clear error message when an invalid Scene Beat JSON is loaded.
- **FR-012**: System MUST provide a Rapier debug rendering toggle to visualize physics colliders and constraints.

### Key Entities

- **Scene Beat**: A JSON-defined animation segment specifying ragdoll pose targets, timing, and motor parameters. The atomic unit loaded into the sandbox.
- **Joint Motor Configuration**: A set of parameters (stiffness, damping, target angle) that control how a ragdoll joint tracks its target pose. Editable in real time within the sandbox.
- **Debug Overlay**: A visual layer rendering the target kinematic skeleton and per-joint angle data, toggled independently of the main scene rendering.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can load any valid Scene Beat JSON and see it playing back in the sandbox within 3 seconds of selection.
- **SC-002**: Frame-stepping advances the simulation by exactly one physics step per click, with the rendered state matching the simulation state.
- **SC-003**: Parameter changes made in the sandbox produce identical ragdoll behavior when the same values are applied to the main scrollytelling scene.
- **SC-004**: The debug overlay clearly distinguishes target skeleton from physical ragdoll, with per-joint angle deviation visible at a glance.
- **SC-005**: Developers can complete a full tune-test-observe cycle for a single joint parameter in under 10 seconds (vs. editing JSON and reloading).

## Assumptions

- The existing Scene Beat DSL and JSON format from the scrollytelling implementation will be reused as-is; no changes to the beat schema are required.
- The sandbox is a developer-facing tool, not an end-user feature; polish and accessibility standards are secondary to functionality.
- Only one beat is loaded and played at a time in the sandbox (multi-beat sequencing is out of scope for v1).
- The ragdoll definition (body parts, joints, dimensions) is shared with the main scene and does not need to be independently configured in the sandbox.
- The sandbox runs in the same Vite development environment as the main application.
- Timeline scrubbing re-simulates from the beginning to the target frame (deterministic replay) rather than requiring snapshot/restore of physics state.
