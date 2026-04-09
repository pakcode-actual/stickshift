import { Rive, StateMachineInput, Layout, Fit, Alignment } from '@rive-app/canvas'

export interface RiveCharacterOptions {
  canvas: HTMLCanvasElement
  src: string
  stateMachine?: string
  onLoad?: (inputs: Map<string, StateMachineInput>) => void
  onLoadError?: (error: string) => void
  onStateChange?: (states: string[]) => void
}

/**
 * Wraps a Rive instance: loads a .riv file onto a canvas, starts the
 * state machine, and exposes its inputs for external control (e.g. scroll).
 */
export class RiveCharacter {
  private rive: Rive | null = null
  private inputs = new Map<string, StateMachineInput>()
  private stateMachineName: string

  constructor(private opts: RiveCharacterOptions) {
    this.stateMachineName = opts.stateMachine ?? 'State Machine 1'
    this.init()
  }

  private init(): void {
    this.rive = new Rive({
      src: this.opts.src,
      canvas: this.opts.canvas,
      autoplay: true,
      stateMachines: this.stateMachineName,
      layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
      isTouchScrollEnabled: true,
      onLoad: () => {
        const needsReload = this.discoverAndFixStateMachine()
        if (needsReload) return // will reload with correct state machine
        this.collectInputs()
        this.resizeDrawingSurface()
        this.opts.onLoad?.(this.inputs)
      },
      onLoadError: (e) => {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[RiveCharacter] Load error: ${msg}`)
        this.opts.onLoadError?.(msg)
      },
      onStateChange: (event) => {
        if (event?.data && Array.isArray(event.data)) {
          this.opts.onStateChange?.(event.data as string[])
        }
      },
    })
  }

  /**
   * Log .riv contents and auto-fix state machine name mismatch.
   * Returns true if a reload was triggered (caller should bail).
   */
  private discoverAndFixStateMachine(): boolean {
    if (!this.rive) return false
    const r = this.rive
    console.log('[RiveCharacter] --- .riv contents ---')
    console.log(`[RiveCharacter] Artboard: ${r.activeArtboard ?? '(default)'}`)
    console.log(`[RiveCharacter] Animations (${r.animationNames.length}): ${r.animationNames.join(', ') || '(none)'}`)
    console.log(`[RiveCharacter] State machines (${r.stateMachineNames.length}): ${r.stateMachineNames.join(', ') || '(none)'}`)
    console.log('[RiveCharacter] -------------------')

    const smNames = r.stateMachineNames
    if (smNames.length > 0 && !smNames.includes(this.stateMachineName)) {
      console.warn(
        `[RiveCharacter] State machine "${this.stateMachineName}" not found! ` +
        `Available: ${smNames.join(', ')}. Reloading with "${smNames[0]}".`
      )
      this.stateMachineName = smNames[0]
      this.rive?.cleanup()
      this.initWithKnownStateMachine()
      return true
    }
    return false
  }

  /** Re-init after state machine name has been corrected */
  private initWithKnownStateMachine(): void {
    this.rive = new Rive({
      src: this.opts.src,
      canvas: this.opts.canvas,
      autoplay: true,
      stateMachines: this.stateMachineName,
      layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
      isTouchScrollEnabled: true,
      onLoad: () => {
        console.log(`[RiveCharacter] Loaded with state machine "${this.stateMachineName}"`)
        this.collectInputs()
        this.resizeDrawingSurface()
        this.opts.onLoad?.(this.inputs)
      },
      onLoadError: (e) => {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[RiveCharacter] Load error: ${msg}`)
        this.opts.onLoadError?.(msg)
      },
      onStateChange: (event) => {
        if (event?.data && Array.isArray(event.data)) {
          this.opts.onStateChange?.(event.data as string[])
        }
      },
    })
  }

  /** Sync the drawing surface to the canvas CSS size */
  resizeDrawingSurface(): void {
    this.rive?.resizeDrawingSurfaceToCanvas()
  }

  private collectInputs(): void {
    if (!this.rive) return
    const smInputs = this.rive.stateMachineInputs(this.stateMachineName)
    if (!smInputs) return
    this.inputs.clear()
    for (const input of smInputs) {
      this.inputs.set(input.name, input)
    }
  }

  /** Get a state machine input by name */
  getInput(name: string): StateMachineInput | undefined {
    return this.inputs.get(name)
  }

  /** Get all input names (useful for discovery / debugging) */
  getInputNames(): string[] {
    return [...this.inputs.keys()]
  }

  /** Set a numeric or boolean input */
  setInput(name: string, value: number | boolean): void {
    const input = this.inputs.get(name)
    if (input) input.value = value
  }

  /** Fire a trigger input */
  fireTrigger(name: string): void {
    const input = this.inputs.get(name)
    if (input) input.fire()
  }

  /** Resize the canvas to fill its container */
  resizeToContainer(): void {
    const canvas = this.opts.canvas
    const parent = canvas.parentElement
    if (!parent) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = parent.clientWidth * dpr
    canvas.height = parent.clientHeight * dpr
    canvas.style.width = `${parent.clientWidth}px`
    canvas.style.height = `${parent.clientHeight}px`
    this.resizeDrawingSurface()
  }

  cleanup(): void {
    this.rive?.cleanup()
    this.rive = null
    this.inputs.clear()
  }
}
