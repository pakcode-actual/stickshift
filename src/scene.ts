import type { PhysicsWorld } from './physics'
import type { SceneBeat } from './scene-types'
import type { PlaybackDriver } from './playback'
import { ScrollDriver } from './playback'
import {
  createSceneInstance,
  activateScene,
  deactivateScene,
  getLocalProgress,
  updateScene,
  computeTransitionOpacity,
  getSceneCamera,
} from './scene-interpreter'
import type { SceneInstance } from './scene-interpreter'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface JourneyController {
  getActiveSceneIndex(): number
  getActiveScene(): SceneInstance | null
  getProgress(): number
  getSceneCount(): number
  getSceneTitle(): string
  getLocalProgress(): number
  getCanvasOpacity(): number
  getCamera(): { offsetX: number; offsetY: number; scale: number }
  shouldSimulate(): boolean
  destroy(): void
}

// ─── Journey Manager ────────────────────────────────────────────────────────

export function initJourney(
  container: HTMLElement,
  physics: PhysicsWorld,
  sceneBeats: SceneBeat[],
  driver?: PlaybackDriver
): JourneyController {
  // Sort scenes by order
  const sortedBeats = [...sceneBeats].sort((a, b) => a.order - b.order)

  // Create scene instances
  const scenes: SceneInstance[] = sortedBeats.map(createSceneInstance)

  let progress = 0
  let activeIndex = -1

  // Total scroll height: ~10 screen heights for 5 scenes
  const scrollMultiplier = sortedBeats.length * 200 // 200% per scene

  // Use provided driver or create default ScrollDriver
  const playbackDriver = driver ?? new ScrollDriver(container, scrollMultiplier)

  // Wire progress updates
  playbackDriver.onProgressChange(updateJourney)

  function updateJourney(p: number): void {
    progress = p

    // Determine which scene should be active
    let newActiveIndex = -1
    for (let i = 0; i < scenes.length; i++) {
      const [start, end] = scenes[i].beat.scrollRange
      if (p >= start && p <= end) {
        newActiveIndex = i
        break
      }
    }

    // Handle scene transitions
    if (newActiveIndex !== activeIndex) {
      // Deactivate old scene
      if (activeIndex >= 0 && scenes[activeIndex].lifecycle === 'active') {
        deactivateScene(scenes[activeIndex], physics)
      }

      // Activate new scene
      if (newActiveIndex >= 0 && scenes[newActiveIndex].lifecycle === 'unloaded') {
        activateScene(scenes[newActiveIndex], physics)
      }

      activeIndex = newActiveIndex
    }

    // Update active scene's beat steps
    if (activeIndex >= 0 && scenes[activeIndex].lifecycle === 'active') {
      const localP = getLocalProgress(scenes[activeIndex], p)
      updateScene(scenes[activeIndex], localP, physics)

      // Update transition opacity
      scenes[activeIndex].transitionOpacity = computeTransitionOpacity(scenes[activeIndex], p)
    }
  }

  return {
    getActiveSceneIndex: () => activeIndex,
    getActiveScene: () => activeIndex >= 0 ? scenes[activeIndex] : null,
    getProgress: () => progress,
    getSceneCount: () => scenes.length,
    getSceneTitle: () => {
      if (activeIndex >= 0) return scenes[activeIndex].beat.title
      return ''
    },
    getLocalProgress: () => {
      if (activeIndex >= 0) {
        return getLocalProgress(scenes[activeIndex], progress)
      }
      return 0
    },
    getCanvasOpacity: () => {
      if (activeIndex >= 0) {
        return scenes[activeIndex].transitionOpacity
      }
      return 0
    },
    shouldSimulate: () => {
      if (activeIndex < 0) return false
      return scenes[activeIndex].lifecycle === 'active'
    },
    getCamera: () => {
      if (activeIndex >= 0 && scenes[activeIndex].lifecycle === 'active') {
        const localP = getLocalProgress(scenes[activeIndex], progress)
        return getSceneCamera(scenes[activeIndex], localP, physics)
      }
      return { offsetX: 0, offsetY: 0, scale: 1 }
    },
    destroy: () => {
      // Cleanup all active scenes
      for (const scene of scenes) {
        if (scene.lifecycle === 'active') {
          deactivateScene(scene, physics)
        }
      }
      playbackDriver.destroy()
    },
  }
}
