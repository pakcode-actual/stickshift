// ─── Scene Beat DSL Type Definitions ────────────────────────────────────────

export interface SceneBeat {
  id: string
  title: string
  order: number
  scrollRange: [number, number]
  transitionIn?: TransitionConfig
  transitionOut?: TransitionConfig
  actors: Actor[]
  text: TextConfig
  camera?: CameraConfig
  physics?: PhysicsConfig
  beats: BeatStep[]
}

export interface Actor {
  type: 'ragdoll' | 'prop' | 'particle-emitter'
  id: string
  propType?: 'beach-ball' | 'box' | 'platform' | 'confetti'
  position: [number, number]
  velocity?: [number, number]
  count?: number
  physics?: ActorPhysicsConfig
}

export interface ActorPhysicsConfig {
  friction?: number
  restitution?: number
  density?: number
  damping?: number
  angularDamping?: number
  gravityScale?: number
}

export interface BeatStep {
  scrollRange: [number, number]
  action: string
  target: string
  motorBlend?: number
  motorStiffness?: number
  impulse?: [number, number]
  pose?: string
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
}

export interface TextConfig {
  content: string
  mode: 'reflow' | 'scatter' | 'platform' | 'line-by-line'
  platformBlocks?: string[]
}

export interface CameraConfig {
  type?: 'static' | 'follow' | 'pan' | 'zoom'
  target?: string
  offset?: [number, number]
  scale?: number
}

export interface PhysicsConfig {
  gravity?: [number, number]
}

export interface TransitionConfig {
  type?: 'crossfade' | 'slide' | 'cut' | 'physics'
  duration?: number
}

// ─── Scene Lifecycle ────────────────────────────────────────────────────────

export type SceneLifecycle = 'unloaded' | 'active' | 'transitioning-out'

// ─── Text Interaction Mode Function Signature ───────────────────────────────

export type TextInteractionMode = 'reflow' | 'scatter' | 'platform' | 'line-by-line'
