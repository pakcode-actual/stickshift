# Data Model: Scene DSL + Multi-Scene Scroll Experience

**Date**: 2026-04-02 | **Feature**: 002-scene-dsl-multiscene

## Entities

### SceneBeat

The root entity describing a single scene in the scrollytelling experience.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique scene identifier (e.g., "the-fall") |
| title | string | Human-readable scene name |
| order | number | Position in the scroll sequence (1-based) |
| scrollRange | [number, number] | Start and end progress values (0-1) within the global scroll journey |
| transitionIn | TransitionConfig | How this scene enters (from previous scene) |
| transitionOut | TransitionConfig | How this scene exits (to next scene) |
| actors | Actor[] | Physics-driven entities in this scene |
| text | TextConfig | Text content and interaction mode |
| camera | CameraConfig | Viewport behavior for this scene |
| physics | PhysicsConfig | Scene-level physics overrides |
| beats | BeatStep[] | Scroll-driven sub-steps within this scene |

### Actor

A physics-driven entity: either the ragdoll stick figure or a prop.

| Field | Type | Description |
|-------|------|-------------|
| type | "ragdoll" \| "prop" \| "particle-emitter" | Actor category |
| id | string | Unique actor identifier within the scene |
| propType | "beach-ball" \| "box" \| "platform" \| "confetti" | (props only) What kind of prop |
| position | [number, number] | Initial position (x, y) in scene coordinates |
| velocity | [number, number] | Initial velocity (optional) |
| count | number | (particle-emitter only) Number of particles to spawn |
| physics | ActorPhysicsConfig | Per-actor physics overrides |

### ActorPhysicsConfig

Physics parameters for a specific actor.

| Field | Type | Description |
|-------|------|-------------|
| friction | number | Coulomb friction coefficient |
| restitution | number | Bounciness (0 = no bounce, 1 = perfect bounce) |
| density | number | Mass density |
| damping | number | Linear damping |
| angularDamping | number | Angular damping |
| gravityScale | number | Per-body gravity multiplier |

### BeatStep

A scroll-driven sub-step within a scene — maps a scroll sub-range to an action.

| Field | Type | Description |
|-------|------|-------------|
| scrollRange | [number, number] | Start and end within the scene's local progress (0-1) |
| action | string | Action identifier (e.g., "drop", "go-limp", "stand-up", "kick", "launch-ball") |
| target | string | Actor ID this action applies to |
| motorBlend | number | (ragdoll actions) Target motor blend value (0 = limp, 1 = full strength) |
| impulse | [number, number] | (impulse actions) Force vector to apply |
| pose | string | (ragdoll actions) Named pose target (e.g., "standing", "pointing", "victory") |
| easing | string | Easing function for transitions (e.g., "linear", "ease-in-out") |

### TextConfig

Text content and interaction configuration for a scene.

| Field | Type | Description |
|-------|------|-------------|
| content | string | The text content to display |
| mode | "reflow" \| "scatter" \| "platform" \| "line-by-line" | How text interacts with physics |
| platformBlocks | string[] | (platform mode) Text strings that become physics platforms |

### CameraConfig

Viewport behavior for a scene.

| Field | Type | Description |
|-------|------|-------------|
| type | "static" \| "follow" \| "pan" \| "zoom" | Camera behavior mode |
| target | string | (follow mode) Actor ID to track |
| offset | [number, number] | Camera offset from target or origin |
| scale | number | Zoom level (1 = normal) |

### PhysicsConfig

Scene-level physics overrides.

| Field | Type | Description |
|-------|------|-------------|
| gravity | [number, number] | Gravity vector override (default: [0, 980]) |

### TransitionConfig

How a scene transitions in or out.

| Field | Type | Description |
|-------|------|-------------|
| type | "crossfade" \| "slide" \| "cut" \| "physics" | Transition visual style |
| duration | number | Transition duration as fraction of scene scroll range (0-0.2) |

## Relationships

```
SceneBeat 1──* Actor          (a scene contains multiple actors)
SceneBeat 1──* BeatStep       (a scene has ordered scroll sub-steps)
SceneBeat 1──1 TextConfig     (a scene has one text configuration)
SceneBeat 1──1 CameraConfig   (a scene has one camera setup)
SceneBeat 1──1 PhysicsConfig  (a scene has optional physics overrides)
BeatStep  *──1 Actor          (a beat step targets an actor by ID)
```

## State Transitions

### Scene Lifecycle

```
UNLOADED → LOADING → ACTIVE → TRANSITIONING_OUT → UNLOADED
                       ↑                              │
                       └──────────────────────────────┘
                         (reverse scroll re-entry)
```

- **UNLOADED**: No physics bodies exist for this scene. No rendering.
- **LOADING**: Physics bodies being created. Transition-in animation starting.
- **ACTIVE**: Physics simulation running. Beat steps executing based on scroll progress.
- **TRANSITIONING_OUT**: Physics stopped. Visual crossfade to next scene. Bodies queued for destruction.

### Beat Step Execution

Within an ACTIVE scene, beat steps execute based on local scroll progress:

```
For each BeatStep in scene.beats (sorted by scrollRange[0]):
  if localProgress >= step.scrollRange[0] && localProgress <= step.scrollRange[1]:
    execute(step)  // Apply motor blend, impulse, pose change, etc.
```

Reverse scrolling re-evaluates all steps — steps with `scrollRange[1] < localProgress` are reverted to their pre-step state.

## Validation Rules

- Scene `scrollRange` values must be monotonically increasing across scenes (no overlap except transition zones)
- Actor IDs must be unique within a scene
- BeatStep `target` must reference a valid actor ID in the same scene
- `motorBlend` values must be in range [0, 1]
- `scrollRange` start must be less than end
- At most one actor of type "ragdoll" per scene (reuses the shared ragdoll instance)
- `transitionIn.duration + transitionOut.duration` must not exceed 40% of scene scroll range
