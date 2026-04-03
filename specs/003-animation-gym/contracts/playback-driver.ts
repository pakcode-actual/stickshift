/**
 * PlaybackDriver interface contract.
 *
 * Decouples scene interpretation from the progress source.
 * ScrollDriver implements this for the main scrollytelling route (GSAP ScrollTrigger).
 * SandboxDriver implements this for the sandbox route (manual timeline).
 */

export interface PlaybackDriver {
  /** Current progress in [0, 1] */
  getProgress(): number;

  /** Whether playback is actively advancing */
  isPlaying(): boolean;

  /** Register a callback invoked whenever progress changes */
  onProgressChange(callback: (progress: number) => void): void;

  /** Remove a previously registered callback */
  offProgressChange(callback: (progress: number) => void): void;

  /** Clean up resources (e.g., remove ScrollTrigger, cancel rAF) */
  destroy(): void;
}

export interface SandboxDriverControls {
  /** Start automatic playback */
  play(): void;

  /** Pause playback at current frame */
  pause(): void;

  /** Advance exactly one physics frame (1/60s of progress) */
  stepForward(): void;

  /** Seek to a specific progress value in [0, 1] */
  seek(progress: number): void;

  /** Set playback speed multiplier (1.0 = normal) */
  setSpeed(multiplier: number): void;

  /** Enable/disable looping */
  setLooping(enabled: boolean): void;
}
