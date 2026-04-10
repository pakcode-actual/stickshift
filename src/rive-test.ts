import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { RiveCharacter } from './rive-character'

gsap.registerPlugin(ScrollTrigger)

const canvas = document.getElementById('rive-canvas') as HTMLCanvasElement
const container = document.getElementById('canvas-container') as HTMLElement
const statusEl = document.getElementById('status') as HTMLElement
const inputsEl = document.getElementById('inputs-debug') as HTMLElement

function log(msg: string): void {
  statusEl.textContent = msg
  console.log(`[rive-test] ${msg}`)
}

log('Initializing Rive...')

/**
 * 5-state-character.riv state machine mapping:
 *   Walk=0 → Stand (idle)
 *   Walk=1 → Walk
 *   Walk=2 → Run
 *   Walk=3 → Jump
 *   Walk=4 → Boxing
 *   Walk=5 → Docking
 */
const STATE = { STAND: 0, WALK: 1, RUN: 2, JUMP: 3, BOXING: 4, DOCKING: 5 } as const

const character = new RiveCharacter({
  canvas,
  src: '/rive/5-state-character.riv',
  onLoad: (inputs) => {
    ;(window as any).__riveCharacter = character
    const names = [...inputs.keys()]
    log(`Loaded! Inputs: ${names.length ? names.join(', ') : '(none)'}`)
    inputsEl.textContent = names.length
      ? names.map((n) => {
          const inp = inputs.get(n)!
          return `${n} [${inp.type}] = ${inp.value}`
        }).join('\n')
      : 'No state machine inputs found.\nThe character will still play its default animation.'

    console.log('[rive-test] All discovered inputs:', names)
    wireScrollTrigger()
  },
  onLoadError: (error) => {
    log(`Error: ${error}`)
    inputsEl.textContent = `Load failed: ${error}`
  },
  onStateChange: (states) => {
    log(`State → ${states.join(', ')}`)
  },
})

// Resize canvas to fill its container
function resize(): void {
  character.resizeToContainer()
}
resize()
window.addEventListener('resize', resize)

/**
 * Wire GSAP ScrollTrigger to the Rive "Walk" numeric input and
 * animate the character's vertical position based on scroll progress.
 *
 * Scroll sections:
 *  - Section 1 (0–33%):  Stand (idle)   — Walk=0
 *  - Section 2 (33–66%): Walk (moving)  — Walk=1
 *  - Section 3 (66–100%): Jump (celebrate) — Walk=3
 */
const SECTION_STATES = [STATE.STAND, STATE.WALK, STATE.JUMP]

function wireScrollTrigger(): void {
  const sections = document.querySelectorAll<HTMLElement>('.scroll-section')
  let lastSection = -1

  ScrollTrigger.create({
    trigger: '#scroll-container',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const progress = self.progress // 0 → 1

      // Update progress bar
      const bar = document.getElementById('progress-bar')
      if (bar) {
        const pct = Math.round(progress * 100)
        bar.style.width = `${pct}%`
        bar.setAttribute('aria-valuenow', String(pct))
      }

      // Determine active section
      const section = progress < 0.33 ? 0 : progress < 0.66 ? 1 : 2
      updateActiveSection(sections, section)

      // Animate character vertical position: move from top (20vh) to bottom (80vh)
      const yPercent = 20 + progress * 60
      container.style.top = `${yPercent}vh`

      // Only update Rive state on section change
      if (section !== lastSection) {
        lastSection = section
        character.setInput('Walk', SECTION_STATES[section])
        console.log(`[rive-test] Section ${section} → Walk=${SECTION_STATES[section]}`)
      }
    },
  })

  // Start in idle
  character.setInput('Walk', STATE.STAND)
  log('ScrollTrigger wired — scroll to interact')
}

function updateActiveSection(sections: NodeListOf<HTMLElement>, active: number): void {
  sections.forEach((el, i) => {
    el.classList.toggle('active', i === active)
  })
}
