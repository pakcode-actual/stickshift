import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { RiveCharacter } from './rive-character'

gsap.registerPlugin(ScrollTrigger)

const canvas = document.getElementById('rive-canvas') as HTMLCanvasElement
const statusEl = document.getElementById('status') as HTMLElement
const inputsEl = document.getElementById('inputs-debug') as HTMLElement

function log(msg: string): void {
  statusEl.textContent = msg
  console.log(`[rive-test] ${msg}`)
}

log('Initializing Rive...')

const character = new RiveCharacter({
  canvas,
  src: '/rive/character.riv',
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

    wireScrollTrigger(names)
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
 * Wire GSAP ScrollTrigger to Rive state machine inputs.
 *
 * Strategy: we divide the scroll into 3 sections.
 * - Section 1 (0–33%): idle
 * - Section 2 (33–66%): walk / movement
 * - Section 3 (66–100%): celebrate / jump
 *
 * We try to find inputs by common names. If no matching inputs exist
 * (the community .riv may use different names), we log what's available
 * and the scroll sections still show visual feedback via the DOM.
 */
function wireScrollTrigger(inputNames: string[]): void {
  const sections = document.querySelectorAll<HTMLElement>('.scroll-section')

  // Create a master ScrollTrigger across the scroll container
  ScrollTrigger.create({
    trigger: '#scroll-container',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const progress = self.progress // 0 → 1

      // Update progress bar
      const bar = document.getElementById('progress-bar')
      if (bar) bar.style.width = `${progress * 100}%`

      // Try to set a numeric "scroll" or "progress" input if it exists
      for (const name of inputNames) {
        const lower = name.toLowerCase()
        if (lower.includes('scroll') || lower.includes('progress') || lower === 'level') {
          character.setInput(name, progress * 100)
          break
        }
      }

      // Section-based triggers
      const section = progress < 0.33 ? 0 : progress < 0.66 ? 1 : 2
      updateActiveSection(sections, section)

      // Try to fire triggers based on section transitions
      if (section === 1) {
        trySetInput(inputNames, ['walk', 'walking', 'run', 'move'], true)
        trySetInput(inputNames, ['idle'], false)
      } else if (section === 2) {
        trySetInput(inputNames, ['celebrate', 'jump', 'happy', 'dance'], true)
        trySetInput(inputNames, ['walk', 'walking', 'run', 'move'], false)
      } else {
        trySetInput(inputNames, ['idle'], true)
        trySetInput(inputNames, ['walk', 'walking', 'run', 'move'], false)
        trySetInput(inputNames, ['celebrate', 'jump', 'happy', 'dance'], false)
      }
    },
  })

  log('ScrollTrigger wired — scroll to interact')
}

function trySetInput(inputNames: string[], candidates: string[], value: boolean): void {
  for (const candidate of candidates) {
    for (const name of inputNames) {
      if (name.toLowerCase().includes(candidate)) {
        character.setInput(name, value)
        return
      }
    }
  }
}

function updateActiveSection(sections: NodeListOf<HTMLElement>, active: number): void {
  sections.forEach((el, i) => {
    el.classList.toggle('active', i === active)
  })
}
