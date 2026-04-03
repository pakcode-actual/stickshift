# Data Model: Ragdoll Scrollytelling POC

## Entities

### RagdollConfig

Configuration for the stick figure ragdoll body.

| Field | Type | Description |
|-------|------|-------------|
| segments | SegmentDef[] | Array of body segment definitions |
| joints | JointDef[] | Array of joint definitions connecting segments |
| spawnPosition | { x: number, y: number } | Initial drop position (above scene) |

### SegmentDef

Definition for a single rigid body segment of the stick figure.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (e.g., "head", "torso", "upperArmL") |
| shape | "circle" \| "capsule" | Collision shape type |
| size | { radius: number } \| { halfHeight: number, radius: number } | Shape dimensions |
| offset | { x: number, y: number } | Local offset from ragdoll origin |
| density | number | Mass density |

### JointDef

Definition for a revolute joint connecting two segments.

| Field | Type | Description |
|-------|------|-------------|
| bodyA | string | ID of first segment |
| bodyB | string | ID of second segment |
| anchorA | { x: number, y: number } | Local anchor on bodyA |
| anchorB | { x: number, y: number } | Local anchor on bodyB |
| limits | { min: number, max: number } | Angular limits in radians |
| restAngle | number | Target angle for pose tracking |

### BallConfig

Configuration for the beach ball.

| Field | Type | Description |
|-------|------|-------------|
| radius | number | Ball radius in world units |
| restitution | number | Bounciness (0-1, high for beach ball) |
| spawnPosition | { x: number, y: number } | Initial position |
| color | string | Fill color (CSS color string) |

### ScenePhase (enum)

| Value | Description |
|-------|-------------|
| IDLE | Before scroll trigger activates |
| FALLING | Stick figure falling under gravity |
| IMPACT | Ground contact detected, motors releasing |
| RAGDOLL | Full ragdoll, zero motor stiffness |
| RECOVERY | Motors ramping stiffness back up |
| STANDING | Figure upright, animation complete |

### ExclusionZone

AABB for text reflow exclusion.

| Field | Type | Description |
|-------|------|-------------|
| x | number | Left edge in screen pixels |
| y | number | Top edge in screen pixels |
| width | number | Zone width in pixels |
| height | number | Zone height in pixels |

### LayoutLine

Output from Pretext layoutNextLine.

| Field | Type | Description |
|-------|------|-------------|
| text | string | The line's text content |
| x | number | Positioned X in screen pixels |
| y | number | Positioned Y in screen pixels |
| width | number | Measured width of line |

## State Transitions

```
IDLE → FALLING     (scroll passes trigger point)
FALLING → IMPACT   (any segment contacts ground collider)
IMPACT → RAGDOLL   (motor stiffness reaches zero)
RAGDOLL → RECOVERY (timer elapsed or scroll progress threshold)
RECOVERY → STANDING (all motors reach rest angles within tolerance)
```

## Key Relationships

- A **RagdollConfig** contains multiple **SegmentDefs** and **JointDefs**
- Each **JointDef** references two **SegmentDefs** by ID
- Each frame, every **SegmentDef**'s physics body produces an **ExclusionZone**
- The **BallConfig** also produces an **ExclusionZone** each frame
- **ExclusionZones** feed into the Pretext layout loop to produce **LayoutLines**
- **ScenePhase** determines motor stiffness values for all joints
