# Feature Specification: Ragdoll Scrollytelling POC

**Feature Branch**: `001-ragdoll-scrollytelling-poc`
**Created**: 2026-04-02
**Status**: Draft
**Input**: User description: "Phase 1 proof-of-concept for an AI-powered educational scrollytelling platform combining Rapier.js physics, Pretext text reflow, Canvas+DOM hybrid rendering, and GSAP ScrollTrigger."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scroll-Triggered Ragdoll Physics Demo (Priority: P1)

A visitor opens the page and sees a tall scrollable document with educational
text about physics and animation. As they scroll down, the scene pins in the
viewport and a stick figure character falls from above, crashing through the
text. The text reflows in real-time around each body part as the figure tumbles.
The figure hits the ground, goes fully ragdoll on impact, then gradually stands
back up using active ragdoll motor recovery. The animation feels smooth and
responsive to scroll position.

**Why this priority**: This is the core proof-of-concept. Without the ragdoll
falling through reflowing text, there is no demo. Every other story builds on
this foundation.

**Independent Test**: Can be fully tested by scrolling the page and observing
the stick figure fall, ragdoll, and stand up while text reflows around each
body part. Delivers the full visual impact of the POC.

**Acceptance Scenarios**:

1. **Given** the page is loaded and scroll is at the top, **When** the user
   scrolls to the scene trigger point, **Then** the scene pins and the stick
   figure begins falling from above the viewport.
2. **Given** the stick figure is falling, **When** body parts pass through
   text regions, **Then** text reflows around each body part in real-time
   with no visible lag.
3. **Given** the figure hits the ground, **When** impact occurs, **Then**
   joint motors release (torque drops to zero) and the figure ragdolls
   naturally.
4. **Given** the figure is ragdolled on the ground, **When** the recovery
   phase begins, **Then** joint motors gradually ramp torque back up and the
   figure returns to a standing pose.
5. **Given** the animation is playing, **When** the user observes the frame
   rate, **Then** the animation runs at 60fps without stutter on mid-range
   hardware.

---

### User Story 2 - Beach Ball Bouncing Through Text (Priority: P2)

A colorful beach ball bounces through the scene alongside the stick figure. The
ball interacts with the ground, the stick figure's body parts, and the text
reflows around the ball just as it does around the ragdoll limbs. This adds
visual variety and demonstrates that the text reflow system works with arbitrary
physics objects, not just the stick figure.

**Why this priority**: Demonstrates the generality of the physics-to-text-reflow
pipeline. Without it, the POC only shows one type of object. The ball adds
visual delight and proves architectural flexibility.

**Independent Test**: Can be tested by observing the beach ball bounce, collide
with the ground and stick figure, and verifying that text reflows around the
ball's position each frame.

**Acceptance Scenarios**:

1. **Given** the scene is active, **When** the beach ball enters the viewport,
   **Then** it bounces with realistic physics (gravity, restitution).
2. **Given** the ball is moving through a text region, **When** its position
   updates each frame, **Then** surrounding text reflows around the ball in
   real-time.
3. **Given** the ball and stick figure are in the same area, **When** they
   collide, **Then** both respond with plausible physics.

---

### User Story 3 - Accessible Educational Text Content (Priority: P3)

The educational text about physics and animation is rendered as selectable,
readable DOM elements. A visitor can select text with their mouse, copy it,
and paste it elsewhere. Screen readers can read the text content. The text
remains legible and properly contrasted against the dark background throughout
the animation, even while reflowing around physics objects.

**Why this priority**: Accessibility is a core principle but is lower priority
for the POC phase because the visual demo must work first. However, the
architecture must support this from day one (DOM spans, not canvas text).

**Independent Test**: Can be tested by selecting text with a mouse, copying to
clipboard, and verifying it pastes correctly. Can also be tested with a screen
reader to verify content is announced. Verify color contrast meets WCAG AA.

**Acceptance Scenarios**:

1. **Given** text is displayed on the page, **When** the user selects text
   with their mouse, **Then** the text highlights and can be copied to clipboard.
2. **Given** text is reflowing around physics objects, **When** a screen reader
   traverses the page, **Then** all educational text content is announced.
3. **Given** the dark background (#0a0a0a) and light gray text, **When** color
   contrast is measured, **Then** it meets WCAG AA (4.5:1 ratio).

---

### Edge Cases

- What happens when the browser window is resized during animation?
  The scene container recalculates dimensions; physics world bounds and text
  layout region update accordingly on next frame.
- What happens when scroll velocity is very fast (flick scroll)?
  Animation progress clamps to valid range; physics steps interpolate rather
  than skipping large time deltas.
- What happens when the page is loaded on a device that cannot run WASM?
  The text content remains visible and readable as static DOM elements;
  the canvas animation simply does not play (progressive enhancement).
- What happens when the stick figure lands partially off-screen?
  Ground collider spans the full scene width; the figure cannot fall out
  of bounds horizontally.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render a stick figure composed of 8-12 rigid body
  segments (head, torso, upper/lower arms x2, upper/lower legs x2) connected
  by joints with angular limits.
- **FR-002**: System MUST simulate the stick figure falling under gravity from
  above the visible scene area.
- **FR-003**: System MUST transition joint motors from pose-tracking mode
  (high torque) to ragdoll mode (zero torque) on ground impact.
- **FR-004**: System MUST ramp joint motor torque back up after impact to
  animate the figure standing up (active ragdoll recovery).
- **FR-005**: System MUST reflow text around physics body positions each
  frame, carving rectangular exclusion zones around each body part.
- **FR-006**: System MUST render text as positioned DOM `<span>` elements,
  not as canvas-drawn text.
- **FR-007**: System MUST render stick figure visuals on a `<canvas>` element
  overlaid on the DOM text container.
- **FR-008**: System MUST pin the scene in the viewport during animation
  using scroll-driven triggering.
- **FR-009**: System MUST simulate a beach ball with circular collision that
  bounces through the scene and interacts with the ground and stick figure.
- **FR-010**: System MUST reflow text around the beach ball using the same
  mechanism as the stick figure body parts.
- **FR-011**: System MUST maintain 60fps animation on mid-range hardware
  (2020 MacBook Air equivalent).
- **FR-012**: System MUST use a dark background (#0a0a0a), white stick figure
  lines, colorful beach ball, and light gray text with the Inter font.
- **FR-013**: System MUST render a visible ground line at the bottom of the
  scene area.

### Key Entities

- **Stick Figure**: A composite physics body of 8-12 rigid segments connected
  by motorized revolute joints. Key attributes: segment positions/rotations,
  joint motor torque blend (0.0 = ragdoll, 1.0 = pose tracking), animation
  phase (falling, impact, ragdoll, recovery, standing).
- **Beach Ball**: A circular rigid body with high restitution (bouncy). Key
  attributes: position, radius, velocity, color.
- **Text Region**: A block of educational content about physics/animation,
  laid out as DOM spans. Key attributes: content string, layout bounds,
  exclusion zones (carved slots from physics body positions).
- **Scene**: The orchestrating container that manages animation phases, scroll
  position mapping, and coordinates physics, rendering, and text layout.
  Key attributes: scroll progress (0-1), current phase, pinned state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Animation maintains 60fps (no frame exceeds 16.67ms) on a
  mid-range laptop during the full demo sequence.
- **SC-002**: Text visibly reflows around physics objects within the same
  frame as the object moves — no perceptible one-frame lag.
- **SC-003**: All educational text on the page is selectable via mouse and
  copyable to clipboard.
- **SC-004**: The stick figure transitions from falling to ragdoll to standing
  in a visually smooth sequence with no teleporting or joint explosions.
- **SC-005**: The beach ball bounces at least 3 times and collides with at
  least one stick figure body part during the demo.
- **SC-006**: The page scrolls smoothly with the scene pinning and unpinning
  at the correct scroll positions.
- **SC-007**: Text color contrast against the background meets WCAG AA
  (4.5:1 minimum ratio).

## Assumptions

- Target audience is desktop/laptop users with modern browsers (Chrome, Firefox,
  Safari) that support WebAssembly.
- Mobile/tablet optimization is out of scope for Phase 1.
- The educational text content is placeholder/lorem-style content about physics
  and animation concepts; final content curation is out of scope.
- No server-side component is needed; the POC is a fully static client-side page.
- The "AI-powered" aspect of the broader platform is out of scope for Phase 1;
  this POC focuses on the physics + text reflow + scroll interaction foundation.
- Inter font is loaded from a CDN or bundled; font loading strategy details are
  left to implementation.
- The page height is sufficient for meaningful scroll interaction (at least 3x
  viewport height).
