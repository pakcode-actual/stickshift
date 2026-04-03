# Data Model: Animation Gym

**Branch**: `003-animation-gym` | **Date**: 2026-04-02

## Entities

### PlaybackState

Tracks the current state of sandbox playback.

| Field | Type | Description |
| ----- | ---- | ----------- |
| progress | number [0, 1] | Current normalized position in the beat timeline |
| frame | number | Current physics frame index (progress * totalFrames) |
| totalFrames | number | Total physics frames in the loaded beat |
| isPlaying | boolean | Whether playback is advancing automatically |
| playbackSpeed | number | Multiplier for playback speed (default 1.0) |
| looping | boolean | Whether playback loops at end (default true) |

### JointOverride

Runtime override of a single joint's motor parameters, applied on top of the beat's own motor settings.

| Field | Type | Description |
| ----- | ---- | ----------- |
| jointIndex | number | Index into ragdoll.joints array (0=neck, 1=shoulderL, etc.) |
| stiffness | number | Motor stiffness override (default: MOTOR_STIFFNESS = 600) |
| damping | number | Motor damping override (default: MOTOR_DAMPING = 60) |
| targetAngle | number | Target angle override in radians |

### DebugState

Controls which debug visualizations are active.

| Field | Type | Description |
| ----- | ---- | ----------- |
| showTargetSkeleton | boolean | Render target pose wireframe overlay |
| showAngleLabels | boolean | Display per-joint angle deviation text |
| showRapierDebug | boolean | Render Rapier colliders/joints/AABBs |

### SandboxSession

Top-level state for a sandbox session. Not persisted — lives only in memory during the session.

| Field | Type | Description |
| ----- | ---- | ----------- |
| loadedBeat | SceneBeat | null | The currently loaded Scene Beat (existing type from scene-types.ts) |
| playback | PlaybackState | Current playback state |
| jointOverrides | Map<number, JointOverride> | Per-joint parameter overrides keyed by joint index |
| debug | DebugState | Debug visualization toggles |
| selectedJoint | number | null | Currently selected joint for the tuning panel |

## Relationships

```
SandboxSession
├── loadedBeat: SceneBeat (existing entity from scene-types.ts)
│   ├── actors[]
│   ├── beats[] (BeatStep actions)
│   └── text, camera, physics config
├── playback: PlaybackState
├── debug: DebugState
├── jointOverrides: Map<jointIndex, JointOverride>
└── selectedJoint → jointIndex
```

## Existing Entities (unchanged)

These entities from `scene-types.ts` are reused as-is:

- **SceneBeat**: Root beat definition (id, title, scrollRange, actors, beats, text, camera, physics)
- **BeatStep**: Individual action within a beat (scrollRange, action, target, motorBlend, pose, impulse, easing)
- **Actor**: Entity in the scene (type, id, position, velocity, propType, physics config)

## State Transitions

### PlaybackState

```
STOPPED ──[load beat]──→ PAUSED ──[play]──→ PLAYING
   ↑                       ↑                   │
   │                       ├────[pause]────────┤
   │                       ├────[step]─────────┤ (advance 1 frame, stay paused)
   │                       └────[seek]─────────┤ (jump to frame, stay paused)
   └────[unload/new beat]──────────────────────┘
```

### DebugState

All toggles are independent booleans. No state machine — any combination is valid.
