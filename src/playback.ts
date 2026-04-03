import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// ─── PlaybackDriver Interface ───────────────────────────────────────────────

export interface PlaybackDriver {
  /** Current progress in [0, 1] */
  getProgress(): number

  /** Whether playback is actively advancing */
  isPlaying(): boolean

  /** Register a callback invoked whenever progress changes */
  onProgressChange(callback: (progress: number) => void): void

  /** Remove a previously registered callback */
  offProgressChange(callback: (progress: number) => void): void

  /** Clean up resources */
  destroy(): void
}

// ─── SandboxDriver ──────────────────────────────────────────────────────────

export class SandboxDriver implements PlaybackDriver {
  private progress = 0
  private playing = false
  private looping = true
  private speed = 1.0
  private totalFrames: number
  private callbacks: Set<(progress: number) => void> = new Set()

  constructor(totalFrames: number) {
    this.totalFrames = totalFrames
  }

  getProgress(): number {
    return this.progress
  }

  isPlaying(): boolean {
    return this.playing
  }

  getCurrentFrame(): number {
    return Math.round(this.progress * this.totalFrames)
  }

  getTotalFrames(): number {
    return this.totalFrames
  }

  onProgressChange(callback: (progress: number) => void): void {
    this.callbacks.add(callback)
  }

  offProgressChange(callback: (progress: number) => void): void {
    this.callbacks.delete(callback)
  }

  play(): void {
    this.playing = true
  }

  pause(): void {
    this.playing = false
  }

  stepForward(): void {
    this.playing = false
    const step = 1 / this.totalFrames
    this.setProgress(Math.min(1, this.progress + step))
  }

  seek(progress: number): void {
    this.playing = false
    this.setProgress(Math.max(0, Math.min(1, progress)))
  }

  setSpeed(multiplier: number): void {
    this.speed = multiplier
  }

  setLooping(enabled: boolean): void {
    this.looping = enabled
  }

  /** Called each frame from the game loop when playing */
  tick(): void {
    if (!this.playing) return

    const step = (this.speed / this.totalFrames)
    let next = this.progress + step

    if (next >= 1) {
      if (this.looping) {
        next = 0
      } else {
        next = 1
        this.playing = false
      }
    }

    this.setProgress(next)
  }

  destroy(): void {
    this.playing = false
    this.callbacks.clear()
  }

  private setProgress(p: number): void {
    this.progress = p
    for (const cb of this.callbacks) {
      cb(p)
    }
  }
}

// ─── ScrollDriver ───────────────────────────────────────────────────────────

export class ScrollDriver implements PlaybackDriver {
  private progress = 0
  private callbacks: Set<(progress: number) => void> = new Set()
  private trigger: ScrollTrigger.Vars | null = null
  private triggerInstance: ScrollTrigger | null = null

  constructor(
    container: HTMLElement,
    scrollMultiplier: number
  ) {
    gsap.registerPlugin(ScrollTrigger)

    this.triggerInstance = ScrollTrigger.create({
      trigger: container,
      pin: true,
      start: 'top top',
      end: `+=${scrollMultiplier}%`,
      onUpdate: (self) => {
        this.progress = self.progress
        for (const cb of this.callbacks) {
          cb(this.progress)
        }
      },
    })
  }

  getProgress(): number {
    return this.progress
  }

  isPlaying(): boolean {
    // Scroll-driven playback is always "playing" when the user scrolls
    return true
  }

  onProgressChange(callback: (progress: number) => void): void {
    this.callbacks.add(callback)
  }

  offProgressChange(callback: (progress: number) => void): void {
    this.callbacks.delete(callback)
  }

  destroy(): void {
    if (this.triggerInstance) {
      this.triggerInstance.kill()
      this.triggerInstance = null
    }
    this.callbacks.clear()
  }
}
